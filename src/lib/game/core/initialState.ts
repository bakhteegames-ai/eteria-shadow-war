/**
 * Eteria: Shadow War - Initial State Factory
 * 
 * Creates the complete initial game state for a new match.
 * All matches start with the same deterministic state.
 */

import type {
  GameStateV2,
  GameConfig,
  SimulationMeta,
  MapState,
  MapTile,
  FactionState,
  FactionId,
  FactionType,
  Unit,
  Building,
  GamePhase,
} from './types';
import { 
  createUnit, 
  createBuilding, 
  createResourceNode,
  gridToWorld,
  SeededRNG,
  setGlobalTick,
  resetIdGenerator,
} from './model';
import {
  STARTING_RESOURCES,
  STARTING_POSITIONS,
  RESOURCE_NODE_CONFIG,
  SIMULATION_CONFIG,
  MAP_SIZE,
  WORLD_SIZE,
  AI_CONFIGS,
} from './constants';

// ============================================================================
// MAP GENERATION
// ============================================================================

/**
 * Generate a simple symmetrical map
 * TODO: Add more sophisticated generation in later phases
 */
function generateMap(rng: SeededRNG): MapState {
  const { width, height, tileSize } = MAP_SIZE;
  
  // Create empty grass tiles
  const tiles: MapTile[][] = [];
  for (let x = 0; x < width; x++) {
    tiles[x] = [];
    for (let y = 0; y < height; y++) {
      tiles[x][y] = {
        type: 'grass',
        isWalkable: true,
        isBuildable: true,
      };
    }
  }
  
  // Add some water features (decorative, not blocking for alpha)
  // TODO: Add proper water obstacles in Phase 5
  
  // Generate resource nodes
  const resourceNodes = generateResourceNodes(rng);
  
  return {
    width,
    height,
    tileSize,
    tiles,
    resourceNodes,
  };
}

/**
 * Generate resource nodes on the map
 */
function generateResourceNodes(rng: SeededRNG): MapState['resourceNodes'] {
  const nodes: MapState['resourceNodes'] = [];
  const { width, height } = MAP_SIZE;
  
  // Calculate safe zones around starting positions
  const playerStart = STARTING_POSITIONS.player;
  const enemyStart = STARTING_POSITIONS.enemy;
  const minDist = RESOURCE_NODE_CONFIG.minDistanceFromStart;
  
  // Helper to check if position is too close to start
  const isTooCloseToStart = (x: number, y: number): boolean => {
    const dxp = Math.abs(x - playerStart.x);
    const dyp = Math.abs(y - playerStart.y);
    const dxe = Math.abs(x - enemyStart.x);
    const dye = Math.abs(y - enemyStart.y);
    return (dxp < minDist && dyp < minDist) || (dxe < minDist && dye < minDist);
  };
  
  // Generate crystal nodes
  for (let i = 0; i < RESOURCE_NODE_CONFIG.crystalNodes; i++) {
    let attempts = 0;
    while (attempts < 100) {
      const x = rng.nextInt(4, width - 4);
      const y = rng.nextInt(4, height - 4);
      
      if (!isTooCloseToStart(x, y)) {
        const worldX = x * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2;
        const worldY = y * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2;
        
        nodes.push(createResourceNode(
          'crystals',
          { x: worldX, y: worldY },
          RESOURCE_NODE_CONFIG.resourcePerNode.crystals
        ));
        break;
      }
      attempts++;
    }
  }
  
  // Generate essence nodes
  for (let i = 0; i < RESOURCE_NODE_CONFIG.essenceNodes; i++) {
    let attempts = 0;
    while (attempts < 100) {
      const x = rng.nextInt(4, width - 4);
      const y = rng.nextInt(4, height - 4);
      
      if (!isTooCloseToStart(x, y)) {
        const worldX = x * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2;
        const worldY = y * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2;
        
        nodes.push(createResourceNode(
          'essence',
          { x: worldX, y: worldY },
          RESOURCE_NODE_CONFIG.resourcePerNode.essence
        ));
        break;
      }
      attempts++;
    }
  }
  
  return nodes;
}

// ============================================================================
// STARTING ENTITIES
// ============================================================================

/**
 * Create starting units for a faction
 */
function createStartingUnits(
  factionId: FactionId,
  factionType: FactionType,
  startPosition: { x: number; y: number },
  config: typeof SIMULATION_CONFIG.startingUnits.player
): Unit[] {
  const units: Unit[] = [];
  const worldPos = gridToWorld(startPosition);
  
  // Create workers
  for (let i = 0; i < config.workers; i++) {
    const offset = {
      x: worldPos.x + (i - Math.floor(config.workers / 2)) * 2,
      y: 0,
      z: worldPos.z + 3,
    };
    units.push(createUnit('worker', factionId, offset));
  }
  
  // Create warriors
  for (let i = 0; i < config.warriors; i++) {
    const offset = {
      x: worldPos.x + (i - Math.floor(config.warriors / 2)) * 2,
      y: 0,
      z: worldPos.z - 2,
    };
    units.push(createUnit('warrior', factionId, offset));
  }
  
  return units;
}

/**
 * Create starting buildings for a faction
 */
function createStartingBuildings(
  factionId: FactionId,
  factionType: FactionType,
  startPosition: { x: number; y: number }
): Building[] {
  const buildings: Building[] = [];
  const worldPos = gridToWorld(startPosition);
  
  // Create Town Center
  const tc = createBuilding('townCenter', factionId, worldPos, true);
  tc.rallyPoint = {
    x: Math.floor(worldPos.x / MAP_SIZE.tileSize) + 3,
    y: Math.floor(worldPos.z / MAP_SIZE.tileSize),
  };
  buildings.push(tc);
  
  return buildings;
}

// ============================================================================
// FACTION STATE
// ============================================================================

/**
 * Create initial faction state
 */
function createFactionState(
  id: FactionId,
  factionType: FactionType,
  isAI: boolean,
  difficulty?: string
): FactionState {
  return {
    id,
    factionType,
    resources: { ...STARTING_RESOURCES },
    isAI,
    aiDifficulty: isAI ? (difficulty as any) || 'normal' : undefined,
  };
}

// ============================================================================
// MAIN FACTORY
// ============================================================================

/**
 * Create the complete initial game state for a new match
 */
export function createInitialState(config: GameConfig): GameStateV2 {
  // Reset ID generator for determinism
  resetIdGenerator(0);
  
  // Initialize RNG with seed
  const seed = config.seed ?? Date.now();
  const rng = new SeededRNG(seed);
  
  // Determine faction types
  const playerFactionType = config.playerFactionType;
  const enemyFactionType = playerFactionType === 'altera' ? 'draktar' : 'altera';
  
  // Generate map
  const map = generateMap(rng);
  
  // Create factions
  const factions: Record<FactionId, FactionState> = {
    player: createFactionState('player', playerFactionType, false),
    enemy: createFactionState('enemy', enemyFactionType, true, config.difficulty),
  };
  
  // Create starting entities
  const playerUnits = createStartingUnits(
    'player',
    playerFactionType,
    STARTING_POSITIONS.player,
    SIMULATION_CONFIG.startingUnits.player
  );
  
  const enemyUnits = createStartingUnits(
    'enemy',
    enemyFactionType,
    STARTING_POSITIONS.enemy,
    SIMULATION_CONFIG.startingUnits.enemy
  );
  
  const playerBuildings = createStartingBuildings(
    'player',
    playerFactionType,
    STARTING_POSITIONS.player
  );
  
  const enemyBuildings = createStartingBuildings(
    'enemy',
    enemyFactionType,
    STARTING_POSITIONS.enemy
  );
  
  // Build entity index
  const entityIndex = new Map<string, 'unit' | 'building' | 'projectile' | 'resource'>();
  
  [...playerUnits, ...enemyUnits].forEach(u => entityIndex.set(u.id, 'unit'));
  [...playerBuildings, ...enemyBuildings].forEach(b => entityIndex.set(b.id, 'building'));
  map.resourceNodes.forEach(r => entityIndex.set(r.id, 'resource'));
  
  // Create simulation meta
  const simulation: SimulationMeta = {
    tick: 0,
    gameTime: 0,
    phase: 'running',
    difficulty: config.difficulty,
    rngSeed: seed,
  };
  
  return {
    simulation,
    units: [...playerUnits, ...enemyUnits],
    buildings: [...playerBuildings, ...enemyBuildings],
    projectiles: [],
    map,
    factions,
    pendingCommands: [],
    selectedEntityIds: [],
    entityIndex,
  };
}

/**
 * Create a minimal test state for unit tests
 */
export function createTestState(overrides?: Partial<GameStateV2>): GameStateV2 {
  const base = createInitialState({
    difficulty: 'normal',
    playerFactionType: 'altera',
    seed: 12345,
  });
  
  return {
    ...base,
    ...overrides,
  };
}
