/**
 * Eteria: Shadow War - Game Model
 * 
 * Entity factories and composite types.
 * All entity creation should go through these factories for consistency.
 */

import type {
  EntityId,
  Unit,
  Building,
  Projectile,
  ResourceNode,
  UnitType,
  BuildingType,
  FactionId,
  UnitStats,
  BuildingStats,
  Vec2,
  Vec3,
} from './types';
import { UNIT_STATS, BUILDING_STATS, MAP_SIZE } from './constants';

// ============================================================================
// ID GENERATION
// ============================================================================

/** 
 * Deterministic ID generator using a seeded counter
 * Format: {prefix}_{tick}_{counter}
 */
let globalTick = 0;
let idCounter = 0;

export function resetIdGenerator(tick: number = 0): void {
  globalTick = tick;
  idCounter = 0;
}

export function generateEntityId(prefix: string): EntityId {
  idCounter++;
  return `${prefix}_${globalTick}_${idCounter}`;
}

export function setGlobalTick(tick: number): void {
  globalTick = tick;
}

export function setCommandTick(tick: number): void {
  // Alias for consistency
  globalTick = tick;
}

// ============================================================================
// ENTITY FACTORIES
// ============================================================================

/** Create a new unit */
export function createUnit(
  type: UnitType,
  factionId: FactionId,
  position: Vec3,
  stats: UnitStats = UNIT_STATS[type]
): Unit {
  return {
    id: generateEntityId('u'),
    type,
    factionId,
    position: { ...position },
    health: stats.maxHealth,
    stats: { ...stats },
    isSelected: false,
    state: 'idle',
    attackCooldown: 0,
    carryingAmount: 0,
  };
}

/** Create a new building */
export function createBuilding(
  type: BuildingType,
  factionId: FactionId,
  position: Vec3,
  isPreBuilt: boolean = false
): Building {
  const stats = BUILDING_STATS[type];
  
  return {
    id: generateEntityId('b'),
    type,
    factionId,
    position: { ...position },
    health: isPreBuilt ? stats.maxHealth : 1,  // Start at 1 HP when constructing
    stats: { ...stats },
    isSelected: false,
    isConstructing: !isPreBuilt,
    constructionProgress: isPreBuilt ? 100 : 0,
    productionQueue: [],
    rallyPoint: {
      x: Math.floor(position.x / MAP_SIZE.tileSize) + (stats.rallyPointOffset?.x ?? 3),
      y: Math.floor(position.z / MAP_SIZE.tileSize) + (stats.rallyPointOffset?.y ?? 0),
    },
  };
}

/** Create a projectile */
export function createProjectile(
  factionId: FactionId,
  position: Vec3,
  targetEntityId: EntityId,
  damage: number,
  projectileType: 'arrow' | 'spell' = 'arrow'
): Projectile {
  return {
    id: generateEntityId('p'),
    factionId,
    position: { ...position },
    targetEntityId,
    damage,
    speed: projectileType === 'arrow' ? 15 : 12,
    projectileType,
  };
}

/** Create a resource node */
export function createResourceNode(
  type: 'crystals' | 'essence',
  position: Vec2,
  amount: number
): ResourceNode {
  return {
    id: generateEntityId('r'),
    type,
    position: { ...position },
    gridPosition: {
      x: Math.floor(position.x / MAP_SIZE.tileSize),
      y: Math.floor(position.y / MAP_SIZE.tileSize),
    },
    amount,
    maxAmount: amount,
  };
}

// ============================================================================
// POSITION HELPERS
// ============================================================================

/** Convert grid position to world position */
export function gridToWorld(gridPos: Vec2): Vec3 {
  return {
    x: gridPos.x * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2,
    y: 0,
    z: gridPos.y * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2,
  };
}

/** Convert world position to grid position */
export function worldToGrid(worldPos: Vec3): Vec2 {
  return {
    x: Math.floor(worldPos.x / MAP_SIZE.tileSize),
    y: Math.floor(worldPos.z / MAP_SIZE.tileSize),
  };
}

/** Calculate distance between two world positions */
export function worldDistance(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Calculate distance between two grid positions */
export function gridDistance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Check if a position is within map bounds */
export function isInBounds(gridPos: Vec2): boolean {
  return gridPos.x >= 0 && gridPos.x < MAP_SIZE.width &&
         gridPos.y >= 0 && gridPos.y < MAP_SIZE.height;
}

/** Clamp position to map bounds */
export function clampToBounds(gridPos: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(MAP_SIZE.width - 1, gridPos.x)),
    y: Math.max(0, Math.min(MAP_SIZE.height - 1, gridPos.y)),
  };
}

// ============================================================================
// SEeded RNG
// ============================================================================

/**
 * Simple seeded random number generator (Mulberry32)
 * Provides deterministic random for simulation
 */
export class SeededRNG {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  /** Get next random value between 0 and 1 */
  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  
  /** Get random integer in range [min, max] */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  /** Get random float in range [min, max] */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
  
  /** Shuffle an array in place using Fisher-Yates */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  /** Get current seed */
  getSeed(): number {
    return this.seed;
  }
}

// ============================================================================
// ENTITY UTILITIES
// ============================================================================

/** Check if unit is alive */
export function isUnitAlive(unit: Unit): boolean {
  return unit.health > 0 && unit.state !== 'dead';
}

/** Check if building is alive */
export function isBuildingAlive(building: Building): boolean {
  return building.health > 0;
}

/** Check if building is operational (built and not constructing) */
export function isBuildingOperational(building: Building): boolean {
  return isBuildingAlive(building) && !building.isConstructing;
}

/** Check if unit is a worker */
export function isWorker(unit: Unit): boolean {
  return unit.type === 'worker';
}

/** Check if unit is combat unit */
export function isCombatUnit(unit: Unit): boolean {
  return unit.type !== 'worker';
}

/** Get unit display name */
export function getUnitDisplayName(unit: Unit): string {
  const names: Record<UnitType, string> = {
    worker: 'Worker',
    warrior: 'Warrior',
    archer: 'Archer',
    knight: 'Knight',
    mage: 'Mage',
  };
  return names[unit.type];
}

/** Get building display name */
export function getBuildingDisplayName(building: Building): string {
  const names: Record<BuildingType, string> = {
    townCenter: 'Town Center',
    barracks: 'Barracks',
    stable: 'Stable',
    tower: 'Tower',
    academy: 'Academy',
  };
  return names[building.type];
}
