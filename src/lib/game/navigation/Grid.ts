/**
 * Eteria: Shadow War - Navigation Grid
 * 
 * Grid-based navigation system for pathfinding.
 * Handles walkability, building occupancy, and path queries.
 */

import type { Vec2, Vec3, EntityId, Building } from '../core/types';
import { BUILDING_FOOTPRINT, MAP_SIZE } from '../core/constants';

// ============================================================================
// GRID TYPES
// ============================================================================

/** Single tile in the navigation grid */
export interface NavTile {
  x: number;
  y: number;
  isWalkable: boolean;
  isBuildable: boolean;
  occupantId?: EntityId;
  occupantType?: 'building' | 'unit';
}

/** Navigation grid */
export interface NavGrid {
  width: number;
  height: number;
  tiles: NavTile[][];
}

/** Path finding result */
export interface PathResult {
  success: boolean;
  path: Vec2[];
  length: number;
}

// ============================================================================
// GRID CREATION
// ============================================================================

/**
 * Create an empty navigation grid
 */
export function createNavGrid(width: number = MAP_SIZE.width, height: number = MAP_SIZE.height): NavGrid {
  const tiles: NavTile[][] = [];
  
  for (let x = 0; x < width; x++) {
    tiles[x] = [];
    for (let y = 0; y < height; y++) {
      tiles[x][y] = {
        x,
        y,
        isWalkable: true,
        isBuildable: true,
      };
    }
  }
  
  return { width, height, tiles };
}

/**
 * Mark building footprints as occupied
 */
export function occupyBuildingFootprint(grid: NavGrid, building: Building): NavGrid {
  const footprint = BUILDING_FOOTPRINT[building.type];
  if (!footprint) return grid;
  
  // Get building grid position
  const gx = Math.floor(building.position.x / MAP_SIZE.tileSize);
  const gy = Math.floor(building.position.z / MAP_SIZE.tileSize);
  
  // Create new tiles array (immutable)
  const newTiles = grid.tiles.map(row => row.map(tile => ({ ...tile })));
  
  // Mark tiles as occupied
  for (let dx = 0; dx < footprint.width; dx++) {
    for (let dy = 0; dy < footprint.height; dy++) {
      const tx = gx + dx - Math.floor(footprint.width / 2);
      const ty = gy + dy - Math.floor(footprint.height / 2);
      
      if (tx >= 0 && tx < grid.width && ty >= 0 && ty < grid.height) {
        newTiles[tx][ty] = {
          ...newTiles[tx][ty],
          isWalkable: false,
          isBuildable: false,
          occupantId: building.id,
          occupantType: 'building',
        };
      }
    }
  }
  
  return { ...grid, tiles: newTiles };
}

/**
 * Clear building footprint from grid
 */
export function clearBuildingFootprint(grid: NavGrid, building: Building): NavGrid {
  const footprint = BUILDING_FOOTPRINT[building.type];
  if (!footprint) return grid;
  
  const gx = Math.floor(building.position.x / MAP_SIZE.tileSize);
  const gy = Math.floor(building.position.z / MAP_SIZE.tileSize);
  
  const newTiles = grid.tiles.map(row => row.map(tile => ({ ...tile })));
  
  for (let dx = 0; dx < footprint.width; dx++) {
    for (let dy = 0; dy < footprint.height; dy++) {
      const tx = gx + dx - Math.floor(footprint.width / 2);
      const ty = gy + dy - Math.floor(footprint.height / 2);
      
      if (tx >= 0 && tx < grid.width && ty >= 0 && ty < grid.height) {
        newTiles[tx][ty] = {
          ...newTiles[tx][ty],
          isWalkable: true,
          isBuildable: true,
          occupantId: undefined,
          occupantType: undefined,
        };
      }
    }
  }
  
  return { ...grid, tiles: newTiles };
}

// ============================================================================
// GRID QUERIES
// ============================================================================

/**
 * Get tile at grid position
 */
export function getTile(grid: NavGrid, x: number, y: number): NavTile | null {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
    return null;
  }
  return grid.tiles[x][y];
}

/**
 * Check if a grid position is walkable
 */
export function isWalkable(grid: NavGrid, x: number, y: number): boolean {
  const tile = getTile(grid, x, y);
  return tile?.isWalkable ?? false;
}

/**
 * Check if a grid position is buildable
 */
export function isBuildable(grid: NavGrid, x: number, y: number): boolean {
  const tile = getTile(grid, x, y);
  return tile?.isBuildable ?? false;
}

/**
 * Check if a world position is walkable
 */
export function isWorldWalkable(grid: NavGrid, worldPos: Vec3): boolean {
  const gx = Math.floor(worldPos.x / MAP_SIZE.tileSize);
  const gy = Math.floor(worldPos.z / MAP_SIZE.tileSize);
  return isWalkable(grid, gx, gy);
}

/**
 * Convert world position to grid position
 */
export function worldToGrid(worldPos: Vec3): Vec2 {
  return {
    x: Math.floor(worldPos.x / MAP_SIZE.tileSize),
    y: Math.floor(worldPos.z / MAP_SIZE.tileSize),
  };
}

/**
 * Convert grid position to world position (center of tile)
 */
export function gridToWorld(gridPos: Vec2): Vec3 {
  return {
    x: gridPos.x * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2,
    y: 0,
    z: gridPos.y * MAP_SIZE.tileSize + MAP_SIZE.tileSize / 2,
  };
}

/**
 * Get neighbors of a tile (4-directional)
 */
export function getNeighbors(grid: NavGrid, x: number, y: number): Vec2[] {
  const neighbors: Vec2[] = [];
  
  const dirs = [
    { dx: 0, dy: -1 },  // Up
    { dx: 1, dy: 0 },   // Right
    { dx: 0, dy: 1 },   // Down
    { dx: -1, dy: 0 },  // Left
  ];
  
  for (const dir of dirs) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    
    if (isWalkable(grid, nx, ny)) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  
  return neighbors;
}

/**
 * Get all neighbors including diagonals (8-directional)
 */
export function getNeighbors8(grid: NavGrid, x: number, y: number): Vec2[] {
  const neighbors: Vec2[] = [];
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      
      const nx = x + dx;
      const ny = y + dy;
      
      if (isWalkable(grid, nx, ny)) {
        // For diagonal movement, check if both adjacent tiles are walkable
        if (dx !== 0 && dy !== 0) {
          if (!isWalkable(grid, x + dx, y) || !isWalkable(grid, x, y + dy)) {
            continue;  // Can't cut corners
          }
        }
        neighbors.push({ x: nx, y: ny });
      }
    }
  }
  
  return neighbors;
}

/**
 * Calculate heuristic distance (Manhattan)
 */
export function heuristicManhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Calculate heuristic distance (Euclidean)
 */
export function heuristicEuclidean(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
