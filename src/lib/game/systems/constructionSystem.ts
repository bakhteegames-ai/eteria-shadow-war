/**
 * Eteria: Shadow War - Construction System
 * 
 * Handles building construction progress.
 * Workers must be near buildings for construction to progress.
 */

import type { GameStateV2, Building, Unit } from '../core/types';
import { isUnitAlive, isBuildingAlive, worldDistance } from '../core/model';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Distance worker must be from building to construct */
const CONSTRUCTION_RANGE = 4;

/** How much progress per second a worker adds */
const PROGRESS_PER_WORKER = 20;  // % per second

// ============================================================================
// CONSTRUCTION PROCESSING
// ============================================================================

/**
 * Process construction for all buildings
 */
export function processConstruction(state: GameStateV2, dt: number): GameStateV2 {
  const { units, buildings } = state;
  
  // Find all constructing buildings
  const newBuildings = buildings.map(building => {
    if (!building.isConstructing) return building;
    if (!isBuildingAlive(building)) return building;
    
    // Find workers assigned to this building
    const assignedWorkers = units.filter(u => 
      u.targetBuildingId === building.id &&
      u.type === 'worker' &&
      isUnitAlive(u) &&
      u.state === 'building'
    );
    
    // Check if workers are in range
    const workersInRange = assignedWorkers.filter(u => 
      worldDistance(u.position, building.position) <= CONSTRUCTION_RANGE
    );
    
    if (workersInRange.length === 0) {
      // No workers in range - construction paused
      return building;
    }
    
    // Progress construction
    const progressRate = workersInRange.length * PROGRESS_PER_WORKER * dt;
    const newProgress = Math.min(100, building.constructionProgress + progressRate);
    
    if (newProgress >= 100) {
      // Construction complete
      return {
        ...building,
        isConstructing: false,
        constructionProgress: 100,
        health: building.stats.maxHealth,
        builderId: undefined,
      };
    }
    
    return {
      ...building,
      constructionProgress: newProgress,
    };
  });
  
  // Update workers' states if construction completed
  const completedBuildingIds = new Set<string>();
  buildings.forEach((old, i) => {
    if (old.isConstructing && !newBuildings[i].isConstructing) {
      completedBuildingIds.add(old.id);
    }
  });
  
  const newUnits = units.map(u => {
    if (u.state === 'building' && completedBuildingIds.has(u.targetBuildingId ?? '')) {
      return {
        ...u,
        state: 'idle' as const,
        targetBuildingId: undefined,
      };
    }
    return u;
  });
  
  return {
    ...state,
    buildings: newBuildings,
    units: newUnits,
  };
}

/**
 * Check if a building is under construction
 */
export function isUnderConstruction(building: Building): boolean {
  return building.isConstructing && building.constructionProgress < 100;
}

/**
 * Get construction progress as percentage
 */
export function getConstructionProgress(building: Building): number {
  return building.constructionProgress;
}

/**
 * Get all constructing buildings for a faction
 */
export function getConstructingBuildings(state: GameStateV2, factionId: string): Building[] {
  return state.buildings.filter(b => 
    b.factionId === factionId && 
    b.isConstructing
  );
}
