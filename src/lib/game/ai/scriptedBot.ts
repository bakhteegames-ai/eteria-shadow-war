/**
 * Eteria: Shadow War - Scripted Bot
 * 
 * Simple scripted AI that:
 * - Maintains worker count
 * - Follows build order
 * - Trains military
 * - Attacks periodically
 * - Scales by difficulty
 * 
 * NOT using behavior trees, influence maps, or advanced AI.
 * This is a straightforward scripted opponent for Alpha.
 */

import type { 
  GameStateV2, 
  GameCommand, 
  FactionId,
  UnitType,
  BuildingType,
  Vec2,
} from '../core/types';
import { AI_CONFIGS, UNIT_STATS, BUILDING_STATS } from '../core/constants';
import { SeededRNG } from '../core/model';
import { 
  getAliveUnitsByFaction,
  getAliveBuildingsByFaction,
  getOperationalBuildings,
  getFactionResources,
  canAfford,
  getTownCenter,
  countUnits,
  countUnitsByType,
  getMilitaryStrength,
} from '../core/queries';
import {
  trainCommand,
  buildCommand,
  moveCommand,
  attackCommand,
  setRallyPointCommand,
} from '../core/commands';
import { gridToWorld, worldToGrid } from '../navigation/Grid';

// ============================================================================
// TYPES
// ============================================================================

type BotPhase = 'opening' | 'economic' | 'military' | 'attacking' | 'defending';

interface BotState {
  phase: BotPhase;
  lastActionTick: number;
  nextAttackTick: number;
  workersTarget: number;
  barracksBuilt: boolean;
  stableBuilt: boolean;
  attackWaveCount: number;
}

// ============================================================================
// SCRIPTED BOT
// ============================================================================

/**
 * Create scripted bot state
 */
function createBotState(difficulty: string): BotState {
  const config = AI_CONFIGS[difficulty] || AI_CONFIGS.normal;
  
  return {
    phase: 'opening',
    lastActionTick: 0,
    nextAttackTick: config.attackWaveInterval * 60,  // Convert to ticks
    workersTarget: 4,
    barracksBuilt: false,
    stableBuilt: false,
    attackWaveCount: 0,
  };
}

// Bot state instances per faction
const botStates = new Map<FactionId, BotState>();

// Deterministic RNG for bot decisions - seeded from game state
function getBotRNG(state: GameStateV2, factionId: FactionId): SeededRNG {
  // Combine tick and seed for deterministic but varying decisions
  const seed = state.simulation.rngSeed + state.simulation.tick * 1000 + (factionId === 'enemy' ? 1 : 0);
  return new SeededRNG(seed);
}

/**
 * Process AI turn and return commands
 */
export function processBot(state: GameStateV2, factionId: FactionId): GameCommand[] {
  const commands: GameCommand[] = [];
  
  // Get bot state
  let botState = botStates.get(factionId);
  if (!botState) {
    const difficulty = state.factions[factionId].aiDifficulty || 'normal';
    botState = createBotState(difficulty);
    botStates.set(factionId, botState);
  }
  
  // Get config
  const difficulty = state.factions[factionId].aiDifficulty || 'normal';
  const config = AI_CONFIGS[difficulty];
  
  // Check reaction time
  const ticksPerReaction = Math.floor(config.reactionTime / (1000 / 60));
  if (state.simulation.tick - botState.lastActionTick < ticksPerReaction) {
    return commands;
  }
  
  botState.lastActionTick = state.simulation.tick;
  
  // Get state info
  const myUnits = getAliveUnitsByFaction(state, factionId);
  const myBuildings = getAliveBuildingsByFaction(state, factionId);
  const resources = getFactionResources(state, factionId);
  
  const enemyFactionId = factionId === 'player' ? 'enemy' : 'player';
  const enemyUnits = getAliveUnitsByFaction(state, enemyFactionId);
  const enemyBuildings = getAliveBuildingsByFaction(state, enemyFactionId);
  
  // Determine phase
  botState.phase = determinePhase(state, factionId, botState);
  
  // Execute phase actions
  switch (botState.phase) {
    case 'opening':
      commands.push(...openingPhase(state, factionId, botState));
      break;
    case 'economic':
      commands.push(...economicPhase(state, factionId, botState));
      break;
    case 'military':
      commands.push(...militaryPhase(state, factionId, botState));
      break;
    case 'attacking':
      commands.push(...attackingPhase(state, factionId, botState));
      break;
    case 'defending':
      commands.push(...defendingPhase(state, factionId, botState));
      break;
  }
  
  // Check for attack wave
  if (state.simulation.tick >= botState.nextAttackTick) {
    const attackCommands = launchAttack(state, factionId, botState, config);
    commands.push(...attackCommands);
    botState.nextAttackTick = state.simulation.tick + config.attackWaveInterval * 60;
    botState.attackWaveCount++;
  }
  
  // Update bot state
  botStates.set(factionId, botState);
  
  return commands;
}

// ============================================================================
// PHASE DETERMINATION
// ============================================================================

function determinePhase(
  state: GameStateV2, 
  factionId: FactionId, 
  botState: BotState
): BotPhase {
  const myUnits = getAliveUnitsByFaction(state, factionId);
  const myBuildings = getAliveBuildingsByFaction(state, factionId);
  const enemyUnits = getAliveUnitsByFaction(state, factionId === 'player' ? 'enemy' : 'player');
  
  const workers = myUnits.filter(u => u.type === 'worker').length;
  const military = myUnits.filter(u => u.type !== 'worker').length;
  const enemyMilitary = enemyUnits.filter(u => u.type !== 'worker').length;
  
  // Check if under attack
  const tc = getTownCenter(state, factionId);
  if (tc) {
    const enemiesNearBase = enemyUnits.filter(u => {
      const dx = u.position.x - tc.position.x;
      const dz = u.position.z - tc.position.z;
      return Math.sqrt(dx * dx + dz * dz) < 15;
    });
    
    if (enemiesNearBase.length > 0) {
      return 'defending';
    }
  }
  
  // Opening: First 30 seconds or until first barracks
  if (state.simulation.gameTime < 30 || !botState.barracksBuilt) {
    return 'opening';
  }
  
  // Military: Have army, prepare to attack
  if (military >= 5) {
    return 'military';
  }
  
  // Economic: Build up economy
  return 'economic';
}

// ============================================================================
// PHASE ACTIONS
// ============================================================================

function openingPhase(
  state: GameStateV2, 
  factionId: FactionId, 
  botState: BotState
): GameCommand[] {
  const commands: GameCommand[] = [];
  const resources = getFactionResources(state, factionId);
  const myUnits = getAliveUnitsByFaction(state, factionId);
  const myBuildings = getAliveBuildingsByFaction(state, factionId);
  
  // Train first workers
  const workers = myUnits.filter(u => u.type === 'worker').length;
  const tc = myBuildings.find(b => b.type === 'townCenter');
  
  if (workers < 4 && tc && canAfford(state, factionId, UNIT_STATS.worker.cost)) {
    commands.push(trainCommand(factionId, tc.id, 'worker'));
    return commands;
  }
  
  // Build barracks
  if (!botState.barracksBuilt && workers >= 2) {
    const barracksCost = BUILDING_STATS.barracks.cost;
    if (canAfford(state, factionId, barracksCost)) {
      // Find build position near TC
      const buildPos = findBuildPosition(state, factionId, 'barracks');
      if (buildPos && tc) {
        const worker = myUnits.find(u => u.type === 'worker');
        if (worker) {
          commands.push(buildCommand(factionId, worker.id, 'barracks', buildPos));
          botState.barracksBuilt = true;
          return commands;
        }
      }
    }
  }
  
  return commands;
}

function economicPhase(
  state: GameStateV2, 
  factionId: FactionId, 
  botState: BotState
): GameCommand[] {
  const commands: GameCommand[] = [];
  const resources = getFactionResources(state, factionId);
  const myUnits = getAliveUnitsByFaction(state, factionId);
  const myBuildings = getAliveBuildingsByFaction(state, factionId);
  
  // Maintain workers
  const workers = myUnits.filter(u => u.type === 'worker').length;
  const tc = myBuildings.find(b => b.type === 'townCenter');
  
  if (workers < 6 && tc && canAfford(state, factionId, UNIT_STATS.worker.cost)) {
    commands.push(trainCommand(factionId, tc.id, 'worker'));
    return commands;
  }
  
  // Train some military
  const barracks = myBuildings.find(b => b.type === 'barracks');
  if (barracks && canAfford(state, factionId, UNIT_STATS.warrior.cost)) {
    const rng = getBotRNG(state, factionId);
    const unitType: UnitType = rng.next() > 0.5 ? 'warrior' : 'archer';
    commands.push(trainCommand(factionId, barracks.id, unitType));
    return commands;
  }
  
  return commands;
}

function militaryPhase(
  state: GameStateV2, 
  factionId: FactionId, 
  botState: BotState
): GameCommand[] {
  const commands: GameCommand[] = [];
  const resources = getFactionResources(state, factionId);
  const myBuildings = getAliveBuildingsByFaction(state, factionId);
  
  // Train military units
  const barracks = myBuildings.find(b => b.type === 'barracks');
  const stable = myBuildings.find(b => b.type === 'stable');
  
  // Prioritize barracks units
  if (barracks && canAfford(state, factionId, UNIT_STATS.warrior.cost)) {
    const rng = getBotRNG(state, factionId);
    const unitType: UnitType = rng.next() > 0.4 ? 'warrior' : 'archer';
    commands.push(trainCommand(factionId, barracks.id, unitType));
    return commands;
  }
  
  // Build stable if we have resources
  if (!botState.stableBuilt && barracks && canAfford(state, factionId, BUILDING_STATS.stable.cost)) {
    const buildPos = findBuildPosition(state, factionId, 'stable');
    const myUnits = getAliveUnitsByFaction(state, factionId);
    const worker = myUnits.find(u => u.type === 'worker');
    
    if (buildPos && worker) {
      commands.push(buildCommand(factionId, worker.id, 'stable', buildPos));
      botState.stableBuilt = true;
      return commands;
    }
  }
  
  // Train knights from stable
  if (stable && canAfford(state, factionId, UNIT_STATS.knight.cost)) {
    commands.push(trainCommand(factionId, stable.id, 'knight'));
    return commands;
  }
  
  return commands;
}

function attackingPhase(
  state: GameStateV2, 
  factionId: FactionId, 
  botState: BotState
): GameCommand[] {
  // This phase is triggered when launching attack waves
  // See launchAttack function
  return [];
}

function defendingPhase(
  state: GameStateV2, 
  factionId: FactionId, 
  botState: BotState
): GameCommand[] {
  const commands: GameCommand[] = [];
  
  const enemyFactionId = factionId === 'player' ? 'enemy' : 'player';
  const myUnits = getAliveUnitsByFaction(state, factionId);
  const enemyUnits = getAliveUnitsByFaction(state, enemyFactionId);
  const tc = getTownCenter(state, factionId);
  
  if (!tc) return commands;
  
  // Find enemies near base
  const enemiesNearBase = enemyUnits.filter(u => {
    const dx = u.position.x - tc.position.x;
    const dz = u.position.z - tc.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 15;
  });
  
  if (enemiesNearBase.length > 0) {
    // Send all military to defend
    const military = myUnits.filter(u => u.type !== 'worker');
    if (military.length > 0) {
      const target = enemiesNearBase[0];
      commands.push(attackCommand(
        factionId, 
        military.map(u => u.id), 
        target.id
      ));
    }
  }
  
  return commands;
}

// ============================================================================
// ATTACK WAVES
// ============================================================================

function launchAttack(
  state: GameStateV2, 
  factionId: FactionId, 
  botState: BotState,
  config: typeof AI_CONFIGS.normal
): GameCommand[] {
  const commands: GameCommand[] = [];
  
  const myUnits = getAliveUnitsByFaction(state, factionId);
  const military = myUnits.filter(u => u.type !== 'worker');
  
  // Check if we have enough units
  if (military.length < config.attackWaveSize) {
    return commands;
  }
  
  // Find enemy base
  const enemyFactionId = factionId === 'player' ? 'enemy' : 'player';
  const enemyTC = getTownCenter(state, enemyFactionId);
  
  if (!enemyTC) {
    return commands;
  }
  
  // Select units for attack
  const attackSize = Math.min(config.attackWaveSize, military.length);
  const attackers = military.slice(0, attackSize);
  
  console.log(`[Bot] Launching attack wave ${botState.attackWaveCount + 1} with ${attackers.length} units`);
  
  // Send attack command
  commands.push(attackCommand(
    factionId,
    attackers.map(u => u.id),
    enemyTC.id
  ));
  
  return commands;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Find a valid build position near TC
 */
function findBuildPosition(
  state: GameStateV2, 
  factionId: FactionId, 
  buildingType: BuildingType
): Vec2 | null {
  const tc = getTownCenter(state, factionId);
  if (!tc) return null;
  
  // Try positions around TC
  const offsets = [
    { dx: 5, dy: 0 },
    { dx: -5, dy: 0 },
    { dx: 0, dy: 5 },
    { dx: 0, dy: -5 },
    { dx: 5, dy: 5 },
    { dx: -5, dy: -5 },
  ];
  
  for (const offset of offsets) {
    const gridX = Math.floor(tc.position.x / 2) + offset.dx;
    const gridY = Math.floor(tc.position.z / 2) + offset.dy;
    
    // Check if position is valid
    if (gridX >= 0 && gridX < 40 && gridY >= 0 && gridY < 40) {
      return { x: gridX, y: gridY };
    }
  }
  
  return null;
}

/**
 * Reset bot state for new game
 */
export function resetBotState(): void {
  botStates.clear();
}

/**
 * Get bot debug info
 */
export function getBotDebugInfo(factionId: FactionId): BotState | undefined {
  return botStates.get(factionId);
}
