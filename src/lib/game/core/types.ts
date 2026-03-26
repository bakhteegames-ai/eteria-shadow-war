/**
 * Eteria: Shadow War - Canonical Game Types
 * 
 * This is the SINGLE SOURCE OF TRUTH for all game state types.
 * No other file should define gameplay-related types.
 * 
 * Design principles:
 * - Dense arrays for hot loops (units, buildings, projectiles)
 * - Readonly snapshots for UI/React consumption
 * - Deterministic simulation (seeded RNG, no Math.random in systems)
 */

// ============================================================================
// PRIMITIVE TYPES
// ============================================================================

/** Faction identifier */
export type FactionId = 'player' | 'enemy';

/** Faction configuration for both sides */
export type FactionType = 'altera' | 'draktar';

/** Unit types available in game */
export type UnitType = 'worker' | 'warrior' | 'archer' | 'knight' | 'mage';

/** Building types available in game */
export type BuildingType = 'townCenter' | 'barracks' | 'stable' | 'tower' | 'academy';

/** Resource types */
export type ResourceType = 'crystals' | 'essence';

/** AI difficulty levels */
export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'expert';

/** Game phase for state machine */
export type GamePhase = 'initializing' | 'running' | 'paused' | 'victory' | 'defeat';

/** Worker FSM states */
export type WorkerState = 
  | 'idle'
  | 'movingToResource'
  | 'gathering'
  | 'movingToDropoff'
  | 'delivering'
  | 'returningToResource'
  | 'building'
  | 'dead';

/** Generic unit states */
export type UnitState = 
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'gathering'       // Worker gathering resources
  | 'building'        // Worker constructing building
  | 'movingToResource' // Worker moving to resource node
  | 'movingToDropoff'  // Worker carrying resources to building
  | 'delivering'       // Worker depositing resources
  | 'returningToResource' // Worker going back to gather more
  | 'dead';

// ============================================================================
// VECTOR TYPES
// ============================================================================

/** 2D vector for grid positions */
export interface Vec2 {
  x: number;
  y: number;
}

/** 3D vector for world positions */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// STATS TYPES
// ============================================================================

/** Unit combat and movement stats */
export interface UnitStats {
  maxHealth: number;
  damage: number;
  armor: number;
  moveSpeed: number;
  attackRange: number;
  attackSpeed: number;  // Attacks per second
  sightRange: number;
  cost: ResourceCost;
  trainTime: number;  // Seconds to train
}

/** Building stats */
export interface BuildingStats {
  maxHealth: number;
  armor: number;
  cost: ResourceCost;
  buildTime: number;  // Seconds to build
  producesUnits?: UnitType[];
  rallyPointOffset?: Vec2;  // Default offset from building center
}

/** Resource cost */
export interface ResourceCost {
  crystals: number;
  essence: number;
}

// ============================================================================
// ENTITY TYPES
// ============================================================================

/** Unique entity identifier - deterministically generated */
export type EntityId = string;

/** Base entity fields shared by all entities */
export interface EntityBase {
  id: EntityId;
  factionId: FactionId;
  position: Vec3;
  health: number;
  isSelected: boolean;
}

/** Unit entity in simulation */
export interface Unit extends EntityBase {
  type: UnitType;
  state: UnitState;
  stats: UnitStats;
  
  // Movement
  targetPosition?: Vec3;
  path?: Vec2[];  // Waypoints from pathfinding
  
  // Combat
  targetEntityId?: EntityId;
  attackCooldown: number;  // Time until next attack
  
  // Worker-specific
  carryingResource?: ResourceType;
  carryingAmount: number;
  targetResourceId?: EntityId;
  targetBuildingId?: EntityId;  // For construction or dropoff
}

/** Building entity in simulation */
export interface Building extends EntityBase {
  type: BuildingType;
  stats: BuildingStats;
  
  // Construction
  isConstructing: boolean;
  constructionProgress: number;  // 0-100
  builderId?: EntityId;  // Worker assigned to construction
  
  // Production
  productionQueue: ProductionQueueItem[];
  
  // Rally point
  rallyPoint: Vec2;
}

/** Production queue item */
export interface ProductionQueueItem {
  unitType: UnitType;
  progress: number;  // Seconds elapsed
  totalTime: number;  // Total seconds to complete
}

/** Projectile for ranged attacks */
export interface Projectile {
  id: EntityId;
  factionId: FactionId;
  position: Vec3;
  targetEntityId: EntityId;
  damage: number;
  speed: number;
  projectileType: 'arrow' | 'spell';
}

// ============================================================================
// MAP TYPES
// ============================================================================

/** Map tile types */
export type TileType = 'grass' | 'water' | 'mountain' | 'forest';

/** Individual map tile */
export interface MapTile {
  type: TileType;
  isWalkable: boolean;
  isBuildable: boolean;
  occupantId?: EntityId;  // Building occupying this tile
}

/** Resource node on map */
export interface ResourceNode {
  id: EntityId;
  type: ResourceType;
  position: Vec2;
  gridPosition: Vec2;
  amount: number;  // Remaining resources
  maxAmount: number;  // Original amount
}

/** Map state */
export interface MapState {
  width: number;  // Grid width
  height: number;  // Grid height
  tileSize: number;  // World units per tile
  tiles: MapTile[][];
  resourceNodes: ResourceNode[];
}

// ============================================================================
// FACTION STATE
// ============================================================================

/** Faction economy and command state */
export interface FactionState {
  id: FactionId;
  factionType: FactionType;
  resources: ResourcePool;
  isAI: boolean;
  aiDifficulty?: DifficultyLevel;
}

/** Resource pool */
export interface ResourcePool {
  crystals: number;
  essence: number;
}

// ============================================================================
// SIMULATION META
// ============================================================================

/** Simulation metadata */
export interface SimulationMeta {
  tick: number;  // Total ticks elapsed
  gameTime: number;  // Total seconds elapsed
  phase: GamePhase;
  difficulty: DifficultyLevel;
  rngSeed: number;  // For deterministic random
  victoryFactionId?: FactionId;
}

// ============================================================================
// COMMAND TYPES
// ============================================================================

/** Base command interface */
export interface CommandBase {
  type: string;
  factionId: FactionId;
  tick: number;  // When command was issued
}

/** Select units command */
export interface SelectCommand extends CommandBase {
  type: 'SELECT';
  entityIds: EntityId[];
  addToSelection: boolean;  // Shift+click behavior
}

/** Move units command */
export interface MoveCommand extends CommandBase {
  type: 'MOVE';
  entityIds: EntityId[];
  targetPosition: Vec3;
}

/** Attack target command */
export interface AttackCommand extends CommandBase {
  type: 'ATTACK';
  entityIds: EntityId[];
  targetEntityId: EntityId;
}

/** Attack move command (move + attack enemies on the way) */
export interface AttackMoveCommand extends CommandBase {
  type: 'ATTACK_MOVE';
  entityIds: EntityId[];
  targetPosition: Vec3;
}

/** Stop command */
export interface StopCommand extends CommandBase {
  type: 'STOP';
  entityIds: EntityId[];
}

/** Build building command (for workers) */
export interface BuildCommand extends CommandBase {
  type: 'BUILD';
  workerId: EntityId;
  buildingType: BuildingType;
  position: Vec2;  // Grid position
}

/** Train unit command */
export interface TrainCommand extends CommandBase {
  type: 'TRAIN';
  buildingId: EntityId;
  unitType: UnitType;
}

/** Set rally point command */
export interface SetRallyPointCommand extends CommandBase {
  type: 'SET_RALLY_POINT';
  buildingId: EntityId;
  position: Vec2;
}

/** Gather resource command (for workers) */
export interface GatherCommand extends CommandBase {
  type: 'GATHER';
  workerIds: EntityId[];
  resourceNodeId: EntityId;
}

/** Cancel production command */
export interface CancelCommand extends CommandBase {
  type: 'CANCEL';
  buildingId: EntityId;
  queueIndex: number;
}

/** Pause/resume game command */
export interface PauseCommand extends CommandBase {
  type: 'PAUSE';
  pause: boolean;
}

/** Union of all command types */
export type GameCommand = 
  | SelectCommand
  | MoveCommand
  | AttackCommand
  | AttackMoveCommand
  | StopCommand
  | BuildCommand
  | TrainCommand
  | SetRallyPointCommand
  | GatherCommand
  | CancelCommand
  | PauseCommand;

// ============================================================================
// GAME STATE V2
// ============================================================================

/** 
 * Complete game state - the single source of truth
 * 
 * Design notes:
 * - Dense arrays for hot loops (units, buildings)
 * - No nested faction objects - flat structure
 * - Entities have factionId field for filtering
 */
export interface GameStateV2 {
  // Simulation metadata
  simulation: SimulationMeta;
  
  // Entities (dense arrays for hot loops)
  units: Unit[];
  buildings: Building[];
  projectiles: Projectile[];
  
  // Map
  map: MapState;
  
  // Factions
  factions: Record<FactionId, FactionState>;
  
  // Pending commands to process
  pendingCommands: GameCommand[];
  
  // Selection state (UI convenience)
  selectedEntityIds: EntityId[];
  
  // Entity lookup (for quick access, NOT authoritative storage)
  entityIndex: Map<EntityId, 'unit' | 'building' | 'projectile' | 'resource'>;
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

/** Game configuration for initialization */
export interface GameConfig {
  difficulty: DifficultyLevel;
  playerFactionType: FactionType;
  seed?: number;  // For deterministic testing
}

/** AI configuration per difficulty */
export interface AIConfig {
  reactionTime: number;  // Ms between AI decisions
  aggressionLevel: number;  // 0-1, threshold for attacks
  economyFocus: number;  // 0-1, worker production priority
  expansionRate: number;  // 0-1, building priority
  attackWaveSize: number;  // Units per wave
  attackWaveInterval: number;  // Seconds between waves
}
