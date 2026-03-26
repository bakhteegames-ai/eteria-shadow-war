/**
 * Eteria: Shadow War - Pathfinder
 * 
 * A* pathfinding implementation for navigation grid.
 */

import type { Vec2, Vec3 } from '../core/types';
import type { NavGrid, PathResult } from './Grid';
import { 
  getTile, 
  isWalkable, 
  getNeighbors, 
  heuristicEuclidean 
} from './Grid';

// ============================================================================
// A* PATHFINDING
// ============================================================================

/** Node in the pathfinding open set */
interface PathNode {
  x: number;
  y: number;
  g: number;  // Cost from start
  h: number;  // Heuristic to goal
  f: number;  // Total cost (g + h)
  parent?: PathNode;
}

/**
 * Find path using A* algorithm
 */
export function findPath(
  grid: NavGrid,
  start: Vec2,
  end: Vec2,
  options?: {
    maxIterations?: number;
    diagonalMovement?: boolean;
  }
): PathResult {
  const maxIterations = options?.maxIterations ?? 1000;
  
  // Check if start and end are walkable
  if (!isWalkable(grid, start.x, start.y)) {
    return { success: false, path: [], length: 0 };
  }
  if (!isWalkable(grid, end.x, end.y)) {
    // Try to find nearest walkable tile to end
    const nearestWalkable = findNearestWalkable(grid, end);
    if (!nearestWalkable) {
      return { success: false, path: [], length: 0 };
    }
    end = nearestWalkable;
  }
  
  // Check if start equals end
  if (start.x === end.x && start.y === end.y) {
    return { success: true, path: [start], length: 0 };
  }
  
  // Initialize open and closed sets
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  
  // Add start node
  const startNode: PathNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristicEuclidean(start, end),
    f: heuristicEuclidean(start, end),
  };
  openSet.push(startNode);
  
  let iterations = 0;
  
  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    
    // Get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    
    // Check if we reached the goal
    if (current.x === end.x && current.y === end.y) {
      const path = reconstructPath(current);
      return {
        success: true,
        path,
        length: path.length - 1,
      };
    }
    
    // Add to closed set
    closedSet.add(`${current.x},${current.y}`);
    
    // Check neighbors
    const neighbors = getNeighbors(grid, current.x, current.y);
    
    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;
      
      // Skip if in closed set
      if (closedSet.has(key)) continue;
      
      // Calculate costs
      const moveCost = 1;  // Could be variable based on terrain
      const g = current.g + moveCost;
      const h = heuristicEuclidean(neighbor, end);
      const f = g + h;
      
      // Check if already in open set with better path
      const existing = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
      
      if (existing) {
        if (g < existing.g) {
          // Found better path to this node
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
      } else {
        // Add new node
        openSet.push({
          x: neighbor.x,
          y: neighbor.y,
          g,
          h,
          f,
          parent: current,
        });
      }
    }
  }
  
  // No path found
  return { success: false, path: [], length: 0 };
}

/**
 * Reconstruct path from end node
 */
function reconstructPath(node: PathNode): Vec2[] {
  const path: Vec2[] = [];
  let current: PathNode | undefined = node;
  
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  
  return path;
}

/**
 * Find nearest walkable tile to a position
 */
function findNearestWalkable(grid: NavGrid, pos: Vec2, maxRadius: number = 5): Vec2 | null {
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;  // Only check perimeter
        
        const nx = pos.x + dx;
        const ny = pos.y + dy;
      
        if (isWalkable(grid, nx, ny)) {
        return { x: nx, y: ny };
      }
    }
    }
  }
  
  return null;
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Simplify path by removing unnecessary waypoints
 */
export function simplifyPath(grid: NavGrid, path: Vec2[]): Vec2[] {
  if (path.length <= 2) return path;
  
  const simplified: Vec2[] = [path[0]];
  
  let current = 0;
  while (current < path.length - 1) {
    // Find furthest visible point
    let furthest = current + 1;
    
    for (let i = path.length - 1; i > current + 1; i--) {
      if (hasLineOfSight(grid, path[current], path[i])) {
        furthest = i;
        break;
      }
    }
    
    simplified.push(path[furthest]);
    current = furthest;
    }
  
  return simplified;
}

/**
 * Check if there's a clear line between two points
 */
function hasLineOfSight(grid: NavGrid, a: Vec2, b: Vec2): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  
  if (steps === 0) return true;
  
  const stepX = dx / steps;
  const stepY = dy / steps;
  
  for (let i = 1; i < steps; i++) {
    const x = Math.round(a.x + stepX * i);
    const y = Math.round(a.y + stepY * i);
    
    if (!isWalkable(grid, x, y)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Smooth path by interpolating positions
 */
export function smoothPath(path: Vec2[], smoothing: number = 0.5): Vec2[] {
  if (path.length <= 2) return path;
  
  const smoothed: Vec2[] = [path[0]];
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    
    smoothed.push({
      x: curr.x + (prev.x - curr.x + next.x - curr.x) * smoothing,
      y: curr.y + (prev.y - curr.y + next.y - curr.y) * smoothing,
    });
  }
  
  smoothed.push(path[path.length - 1]);
  
  return smoothed;
}

/**
 * Get path as world positions
 */
export function pathToWorldPositions(path: Vec2[]): Vec3[] {
  return path.map(p => ({
    x: p.x * 2 + 1,  // MAP_SIZE.tileSize + half tile
    y: 0,
    z: p.y * 2 + 1,
  }));
}

/**
 * Calculate total path length
 */
export function getPathLength(path: Vec2[]): number {
  let length = 0;
  
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  
  return length;
}
