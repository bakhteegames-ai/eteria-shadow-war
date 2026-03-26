/**
 * Eteria: Shadow War - Game Constants
 * 
 * Single source of truth for all game balance and configuration values.
 * These values are used by the simulation systems.
 */

import type { UnitStats, BuildingStats, AIConfig, UnitType, BuildingType } from './types';

// ============================================================================
// MAP CONFIGURATION
// ============================================================================

/** World map size in grid tiles */
export const MAP_SIZE = {
  width: 40,   // Grid tiles
  height: 40,  // Grid tiles
  tileSize: 2, // World units per tile
} as const;

/** World dimensions in world units */
export const WORLD_SIZE = {
  width: MAP_SIZE.width * MAP_SIZE.tileSize,   // 80 world units
  height: MAP_SIZE.height * MAP_SIZE.tileSize, // 80 world units
} as const;

/** Starting positions (in grid coordinates) */
export const STARTING_POSITIONS = {
  player: { x: 8, y: 8 },   // Bottom-left area
  enemy: { x: 32, y: 32 },  // Top-right area
} as const;

// ============================================================================
// RESOURCE CONFIGURATION
// ============================================================================

/** Starting resources */
export const STARTING_RESOURCES = {
  crystals: 500,
  essence: 100,
} as const;

/** Resource node generation settings */
export const RESOURCE_NODE_CONFIG = {
  crystalNodes: 8,
  essenceNodes: 4,
  minDistanceFromStart: 8,  // Grid tiles
  resourcePerNode: {
    crystals: 1500,
    essence: 800,
  },
} as const;

/** Worker gathering configuration */
export const GATHER_CONFIG = {
  carryCapacity: 10,
  gatherTime: 2.0,        // Seconds per gather action
  depositTime: 0.5,       // Seconds to deposit at building
  gatherRange: 1.5,       // World units
} as const;

// ============================================================================
// UNIT STATS
// ============================================================================

/** Unit stats for all unit types */
export const UNIT_STATS: Record<UnitType, UnitStats> = {
  worker: {
    maxHealth: 40,
    damage: 5,
    armor: 0,
    moveSpeed: 3.5,
    attackRange: 1.5,
    attackSpeed: 1.0,
    sightRange: 10,
    cost: { crystals: 50, essence: 0 },
    trainTime: 5,
  },
  warrior: {
    maxHealth: 100,
    damage: 15,
    armor: 3,
    moveSpeed: 3.5,
    attackRange: 1.5,
    attackSpeed: 1.2,
    sightRange: 12,
    cost: { crystals: 100, essence: 0 },
    trainTime: 10,
  },
  archer: {
    maxHealth: 60,
    damage: 12,
    armor: 0,
    moveSpeed: 3.0,
    attackRange: 8,
    attackSpeed: 1.5,
    sightRange: 15,
    cost: { crystals: 80, essence: 0 },
    trainTime: 8,
  },
  knight: {
    maxHealth: 150,
    damage: 25,
    armor: 5,
    moveSpeed: 5.0,
    attackRange: 1.5,
    attackSpeed: 0.8,
    sightRange: 12,
    cost: { crystals: 150, essence: 25 },
    trainTime: 15,
  },
  mage: {
    maxHealth: 70,
    damage: 30,
    armor: 0,
    moveSpeed: 2.5,
    attackRange: 7,
    attackSpeed: 0.6,
    sightRange: 14,
    cost: { crystals: 120, essence: 50 },
    trainTime: 12,
  },
};

// ============================================================================
// BUILDING STATS
// ============================================================================

/** Building stats for all building types */
export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  townCenter: {
    maxHealth: 1500,
    armor: 5,
    cost: { crystals: 500, essence: 0 },
    buildTime: 60,
    producesUnits: ['worker'],
    rallyPointOffset: { x: 3, y: 0 },
  },
  barracks: {
    maxHealth: 800,
    armor: 3,
    cost: { crystals: 200, essence: 0 },
    buildTime: 30,
    producesUnits: ['warrior', 'archer'],
    rallyPointOffset: { x: 2, y: 0 },
  },
  stable: {
    maxHealth: 900,
    armor: 3,
    cost: { crystals: 300, essence: 50 },
    buildTime: 40,
    producesUnits: ['knight'],
    rallyPointOffset: { x: 2, y: 0 },
  },
  tower: {
    maxHealth: 600,
    armor: 4,
    cost: { crystals: 150, essence: 25 },
    buildTime: 20,
  },
  academy: {
    maxHealth: 700,
    armor: 2,
    cost: { crystals: 250, essence: 100 },
    buildTime: 45,
    producesUnits: ['mage'],
    rallyPointOffset: { x: 2, y: 0 },
  },
};

/** Building footprint in grid tiles */
export const BUILDING_FOOTPRINT: Record<BuildingType, { width: number; height: number }> = {
  townCenter: { width: 4, height: 4 },
  barracks: { width: 3, height: 3 },
  stable: { width: 3, height: 3 },
  tower: { width: 2, height: 2 },
  academy: { width: 3, height: 3 },
};

// ============================================================================
// COMBAT CONFIGURATION
// ============================================================================

export const COMBAT_CONFIG = {
  /** Damage formula: damage * (100 / (100 + armor)) */
  armorEffectiveness: 100,
  
  /** Minimum damage after armor reduction */
  minimumDamage: 1,
  
  /** Attack acquisition range multiplier (attackRange * this = acquisition range) */
  acquisitionRangeMultiplier: 1.5,
  
  /** Projectile speed for ranged units */
  projectileSpeed: {
    arrow: 15,
    spell: 12,
  },
  
  /** Max distance to chase a target before giving up */
  chaseDistance: 20,
} as const;

// ============================================================================
// AI CONFIGURATION
// ============================================================================

/** AI configuration per difficulty level */
export const AI_CONFIGS: Record<string, AIConfig> = {
  easy: {
    reactionTime: 2000,    // 2 seconds
    aggressionLevel: 0.2,  // Very defensive
    economyFocus: 0.8,     // Heavy economy
    expansionRate: 0.3,    // Slow building
    attackWaveSize: 3,
    attackWaveInterval: 45, // 45 seconds
  },
  normal: {
    reactionTime: 1000,    // 1 second
    aggressionLevel: 0.5,  // Balanced
    economyFocus: 0.5,
    expansionRate: 0.5,
    attackWaveSize: 5,
    attackWaveInterval: 30,
  },
  hard: {
    reactionTime: 500,     // 0.5 seconds
    aggressionLevel: 0.7,  // Aggressive
    economyFocus: 0.3,
    expansionRate: 0.7,
    attackWaveSize: 7,
    attackWaveInterval: 20,
  },
  expert: {
    reactionTime: 250,     // 0.25 seconds
    aggressionLevel: 0.9,  // Very aggressive
    economyFocus: 0.2,
    expansionRate: 0.9,
    attackWaveSize: 10,
    attackWaveInterval: 15,
  },
};

// ============================================================================
// SIMULATION CONFIGURATION
// ============================================================================

export const SIMULATION_CONFIG = {
  /** Fixed timestep for simulation (ms) */
  fixedTimestep: 1000 / 60,  // 60 FPS equivalent
  
  /** Max frame time to prevent spiral of death (ms) */
  maxFrameTime: 100,  // Don't simulate more than 100ms per frame
  
  /** How many ticks per game second */
  ticksPerSecond: 60,
  
  /** Starting units configuration */
  startingUnits: {
    player: {
      workers: 2,
      warriors: 2,
    },
    enemy: {
      workers: 2,
      warriors: 2,
    },
  },
} as const;

// ============================================================================
// VICTORY CONDITIONS
// ============================================================================

export const VICTORY_CONFIG = {
  /** Buildings whose destruction triggers defeat */
  criticalBuildings: ['townCenter'] as BuildingType[],
  
  /** Time without enemy units before declaring victory (seconds) */
  noEnemyUnitsTimeout: 10,
} as const;

// ============================================================================
// FACTION DISPLAY
// ============================================================================

export const FACTION_CONFIG = {
  altera: {
    name: 'Altera',
    color: '#3B82F6',      // Blue
    secondaryColor: '#F59E0B', // Gold
    description: 'The noble human kingdom. Masters of strategy and arcane arts.',
  },
  draktar: {
    name: "Drak'Tar",
    color: '#EF4444',      // Red
    secondaryColor: '#1F2937', // Dark gray
    description: 'The fierce orcish horde. Brutal strength and dark shamanism.',
  },
} as const;

// ============================================================================
// UNIT DISPLAY NAMES
// ============================================================================

export const UNIT_NAMES: Record<UnitType, string> = {
  worker: 'Worker',
  warrior: 'Warrior',
  archer: 'Archer',
  knight: 'Knight',
  mage: 'Mage',
};

export const BUILDING_NAMES: Record<BuildingType, string> = {
  townCenter: 'Town Center',
  barracks: 'Barracks',
  stable: 'Stable',
  tower: 'Tower',
  academy: 'Academy',
};
