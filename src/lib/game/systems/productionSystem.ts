/**
 * Eteria: Shadow War - Production System
 * 
 * Handles unit training queues in buildings.
 * Processes queue items and spawns completed units.
 */

import type { 
  GameStateV2, 
  Building, 
  Unit, 
  ProductionQueueItem,
  Vec2,
  Vec3,
} from '../core/types';
import { isBuildingOperational, createUnit, gridToWorld } from '../core/model';
import { UNIT_STATS } from '../core/constants';
import { getFactionResources } from '../core/queries';

// ============================================================================
// PRODUCTION PROCESSING
// ============================================================================

/**
 * Process production queues for all buildings
 */
export function processProduction(state: GameStateV2, dt: number): GameStateV2 {
  let newBuildings = [...state.buildings];
  const spawnedUnits: Unit[] = [];
  
  // Process each building's production queue
  for (let i = 0; i < newBuildings.length; i++) {
    const building = newBuildings[i];
    
    // Skip non-operational buildings
    if (!isBuildingOperational(building)) continue;
    if (building.productionQueue.length === 0) continue;
    
    // Process queue items
    const newQueue: ProductionQueueItem[] = [];
    
    for (const item of building.productionQueue) {
      const newProgress = item.progress + dt;
      
      if (newProgress >= item.totalTime) {
        // Unit completed - spawn it
        const spawnPos = getSpawnPosition(building);
        const unit = createUnit(item.unitType, building.factionId, spawnPos);
        spawnedUnits.push(unit);
      } else {
        // Still in progress
        newQueue.push({
          ...item,
          progress: newProgress,
        });
      }
    }
    
    // Update building with new queue
    newBuildings[i] = {
      ...building,
      productionQueue: newQueue,
    };
  }
  
  // Add spawned units to state
  const newUnits = [...state.units, ...spawnedUnits];
  
  // Update entity index
  const entityIndex = new Map(state.entityIndex);
  spawnedUnits.forEach(u => entityIndex.set(u.id, 'unit'));
  
  return {
    ...state,
    buildings: newBuildings,
    units: newUnits,
    entityIndex,
  };
}

/**
 * Get spawn position for a unit from a building
 */
function getSpawnPosition(building: Building): Vec3 {
  // Use rally point if set
  if (building.rallyPoint) {
    return gridToWorld(building.rallyPoint);
  }
  
  // Default spawn position near building
  const offset = building.stats.rallyPointOffset ?? { x: 3, y: 0 };
  return {
    x: building.position.x + offset.x,
    y: 0,
    z: building.position.z + 0,  // Rally point offset Y becomes Z in world
  };
}

// ============================================================================
// QUEUE UTILITIES
// ============================================================================

/**
 * Get total units in queue for a faction
 */
export function getTotalQueuedUnits(state: GameStateV2, factionId: string): number {
  return state.buildings
    .filter(b => b.factionId === factionId)
    .reduce((total, b) => total + b.productionQueue.length, 0);
}

/**
 * Get queued units by type for a faction
 */
export function getQueuedUnitsByType(
  state: GameStateV2, 
  factionId: string, 
  unitType: string
): number {
  return state.buildings
    .filter(b => b.factionId === factionId)
    .reduce((total, b) => 
      total + b.productionQueue.filter(q => q.unitType === unitType).length, 
      0
    );
}

/**
 * Get production progress for display
 */
export function getProductionProgress(item: ProductionQueueItem): number {
  return (item.progress / item.totalTime) * 100;
}

/**
 * Get time remaining for queue item
 */
export function getTimeRemaining(item: ProductionQueueItem): number {
  return Math.max(0, item.totalTime - item.progress);
}

/**
 * Check if a building can produce a unit type
 */
export function canProduceUnit(building: Building, unitType: string): boolean {
  if (!isBuildingOperational(building)) return false;
  if (!building.stats.producesUnits) return false;
  return building.stats.producesUnits.includes(unitType as any);
}

/**
 * Get available units to produce from a building
 */
export function getAvailableUnits(building: Building): string[] {
  return building.stats.producesUnits ?? [];
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Calculate queue progress for UI display
 */
export function calculateQueueProgress(building: Building): Array<{
  unitType: string;
  progress: number;
  timeRemaining: number;
}> {
  return building.productionQueue.map(item => ({
    unitType: item.unitType,
    progress: getProductionProgress(item),
    timeRemaining: getTimeRemaining(item),
  }));
}
