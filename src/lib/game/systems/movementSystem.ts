/**
 * Eteria: Shadow War - Movement System
 * 
 * Handles unit movement with pathfinding integration.
 * Units follow waypoints and respect terrain.
 */

import type { 
  GameStateV2, 
  Unit, 
  Vec3,
  Vec2,
} from '../core/types';
import type { NavGrid } from '../navigation/Grid';
import { isUnitAlive, worldDistance } from '../core/model';
import { findPath, pathToWorldPositions } from '../navigation/Pathfinder';
import { createNavGrid, occupyBuildingFootprint, worldToGrid, isWalkable } from '../navigation/Grid';
import { MAP_SIZE } from '../core/constants';

// ============================================================================
// MOVEMENT PROCESSING
// ============================================================================

/**
 * Process movement for all units
 */
export function processMovement(state: GameStateV2, dt: number): GameStateV2 {
  // Build navigation grid from current state
  const grid = buildNavGrid(state);
  
  // Process each unit
  const newUnits = state.units.map(unit => {
    if (!isUnitAlive(unit)) return unit;
    if (unit.state === 'dead') return unit;
    
    return processUnitMovement(unit, grid, state, dt);
  });
  
  return {
    ...state,
    units: newUnits,
  };
}

/**
 * Build navigation grid from current game state
 */
function buildNavGrid(state: GameStateV2): NavGrid {
  let grid = createNavGrid();
  
  // Mark building footprints as obstacles
  for (const building of state.buildings) {
    grid = occupyBuildingFootprint(grid, building);
  }
  
  return grid;
}

/**
 * Process movement for a single unit
 */
function processUnitMovement(
  unit: Unit,
  grid: NavGrid,
  state: GameStateV2,
  dt: number
): Unit {
  // Skip if not moving
  if (unit.state !== 'moving' && unit.state !== 'movingToResource' && unit.state !== 'movingToDropoff') {
    return unit;
  }
  
  // Skip if no target
  if (!unit.targetPosition) {
    return { ...unit, state: 'idle' };
  }
  
  // Check if we need to compute path
  if (!unit.path || unit.path.length === 0) {
    const path = computePath(unit, unit.targetPosition, grid);
    if (!path.success) {
      // Can't reach target, go idle
      return { ...unit, state: 'idle', targetPosition: undefined };
    }
    return { ...unit, path: path.path };
  }
  
  // Follow path
  return followPath(unit, grid, dt);
}

/**
 * Compute path to target
 */
function computePath(
  unit: Unit,
  target: Vec3,
  grid: NavGrid
): { success: boolean; path: Vec2[] } {
  const start = worldToGrid(unit.position);
  const end = worldToGrid(target);
  
  // Simple pathfinding
  const result = findPath(grid, start, end);
  
  if (result.success) {
    // Convert to world positions stored in path (we'll convert on use)
    return { success: true, path: result.path };
  }
  
  return { success: false, path: [] };
}

/**
 * Follow computed path
 */
function followPath(unit: Unit, grid: NavGrid, dt: number): Unit {
  if (!unit.path || unit.path.length === 0) {
    return { ...unit, state: 'idle', path: undefined };
  }
  
  // Get current waypoint
  const currentWaypoint = unit.path[0];
  const targetWorld: Vec3 = {
    x: currentWaypoint.x * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2,
    y: 0,
    z: currentWaypoint.y * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2,
  };
  
  // Calculate distance to waypoint
  const dist = worldDistance(unit.position, targetWorld);
  
  // Check if reached waypoint
  if (dist < 0.5) {
    // Remove waypoint
    const newPath = unit.path.slice(1);
    
    if (newPath.length === 0) {
      // Reached final destination
      return {
        ...unit,
        state: 'idle',
        path: undefined,
        targetPosition: undefined,
      };
    }
    
    return { ...unit, path: newPath };
  }
  
  // Move toward waypoint
  const speed = unit.stats.moveSpeed * dt;
  const dx = targetWorld.x - unit.position.x;
  const dz = targetWorld.z - unit.position.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  
  // Normalize and apply speed
  const moveX = (dx / d) * speed;
  const moveZ = (dz / d) * speed;
  
  // Calculate new position
  let newX = unit.position.x + moveX;
  let newZ = unit.position.z + moveZ;
  
  // Clamp to map bounds
  newX = Math.max(1, Math.min(MAP_SIZE.width * MAP_SIZE.tileSize - 1, newX));
  newZ = Math.max(1, Math.min(MAP_SIZE.height * MAP_SIZE.tileSize - 1, newZ));
  
  return {
    ...unit,
    position: { ...unit.position, x: newX, z: newZ },
  };
}

// ============================================================================
// PATH COMPUTATION
// ============================================================================

/**
 * Compute and set path for a unit
 */
export function setUnitPath(
  unit: Unit,
  targetPosition: Vec3,
  grid: NavGrid
): Unit {
  const start = worldToGrid(unit.position);
  const end = worldToGrid(targetPosition);
  
  const result = findPath(grid, start, end);
  
  if (result.success) {
    return {
      ...unit,
      path: result.path,
      targetPosition,
      state: 'moving',
    };
  }
  
  // No path found
  return {
    ...unit,
    path: undefined,
    targetPosition: undefined,
    state: 'idle',
  };
}

/**
 * Compute path to a specific entity
 */
export function setUnitPathToEntity(
  unit: Unit,
  targetEntityId: string,
  state: GameStateV2,
  grid: NavGrid
): Unit {
  // Find target entity
  const targetUnit = state.units.find(u => u.id === targetEntityId);
  const targetBuilding = state.buildings.find(b => b.id === targetEntityId);
  
  const targetPos = targetUnit?.position ?? targetBuilding?.position;
  if (!targetPos) {
    return unit;
  }
  
  return setUnitPath(unit, targetPos, grid);
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { createNavGrid, occupyBuildingFootprint, worldToGrid };
