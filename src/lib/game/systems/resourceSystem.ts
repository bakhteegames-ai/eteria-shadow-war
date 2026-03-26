/**
 * Eteria: Shadow War - Resource System
 * 
 * Worker FSM for gathering resources:
 * - idle → movingToResource (when assigned)
 * - movingToResource → gathering (when arrived)
 * - gathering → movingToDropoff (when full)
 * - movingToDropoff → delivering (when at building)
 * - delivering → returningToResource (to continue gathering)
 * - building → idle (when construction completes)
 */

import type { 
  GameStateV2, 
  Unit, 
  Building, 
  ResourceNode,
  Vec3,
  Vec2,
  FactionId,
} from '../core/types';
import { 
  isUnitAlive, 
  isBuildingAlive, 
  isBuildingOperational,
  worldDistance,
  gridToWorld,
} from '../core/model';
import { 
  findNearestResourceNode,
  getTownCenter,
} from '../core/queries';
import { GATHER_CONFIG } from '../core/constants';

// ============================================================================
// TYPES
// ============================================================================

/** Worker gathering state */
type WorkerGatherState = 
  | 'idle'
  | 'movingToResource'
  | 'gathering'
  | 'movingToDropoff'
  | 'delivering'
  | 'returningToResource';

// ============================================================================
// RESOURCE SYSTEM PROCESSING
// ============================================================================

/**
 * Process all workers for resource gathering
 */
export function processResources(state: GameStateV2, dt: number): GameStateV2 {
  // Process each worker
  let newUnits = [...state.units];
  let newResourceNodes = [...state.map.resourceNodes];
  const newFactions = { ...state.factions };
  
  for (let i = 0; i < newUnits.length; i++) {
    const unit = newUnits[i];
    
    // Skip non-workers and dead units
    if (unit.type !== 'worker' || !isUnitAlive(unit)) continue;
    // Skip workers that are building
    if (unit.state === 'building') continue;
    
    // Process this worker
    const result = processWorker(
      unit, 
      newResourceNodes,
      newBuildingsForDropoff(newUnits, state.buildings, unit.factionId),
      newFactions[unit.factionId].resources,
      dt,
      state
    );
    
    // Apply changes
    newUnits[i] = result.unit;
    if (result.resourceNodeChanges) {
      newResourceNodes = applyResourceChanges(newResourceNodes, result.resourceNodeChanges);
    }
    if (result.resourceChanges) {
      newFactions[unit.factionId] = {
        ...newFactions[unit.factionId],
        resources: {
          crystals: newFactions[unit.factionId].resources.crystals + result.resourceChanges.crystals,
          essence: newFactions[unit.factionId].resources.essence + result.resourceChanges.essence,
        },
      };
    }
  }
  
  return {
    ...state,
    units: newUnits,
    map: {
      ...state.map,
      resourceNodes: newResourceNodes,
    },
    factions: newFactions,
  };
}

/**
 * Get buildings suitable for resource dropoff
 */
function newBuildingsForDropoff(
  units: Unit[], 
  buildings: Building[], 
  factionId: FactionId
): Building[] {
  // Town Centers are always dropoff points
  return buildings.filter(b => 
    b.factionId === factionId && 
    isBuildingOperational(b) && 
    b.type === 'townCenter'
  );
}

// ============================================================================
// WORKER FSM
// ============================================================================

interface WorkerProcessResult {
  unit: Unit;
  resourceNodeChanges?: { id: string; amountChange: number }[];
  resourceChanges?: { crystals: number; essence: number };
}

/**
 * Process a single worker's FSM
 */
function processWorker(
  unit: Unit,
  resourceNodes: ResourceNode[],
  dropoffBuildings: Building[],
  currentResources: { crystals: number; essence: number },
  dt: number,
  state: GameStateV2
): WorkerProcessResult {
  // If worker has a targetResourceId but no node, reset
  if (unit.targetResourceId && !resourceNodes.find(r => r.id === unit.targetResourceId && r.amount > 0)) {
    return {
      unit: {
        ...unit,
        state: 'idle',
        targetResourceId: undefined,
        carryingResource: undefined,
        carryingAmount: 0,
      },
    };
  }
  
  // State machine
  switch (unit.state) {
    case 'idle':
      return processIdleWorker(unit, resourceNodes, state);
      
    case 'movingToResource':
      return processMovingToResource(unit, resourceNodes, dt);
      
    case 'gathering':
      return processGathering(unit, resourceNodes, dt);
      
    case 'movingToDropoff':
      return processMovingToDropoff(unit, dropoffBuildings, dt);
      
    case 'delivering':
      return processDelivering(unit, currentResources, dt);
      
    default:
      return { unit };
  }
}

/**
 * Idle worker: Find resource to gather
 */
function processIdleWorker(
  unit: Unit,
  resourceNodes: ResourceNode[],
  state: GameStateV2
): WorkerProcessResult {
  // If worker has resources, go deliver them
  if (unit.carryingAmount > 0) {
    return {
      unit: {
        ...unit,
        state: 'movingToDropoff' as const,
      },
    };
  }
  
  // If worker has a target resource, go to it
  if (unit.targetResourceId) {
    const node = resourceNodes.find(r => r.id === unit.targetResourceId);
    if (node && node.amount > 0) {
      return {
        unit: {
          ...unit,
          state: 'movingToResource' as const,
          targetPosition: {
            x: node.position.x,
            y: 0,
            z: node.position.y,
          },
        },
      };
    }
  }
  
  // Find nearest resource node
  const nearestNode = findNearestResourceNode(state, unit.position);
  if (!nearestNode) {
    return { unit };  // No resources available
  }
  
  return {
    unit: {
      ...unit,
      state: 'movingToResource' as const,
      targetResourceId: nearestNode.id,
      targetPosition: {
        x: nearestNode.position.x,
        y: 0,
        z: nearestNode.position.y,
      },
    },
  };
}

/**
 * Moving to resource: Check if arrived
 */
function processMovingToResource(
  unit: Unit,
  resourceNodes: ResourceNode[],
  dt: number
): WorkerProcessResult {
  if (!unit.targetResourceId) {
    return { unit: { ...unit, state: 'idle' as const } };
  }
  
  const node = resourceNodes.find(r => r.id === unit.targetResourceId);
  if (!node || node.amount <= 0) {
    return { 
      unit: { 
        ...unit, 
        state: 'idle' as const,
        targetResourceId: undefined,
      } 
    };
  }
  
  // Move toward resource
  const targetPos: Vec3 = {
    x: node.position.x,
    y: 0,
    z: node.position.y,
  };
  
  const dist = worldDistance(unit.position, targetPos);
  
  if (dist <= GATHER_CONFIG.gatherRange) {
    // Arrived at resource
    return {
      unit: {
        ...unit,
        state: 'gathering' as const,
        targetPosition: undefined,
      },
    };
  }
  
  // Continue moving (simple direct movement)
  const speed = unit.stats.moveSpeed * dt;
  const dx = targetPos.x - unit.position.x;
  const dz = targetPos.z - unit.position.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  
  return {
    unit: {
      ...unit,
      position: {
        x: unit.position.x + (dx / d) * speed,
        y: 0,
        z: unit.position.z + (dz / d) * speed,
      },
    },
  };
}

/**
 * Gathering: Collect resources
 */
function processGathering(
  unit: Unit,
  resourceNodes: ResourceNode[],
  dt: number
): WorkerProcessResult {
  if (!unit.targetResourceId) {
    return { unit: { ...unit, state: 'idle' as const } };
  }
  
  const node = resourceNodes.find(r => r.id === unit.targetResourceId);
  if (!node || node.amount <= 0) {
    // Resource depleted, go deliver what we have or go idle
    if (unit.carryingAmount > 0) {
      return {
        unit: {
          ...unit,
          state: 'movingToDropoff' as const,
          targetResourceId: undefined,
        },
      };
    }
    return {
      unit: {
        ...unit,
        state: 'idle' as const,
        targetResourceId: undefined,
      },
    };
  }
  
  // Check if full
  if (unit.carryingAmount >= GATHER_CONFIG.carryCapacity) {
    return {
      unit: {
        ...unit,
        state: 'movingToDropoff' as const,
      },
    };
  }
  
  // Gather resources (simplified: 1 gather action per gatherTime)
  // In reality, we'd track a timer. For simplicity, use dt-based accumulation
  const gatherRate = GATHER_CONFIG.carryCapacity / GATHER_CONFIG.gatherTime;
  const amountGathered = Math.min(
    gatherRate * dt,
    GATHER_CONFIG.carryCapacity - unit.carryingAmount,
    node.amount  // Can't gather more than available
  );
  
  const newCarryingAmount = unit.carryingAmount + amountGathered;
  
  // Check if full after gathering
  if (newCarryingAmount >= GATHER_CONFIG.carryCapacity) {
    return {
      unit: {
        ...unit,
        state: 'movingToDropoff' as const,
        carryingResource: node.type,
        carryingAmount: newCarryingAmount,
      },
      resourceNodeChanges: [{ id: node.id, amountChange: -amountGathered }],
    };
  }
  
  return {
    unit: {
      ...unit,
      carryingResource: node.type,
      carryingAmount: newCarryingAmount,
    },
    resourceNodeChanges: [{ id: node.id, amountChange: -amountGathered }],
  };
}

/**
 * Moving to dropoff: Find nearest TC and go there
 */
function processMovingToDropoff(
  unit: Unit,
  dropoffBuildings: Building[],
  dt: number
): WorkerProcessResult {
  if (unit.carryingAmount <= 0) {
    return { unit: { ...unit, state: 'idle' as const } };
  }
  
  // Find nearest dropoff building
  let nearestBuilding: Building | undefined;
  let nearestDist = Infinity;
  
  for (const building of dropoffBuildings) {
    const dist = worldDistance(unit.position, building.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestBuilding = building;
    }
  }
  
  if (!nearestBuilding) {
    return { unit };  // No dropoff available
  }
  
  // Move toward building
  const targetPos = nearestBuilding.position;
  const dist = worldDistance(unit.position, targetPos);
  
  if (dist <= GATHER_CONFIG.gatherRange) {
    // Arrived at dropoff
    return {
      unit: {
        ...unit,
        state: 'delivering' as const,
        targetPosition: undefined,
      },
    };
  }
  
  // Continue moving
  const speed = unit.stats.moveSpeed * dt;
  const dx = targetPos.x - unit.position.x;
  const dz = targetPos.z - unit.position.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  
  return {
    unit: {
      ...unit,
      position: {
        x: unit.position.x + (dx / d) * speed,
        y: 0,
        z: unit.position.z + (dz / d) * speed,
      },
    },
  };
}

/**
 * Delivering: Deposit resources
 */
function processDelivering(
  unit: Unit,
  currentResources: { crystals: number; essence: number },
  dt: number
): WorkerProcessResult {
  // For simplicity, instant delivery
  // In a more complex system, we'd have a delivery timer
  
  if (unit.carryingAmount <= 0 || !unit.carryingResource) {
    return { unit: { ...unit, state: 'idle' as const } };
  }
  
  const resourceType = unit.carryingResource;
  const amount = unit.carryingAmount;
  
  return {
    unit: {
      ...unit,
      state: 'returningToResource' as const,
      carryingResource: undefined,
      carryingAmount: 0,
    },
    resourceChanges: {
      crystals: resourceType === 'crystals' ? amount : 0,
      essence: resourceType === 'essence' ? amount : 0,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Apply resource node changes
 */
function applyResourceChanges(
  nodes: ResourceNode[],
  changes: { id: string; amountChange: number }[]
): ResourceNode[] {
  const changesMap = new Map(changes.map(c => [c.id, c.amountChange]));
  
  return nodes.map(node => {
    const change = changesMap.get(node.id);
    if (change === undefined) return node;
    
    return {
      ...node,
      amount: Math.max(0, node.amount + change),
    };
  });
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Count idle workers for a faction
 */
export function countIdleWorkers(state: GameStateV2, factionId: FactionId): number {
  return state.units.filter(u => 
    u.factionId === factionId &&
    u.type === 'worker' &&
    isUnitAlive(u) &&
    u.state === 'idle'
  ).length;
}

/**
 * Count gathering workers for a faction
 */
export function countGatheringWorkers(state: GameStateV2, factionId: FactionId): number {
  return state.units.filter(u => 
    u.factionId === factionId &&
    u.type === 'worker' &&
    isUnitAlive(u) &&
    ['movingToResource', 'gathering', 'movingToDropoff', 'delivering'].includes(u.state)
  ).length;
}
