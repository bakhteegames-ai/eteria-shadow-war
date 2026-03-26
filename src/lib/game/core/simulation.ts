/**
 * Eteria: Shadow War - Simulation Core
 * 
 * Main simulation function that processes all game systems.
 * Systems are called in a specific order for determinism.
 * 
 * System order:
 * 1. consumeCommands
 * 2. constructionSystem
 * 3. productionSystem
 * 4. resourceSystem (stub for T3)
 * 5. movementSystem (stub for T4)
 * 6. combatSystem (stub for T4)
 * 7. spawn/death cleanup
 * 8. victorySystem
 */

import type { GameStateV2, GameCommand, EntityId, SelectCommand, MoveCommand, AttackCommand, AttackMoveCommand, StopCommand, BuildCommand, TrainCommand, SetRallyPointCommand, GatherCommand, CancelCommand, PauseCommand } from './types';
import { processConstruction } from '../systems/constructionSystem';
import { processProduction } from '../systems/productionSystem';
import { processResources } from '../systems/resourceSystem';
import { processMovement } from '../systems/movementSystem';
import { processCombat } from '../systems/combatSystem';
import { checkVictory } from '../systems/victorySystem';
import { processBot } from '../ai/scriptedBot';
import { 
  setGlobalTick,
  setCommandTick,
  isUnitAlive,
  isBuildingAlive,
  createBuilding,
} from './model';
import { UNIT_STATS, BUILDING_STATS, VICTORY_CONFIG } from './constants';

// ============================================================================
// COMMAND PROCESSING
// ============================================================================

/**
 * Process pending commands and apply to state
 */
function processCommands(state: GameStateV2, commands: GameCommand[]): GameStateV2 {
  if (commands.length === 0) return state;
  
  // Process each command
  for (const cmd of commands) {
    state = applyCommand(state, cmd);
  }
  
  return state;
}

/**
 * Apply a single command to the state
 */
function applyCommand(state: GameStateV2, cmd: GameCommand): GameStateV2 {
  switch (cmd.type) {
    case 'SELECT':
      return applySelectCommand(state, cmd);
    case 'MOVE':
      return applyMoveCommand(state, cmd);
    case 'ATTACK':
      return applyAttackCommand(state, cmd);
    case 'ATTACK_MOVE':
      return applyAttackMoveCommand(state, cmd);
    case 'STOP':
      return applyStopCommand(state, cmd);
    case 'BUILD':
      return applyBuildCommand(state, cmd);
    case 'TRAIN':
      return applyTrainCommand(state, cmd);
    case 'SET_RALLY_POINT':
      return applySetRallyPointCommand(state, cmd);
    case 'GATHER':
      return applyGatherCommand(state, cmd);
    case 'CANCEL':
      return applyCancelCommand(state, cmd);
    case 'PAUSE':
      return applyPauseCommand(state, cmd);
    default:
      console.warn(`[Simulation] Unknown command type: ${JSON.stringify(cmd)}`);
      return state;
  }
}

// ============================================================================
// COMMAND IMPLEMENTATIONS
// ============================================================================

function applySelectCommand(state: GameStateV2, cmd: SelectCommand): GameStateV2 {
  if (cmd.addToSelection) {
    // Add to selection
    const newSelected = new Set(state.selectedEntityIds);
    cmd.entityIds.forEach(id => newSelected.add(id));
    return {
      ...state,
      selectedEntityIds: Array.from(newSelected),
      units: state.units.map(u => ({
        ...u,
        isSelected: newSelected.has(u.id),
      })),
    };
  } else {
    // Replace selection
    const selectedSet = new Set(cmd.entityIds);
    return {
      ...state,
      selectedEntityIds: cmd.entityIds,
      units: state.units.map(u => ({
        ...u,
        isSelected: selectedSet.has(u.id),
      })),
    };
  }
}

function applyMoveCommand(state: GameStateV2, cmd: MoveCommand): GameStateV2 {
  return {
    ...state,
    units: state.units.map(u => {
      if (!cmd.entityIds.includes(u.id)) return u;
      if (!isUnitAlive(u)) return u;
      
      return {
        ...u,
        targetPosition: { ...cmd.targetPosition },
        targetEntityId: undefined,
        state: 'moving',
        path: undefined,  // Will be computed by movement system
      };
    }),
  };
}

function applyAttackCommand(state: GameStateV2, cmd: AttackCommand): GameStateV2 {
  return {
    ...state,
    units: state.units.map(u => {
      if (!cmd.entityIds.includes(u.id)) return u;
      if (!isUnitAlive(u)) return u;
      
      return {
        ...u,
        targetEntityId: cmd.targetEntityId,
        targetPosition: undefined,
        state: 'attacking',
      };
    }),
  };
}

function applyAttackMoveCommand(state: GameStateV2, cmd: AttackMoveCommand): GameStateV2 {
  return {
    ...state,
    units: state.units.map(u => {
      if (!cmd.entityIds.includes(u.id)) return u;
      if (!isUnitAlive(u)) return u;
      
      return {
        ...u,
        targetPosition: { ...cmd.targetPosition },
        targetEntityId: undefined,
        state: 'moving' as const,  // Will attack enemies on the way
        // Mark as attack-move for movement system (T4)
      };
    }),
  };
}

function applyStopCommand(state: GameStateV2, cmd: StopCommand): GameStateV2 {
  return {
    ...state,
    units: state.units.map(u => {
      if (!cmd.entityIds.includes(u.id)) return u;
      
      return {
        ...u,
        targetPosition: undefined,
        targetEntityId: undefined,
        state: 'idle',
        path: undefined,
      };
    }),
  };
}

function applyBuildCommand(state: GameStateV2, cmd: BuildCommand): GameStateV2 {
  const worker = state.units.find(u => u.id === cmd.workerId);
  if (!worker || !isUnitAlive(worker) || worker.type !== 'worker') {
    return state;
  }
  
  // Check if faction can afford
  const stats = BUILDING_STATS[cmd.buildingType];
  const faction = state.factions[cmd.factionId];
  
  if (faction.resources.crystals < stats.cost.crystals ||
      faction.resources.essence < stats.cost.essence) {
    console.log(`[Simulation] Cannot afford ${cmd.buildingType}`);
    return state;
  }
  
  // Deduct resources
  const newFactions = {
    ...state.factions,
    [cmd.factionId]: {
      ...faction,
      resources: {
        crystals: faction.resources.crystals - stats.cost.crystals,
        essence: faction.resources.essence - stats.cost.essence,
      },
    },
  };
  
  // Create building (will start construction)
  // For now, use world position from grid position
  const worldPos = {
    x: cmd.position.x * 2 + 1,
    y: 0,
    z: cmd.position.y * 2 + 1,
  };
  
  const newBuilding = createBuilding(cmd.buildingType, cmd.factionId, worldPos, false);
  newBuilding.builderId = cmd.workerId;
  
  // Set worker to building state
  const newUnits = state.units.map(u => {
    if (u.id === cmd.workerId) {
      return {
        ...u,
        state: 'building' as const,
        targetBuildingId: newBuilding.id,
      };
    }
    return u;
  });
  
  return {
    ...state,
    units: newUnits,
    buildings: [...state.buildings, newBuilding],
    factions: newFactions,
  };
}

function applyTrainCommand(state: GameStateV2, cmd: TrainCommand): GameStateV2 {
  const building = state.buildings.find(b => b.id === cmd.buildingId);
  if (!building || !isBuildingAlive(building)) {
    return state;
  }
  
  // Check if building can produce this unit
  if (!building.stats.producesUnits?.includes(cmd.unitType)) {
    console.log(`[Simulation] ${building.type} cannot produce ${cmd.unitType}`);
    return state;
  }
  
  // Check resources
  const stats = UNIT_STATS[cmd.unitType];
  const faction = state.factions[cmd.factionId];
  
  if (faction.resources.crystals < stats.cost.crystals ||
      faction.resources.essence < stats.cost.essence) {
    console.log(`[Simulation] Cannot afford ${cmd.unitType}`);
    return state;
  }
  
  // Deduct resources
  const newFactions = {
    ...state.factions,
    [cmd.factionId]: {
      ...faction,
      resources: {
        crystals: faction.resources.crystals - stats.cost.crystals,
        essence: faction.resources.essence - stats.cost.essence,
      },
    },
  };
  
  // Add to production queue
  const newBuildings = state.buildings.map(b => {
    if (b.id !== cmd.buildingId) return b;
    
    return {
      ...b,
      productionQueue: [
        ...b.productionQueue,
        {
          unitType: cmd.unitType,
          progress: 0,
          totalTime: stats.trainTime,
        },
      ],
    };
  });
  
  return {
    ...state,
    buildings: newBuildings,
    factions: newFactions,
  };
}

function applySetRallyPointCommand(state: GameStateV2, cmd: SetRallyPointCommand): GameStateV2 {
  return {
    ...state,
    buildings: state.buildings.map(b => {
      if (b.id !== cmd.buildingId) return b;
      return {
        ...b,
        rallyPoint: { ...cmd.position },
      };
    }),
  };
}

function applyGatherCommand(state: GameStateV2, cmd: GatherCommand): GameStateV2 {
  const resource = state.map.resourceNodes.find(r => r.id === cmd.resourceNodeId);
  if (!resource || resource.amount <= 0) {
    return state;
  }
  
  return {
    ...state,
    units: state.units.map(u => {
      if (!cmd.workerIds.includes(u.id)) return u;
      if (!isUnitAlive(u) || u.type !== 'worker') return u;
      
      return {
        ...u,
        targetResourceId: cmd.resourceNodeId,
        state: 'gathering' as const,
      };
    }),
  };
}

function applyCancelCommand(state: GameStateV2, cmd: CancelCommand): GameStateV2 {
  const building = state.buildings.find(b => b.id === cmd.buildingId);
  if (!building || cmd.queueIndex >= building.productionQueue.length) {
    return state;
  }
  
  const cancelledItem = building.productionQueue[cmd.queueIndex];
  const stats = UNIT_STATS[cancelledItem.unitType];
  
  // Refund resources
  const faction = state.factions[cmd.factionId];
  const newFactions = {
    ...state.factions,
    [cmd.factionId]: {
      ...faction,
      resources: {
        crystals: faction.resources.crystals + stats.cost.crystals,
        essence: faction.resources.essence + stats.cost.essence,
      },
    },
  };
  
  // Remove from queue
  const newBuildings = state.buildings.map(b => {
    if (b.id !== cmd.buildingId) return b;
    
    return {
      ...b,
      productionQueue: b.productionQueue.filter((_, i) => i !== cmd.queueIndex),
    };
  });
  
  return {
    ...state,
    buildings: newBuildings,
    factions: newFactions,
  };
}

function applyPauseCommand(state: GameStateV2, cmd: PauseCommand): GameStateV2 {
  return {
    ...state,
    simulation: {
      ...state.simulation,
      phase: cmd.pause ? 'paused' : 'running',
    },
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Remove dead units and update entity index
 */
function cleanupDeadEntities(state: GameStateV2): GameStateV2 {
  // Remove dead units
  const aliveUnits = state.units.filter(isUnitAlive);
  
  // Remove dead buildings
  const aliveBuildings = state.buildings.filter(isBuildingAlive);
  
  // Update entity index
  const entityIndex = new Map(state.entityIndex);
  
  // Remove dead entities from index
  state.units.forEach(u => {
    if (!isUnitAlive(u)) {
      entityIndex.delete(u.id);
    }
  });
  
  state.buildings.forEach(b => {
    if (!isBuildingAlive(b)) {
      entityIndex.delete(b.id);
    }
  });
  
  return {
    ...state,
    units: aliveUnits,
    buildings: aliveBuildings,
    entityIndex,
  };
}

// ============================================================================
// MAIN SIMULATION FUNCTION
// ============================================================================

/**
 * Process one simulation tick
 * 
 * @param state Current game state
 * @param dt Delta time in seconds (fixed timestep)
 * @param commands Commands to process this tick
 * @returns New game state (immutable)
 */
/** Result of simulation tick including state and any AI-generated commands */
export interface TickResult {
  state: GameStateV2;
  aiCommands: GameCommand[];
}

export function tickSimulation(
  state: GameStateV2,
  dt: number,
  commands: GameCommand[]
): TickResult {
  // Update global tick counter for ID generation
  setGlobalTick(state.simulation.tick);
  setCommandTick(state.simulation.tick);
  
  // Skip if not running
  if (state.simulation.phase !== 'running') {
    return { state, aiCommands: [] };
  }
  
  // 1. Process commands
  state = processCommands(state, commands);
  
  // 2. Construction system
  state = processConstruction(state, dt);
  
  // 3. Production system
  state = processProduction(state, dt);
  
  // 4. Resource system
  state = processResources(state, dt);
  
  // 5. Movement system (with pathfinding)
  state = processMovement(state, dt);
  
  // 6. Combat system
  state = processCombat(state, dt);
  
// Note: AI commands are now returned separately to be processed by GameLoop
  // This ensures single authoritative command path
  
  // 7. Cleanup dead entities
  state = cleanupDeadEntities(state);
  
  // 8. Victory check
  state = checkVictory(state);
  
  // Generate AI commands for enemy faction
  const aiCommands = processBot(state, 'enemy');
  
  // Update simulation meta
  state = {
    ...state,
    simulation: {
      ...state.simulation,
      tick: state.simulation.tick + 1,
      gameTime: state.simulation.gameTime + dt,
    },
  };
  
  return { state, aiCommands };
}
