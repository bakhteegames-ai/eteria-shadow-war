/**
 * Eteria: Shadow War - Combat System
 * 
 * Handles unit combat:
 * - Target acquisition
 * - Attack cooldown
 * - Damage calculation
 * - Death and cleanup
 */

import type { 
  GameStateV2, 
  Unit, 
  Building,
  Vec3,
  EntityId,
} from '../core/types';
import { 
  isUnitAlive, 
  isBuildingAlive, 
  worldDistance,
} from '../core/model';
import { 
  findNearestEnemyUnit,
  getUnitById,
  getBuildingById,
} from '../core/queries';
import { COMBAT_CONFIG, UNIT_STATS } from '../core/constants';

// ============================================================================
// COMBAT PROCESSING
// ============================================================================

/**
 * Process combat for all units
 */
export function processCombat(state: GameStateV2, dt: number): GameStateV2 {
  let newUnits = [...state.units];
  let newBuildings = [...state.buildings];
  
  // Process each combat unit
  for (let i = 0; i < newUnits.length; i++) {
    const unit = newUnits[i];
    
    // Skip dead units, workers, and idle units
    if (!isUnitAlive(unit)) continue;
    if (unit.type === 'worker') continue;
    
    const result = processUnitCombat(
      unit,
      i,
      newUnits,
      newBuildings,
      dt
    );
    
    newUnits = result.units;
    newBuildings = result.buildings;
  }
  
  // Remove dead units
  newUnits = newUnits.filter(u => u.health > 0);
  
  // Remove dead buildings
  newBuildings = newBuildings.filter(b => b.health > 0);
  
  return {
    ...state,
    units: newUnits,
    buildings: newBuildings,
  };
}

// ============================================================================
// UNIT COMBAT
// ============================================================================

interface CombatResult {
  units: Unit[];
  buildings: Building[];
}

/**
 * Process combat for a single unit
 */
function processUnitCombat(
  unit: Unit,
  unitIndex: number,
  allUnits: Unit[],
  allBuildings: Building[],
  dt: number
): CombatResult {
  let units = [...allUnits];
  let buildings = [...allBuildings];
  
  // If unit has a target, attack it
  if (unit.targetEntityId) {
    return attackTarget(unit, unitIndex, units, buildings, dt);
  }
  
  // Otherwise, look for targets in range
  return acquireTarget(unit, unitIndex, units, buildings, dt);
}

/**
 * Attack assigned target
 */
function attackTarget(
  unit: Unit,
  unitIndex: number,
  units: Unit[],
  buildings: Building[],
  dt: number
): CombatResult {
  // Find target (can be unit or building)
  let targetUnitIndex = units.findIndex(u => u.id === unit.targetEntityId);
  let targetBuildingIndex = buildings.findIndex(b => b.id === unit.targetEntityId);
  
  // Target is a unit
  if (targetUnitIndex >= 0) {
    const target = units[targetUnitIndex];
    
    if (!isUnitAlive(target)) {
      // Target dead, look for new target
      return acquireTarget(unit, unitIndex, units, buildings, dt);
    }
    
    // Check range
    const dist = worldDistance(unit.position, target.position);
    
    if (dist > unit.stats.attackRange) {
      // Move toward target
      const moveResult = moveTowardTarget(unit, unitIndex, units, target.position, dt);
      return { ...moveResult, buildings };
    }
    
    // In range, attack
    const attackResult = performAttack(unit, unitIndex, targetUnitIndex, units, dt);
    return { ...attackResult, buildings };
  }
  
  // Target is a building
  if (targetBuildingIndex >= 0) {
    const target = buildings[targetBuildingIndex];
    
    if (!isBuildingAlive(target)) {
      // Target destroyed, look for new target
      return acquireTarget(unit, unitIndex, units, buildings, dt);
    }
    
    // Check range
    const dist = worldDistance(unit.position, target.position);
    
    if (dist > unit.stats.attackRange) {
      // Move toward target
      const moveResult = moveTowardTarget(unit, unitIndex, units, target.position, dt);
      return { units: moveResult.units, buildings };
    }
    
    // In range, attack
    return attackBuilding(unit, unitIndex, targetBuildingIndex, units, buildings, dt);
  }
  
  // Target not found
  return acquireTarget(unit, unitIndex, units, buildings, dt);
}

/**
 * Look for a target to attack
 */
function acquireTarget(
  unit: Unit,
  unitIndex: number,
  units: Unit[],
  buildings: Building[],
  dt: number
): CombatResult {
  // Find nearest enemy unit in acquisition range
  const acquisitionRange = unit.stats.attackRange * COMBAT_CONFIG.acquisitionRangeMultiplier;
  
  let nearestEnemy: Unit | undefined;
  let nearestDist = Infinity;
  
  for (const enemy of units) {
    if (enemy.factionId === unit.factionId) continue;
    if (!isUnitAlive(enemy)) continue;
    
    const dist = worldDistance(unit.position, enemy.position);
    if (dist < nearestDist && dist <= acquisitionRange) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }
  
  if (nearestEnemy) {
    // Acquired target
    units[unitIndex] = {
      ...unit,
      targetEntityId: nearestEnemy.id,
      state: 'attacking',
    };
    
    return { units, buildings };
  }
  
  // No targets, stay idle
  units[unitIndex] = {
    ...unit,
    targetEntityId: undefined,
    state: 'idle',
  };
  
  return { units, buildings };
}

/**
 * Perform attack on unit
 */
function performAttack(
  unit: Unit,
  unitIndex: number,
  targetIndex: number,
  units: Unit[],
  dt: number
): CombatResult {
  const target = units[targetIndex];
  
  // Update cooldown
  let newCooldown = unit.attackCooldown - dt;
  
  if (newCooldown > 0) {
    // Still on cooldown
    units[unitIndex] = { ...unit, attackCooldown: newCooldown };
    return { units, buildings: [] };
  }
  
  // Attack!
  const damage = calculateDamage(unit.stats.damage, target.stats.armor);
  const newTargetHealth = target.health - damage;
  
  // Apply attack
  units = [...units];
  units[targetIndex] = {
    ...target,
    health: Math.max(0, newTargetHealth),
  };
  
  // Reset cooldown
  const cooldownTime = 1 / unit.stats.attackSpeed;
  units[unitIndex] = {
    ...unit,
    attackCooldown: cooldownTime,
  };
  
  // Log attack (for debugging)
  // console.log(`[Combat] ${unit.type} dealt ${damage} damage to ${target.type}`);
  
  return { units, buildings: [] };
}

/**
 * Attack a building
 */
function attackBuilding(
  unit: Unit,
  unitIndex: number,
  targetIndex: number,
  units: Unit[],
  buildings: Building[],
  dt: number
): CombatResult {
  const target = buildings[targetIndex];
  
  // Update cooldown
  let newCooldown = unit.attackCooldown - dt;
  
  if (newCooldown > 0) {
    units[unitIndex] = { ...unit, attackCooldown: newCooldown };
    return { units, buildings };
  }
  
  // Attack!
  const damage = calculateDamage(unit.stats.damage, target.stats.armor);
  const newTargetHealth = target.health - damage;
  
  // Apply attack
  buildings = [...buildings];
  buildings[targetIndex] = {
    ...target,
    health: Math.max(0, newTargetHealth),
  };
  
  // Reset cooldown
  const cooldownTime = 1 / unit.stats.attackSpeed;
  units[unitIndex] = {
    ...unit,
    attackCooldown: cooldownTime,
  };
  
  return { units, buildings };
}

/**
 * Move unit toward target position
 */
function moveTowardTarget(
  unit: Unit,
  unitIndex: number,
  units: Unit[],
  targetPos: Vec3,
  dt: number
): CombatResult {
  const dx = targetPos.x - unit.position.x;
  const dz = targetPos.z - unit.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  
  if (dist < 0.1) {
    return { units, buildings: [] };
  }
  
  const speed = unit.stats.moveSpeed * dt;
  const moveX = (dx / dist) * speed;
  const moveZ = (dz / dist) * speed;
  
  units[unitIndex] = {
    ...unit,
    position: {
      x: unit.position.x + moveX,
      y: 0,
      z: unit.position.z + moveZ,
    },
  };
  
  return { units, buildings: [] };
}

// ============================================================================
// DAMAGE CALCULATION
// ============================================================================

/**
 * Calculate damage after armor reduction
 */
function calculateDamage(baseDamage: number, armor: number): number {
  // Formula: damage * (100 / (100 + armor))
  // This means each point of armor reduces damage by ~1%
  const reduction = COMBAT_CONFIG.armorEffectiveness / 
    (COMBAT_CONFIG.armorEffectiveness + armor);
  const damage = baseDamage * reduction;
  
  // Minimum damage
  return Math.max(COMBAT_CONFIG.minimumDamage, damage);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a unit can attack a target
 */
export function canAttack(unit: Unit, targetPos: Vec3): boolean {
  const dist = worldDistance(unit.position, targetPos);
  return dist <= unit.stats.attackRange;
}

/**
 * Get attack range for unit type
 */
export function getAttackRange(unitType: string): number {
  return UNIT_STATS[unitType as keyof typeof UNIT_STATS]?.attackRange ?? 1.5;
}

/**
 * Count units in combat for a faction
 */
export function countCombatUnits(state: GameStateV2, factionId: string): number {
  return state.units.filter(u => 
    u.factionId === factionId && 
    u.type !== 'worker' &&
    isUnitAlive(u)
  ).length;
}

/**
 * Count total health for a faction's units
 */
export function getTotalHealth(state: GameStateV2, factionId: string): number {
  return state.units
    .filter(u => u.factionId === factionId && isUnitAlive(u))
    .reduce((sum, u) => sum + u.health, 0);
}
