/**
 * Eteria: Shadow War - State Queries
 * 
 * Read-only selectors for accessing game state.
 * These functions never mutate state - they only read and transform.
 */

import type {
  GameStateV2,
  EntityId,
  FactionId,
  Unit,
  Building,
  Projectile,
  ResourceNode,
  UnitType,
  BuildingType,
  ResourcePool,
  FactionState,
  Vec3,
  Vec2,
} from './types';
import { worldDistance, gridDistance, isUnitAlive, isBuildingAlive, isBuildingOperational } from './model';

// ============================================================================
// ENTITY LOOKUP
// ============================================================================

/**
 * Get a unit by ID
 */
export function getUnitById(state: GameStateV2, id: EntityId): Unit | undefined {
  return state.units.find(u => u.id === id);
}

/**
 * Get a building by ID
 */
export function getBuildingById(state: GameStateV2, id: EntityId): Building | undefined {
  return state.buildings.find(b => b.id === id);
}

/**
 * Get a resource node by ID
 */
export function getResourceNodeById(state: GameStateV2, id: EntityId): ResourceNode | undefined {
  return state.map.resourceNodes.find(r => r.id === id);
}

/**
 * Get any entity by ID (type check via entityIndex)
 */
export function getEntityType(state: GameStateV2, id: EntityId): 'unit' | 'building' | 'projectile' | 'resource' | undefined {
  return state.entityIndex.get(id);
}

// ============================================================================
// UNIT QUERIES
// ============================================================================

/**
 * Get all units for a faction
 */
export function getUnitsByFaction(state: GameStateV2, factionId: FactionId): Unit[] {
  return state.units.filter(u => u.factionId === factionId);
}

/**
 * Get all alive units for a faction
 */
export function getAliveUnitsByFaction(state: GameStateV2, factionId: FactionId): Unit[] {
  return state.units.filter(u => u.factionId === factionId && isUnitAlive(u));
}

/**
 * Get all selected units
 */
export function getSelectedUnits(state: GameStateV2): Unit[] {
  return state.units.filter(u => u.isSelected);
}

/**
 * Get units of a specific type for a faction
 */
export function getUnitsByType(state: GameStateV2, factionId: FactionId, type: UnitType): Unit[] {
  return state.units.filter(u => u.factionId === factionId && u.type === type);
}

/**
 * Get all workers for a faction
 */
export function getWorkers(state: GameStateV2, factionId: FactionId): Unit[] {
  return getUnitsByType(state, factionId, 'worker');
}

/**
 * Get all combat units for a faction
 */
export function getCombatUnits(state: GameStateV2, factionId: FactionId): Unit[] {
  return state.units.filter(u => 
    u.factionId === factionId && 
    u.type !== 'worker' && 
    isUnitAlive(u)
  );
}

/**
 * Count units for a faction
 */
export function countUnits(state: GameStateV2, factionId: FactionId): number {
  return getAliveUnitsByFaction(state, factionId).length;
}

/**
 * Count units by type for a faction
 */
export function countUnitsByType(state: GameStateV2, factionId: FactionId, type: UnitType): number {
  return state.units.filter(u => 
    u.factionId === factionId && 
    u.type === type && 
    isUnitAlive(u)
  ).length;
}

// ============================================================================
// BUILDING QUERIES
// ============================================================================

/**
 * Get all buildings for a faction
 */
export function getBuildingsByFaction(state: GameStateV2, factionId: FactionId): Building[] {
  return state.buildings.filter(b => b.factionId === factionId);
}

/**
 * Get all alive buildings for a faction
 */
export function getAliveBuildingsByFaction(state: GameStateV2, factionId: FactionId): Building[] {
  return state.buildings.filter(b => b.factionId === factionId && isBuildingAlive(b));
}

/**
 * Get all operational buildings for a faction
 */
export function getOperationalBuildings(state: GameStateV2, factionId: FactionId): Building[] {
  return state.buildings.filter(b => 
    b.factionId === factionId && isBuildingOperational(b)
  );
}

/**
 * Get buildings of a specific type for a faction
 */
export function getBuildingsByType(state: GameStateV2, factionId: FactionId, type: BuildingType): Building[] {
  return state.buildings.filter(b => b.factionId === factionId && b.type === type);
}

/**
 * Get the Town Center for a faction
 */
export function getTownCenter(state: GameStateV2, factionId: FactionId): Building | undefined {
  return state.buildings.find(b => 
    b.factionId === factionId && 
    b.type === 'townCenter' && 
    isBuildingAlive(b)
  );
}

/**
 * Count buildings for a faction
 */
export function countBuildings(state: GameStateV2, factionId: FactionId): number {
  return getAliveBuildingsByFaction(state, factionId).length;
}

// ============================================================================
// FACTION QUERIES
// ============================================================================

/**
 * Get faction state
 */
export function getFactionState(state: GameStateV2, factionId: FactionId): FactionState {
  return state.factions[factionId];
}

/**
 * Get faction resources
 */
export function getFactionResources(state: GameStateV2, factionId: FactionId): ResourcePool {
  return state.factions[factionId].resources;
}

/**
 * Check if faction can afford a cost
 */
export function canAfford(state: GameStateV2, factionId: FactionId, cost: { crystals: number; essence: number }): boolean {
  const resources = getFactionResources(state, factionId);
  return resources.crystals >= cost.crystals && resources.essence >= cost.essence;
}

// ============================================================================
// RESOURCE NODE QUERIES
// ============================================================================

/**
 * Get all resource nodes
 */
export function getResourceNodes(state: GameStateV2): ResourceNode[] {
  return state.map.resourceNodes;
}

/**
 * Get resource nodes by type
 */
export function getResourceNodesByType(state: GameStateV2, type: 'crystals' | 'essence'): ResourceNode[] {
  return state.map.resourceNodes.filter(r => r.type === type && r.amount > 0);
}

/**
 * Find nearest resource node to a position
 */
export function findNearestResourceNode(
  state: GameStateV2,
  position: Vec3,
  type?: 'crystals' | 'essence'
): ResourceNode | undefined {
  const nodes = type 
    ? getResourceNodesByType(state, type)
    : state.map.resourceNodes.filter(r => r.amount > 0);
  
  let nearest: ResourceNode | undefined;
  let minDist = Infinity;
  
  for (const node of nodes) {
    if (node.amount <= 0) continue;
    
    const dist = Math.sqrt(
      Math.pow(node.position.x - position.x, 2) +
      Math.pow(node.position.y - position.z, 2)
    );
    
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }
  
  return nearest;
}

// ============================================================================
// PRODUCTION QUERIES
// ============================================================================

/**
 * Get all production queues for a faction
 */
export function getProductionQueues(state: GameStateV2, factionId: FactionId): Array<{ building: Building; queue: Building['productionQueue'] }> {
  return getOperationalBuildings(state, factionId)
    .filter(b => b.productionQueue.length > 0)
    .map(b => ({ building: b, queue: b.productionQueue }));
}

/**
 * Check if a building can train a unit
 */
export function canTrainUnit(state: GameStateV2, buildingId: EntityId, unitType: UnitType): boolean {
  const building = getBuildingById(state, buildingId);
  if (!building || !isBuildingOperational(building)) return false;
  
  const stats = building.stats;
  if (!stats.producesUnits?.includes(unitType)) return false;
  
  return true;
}

// ============================================================================
// VICTORY/DEFEAT QUERIES
// ============================================================================

/**
 * Check if a faction has lost (no Town Center)
 */
export function hasFactionLost(state: GameStateV2, factionId: FactionId): boolean {
  const tc = getTownCenter(state, factionId);
  return tc === undefined;
}

/**
 * Check if a faction has won
 */
export function hasFactionWon(state: GameStateV2, factionId: FactionId): boolean {
  const enemyId = factionId === 'player' ? 'enemy' : 'player';
  return hasFactionLost(state, enemyId);
}

/**
 * Get game phase based on state
 */
export function getGamePhase(state: GameStateV2): 'initializing' | 'running' | 'paused' | 'victory' | 'defeat' {
  if (state.simulation.phase === 'initializing') return 'initializing';
  if (state.simulation.phase === 'paused') return 'paused';
  
  if (hasFactionLost(state, 'player')) return 'defeat';
  if (hasFactionLost(state, 'enemy')) return 'victory';
  
  return 'running';
}

// ============================================================================
// SPATIAL QUERIES
// ============================================================================

/**
 * Find units within a radius of a position
 */
export function findUnitsInRadius(
  state: GameStateV2,
  position: Vec3,
  radius: number,
  filter?: (u: Unit) => boolean
): Unit[] {
  return state.units.filter(u => {
    if (!isUnitAlive(u)) return false;
    if (filter && !filter(u)) return false;
    
    const dist = worldDistance(position, u.position);
    return dist <= radius;
  });
}

/**
 * Find enemy units within a radius
 */
export function findEnemyUnitsInRadius(
  state: GameStateV2,
  position: Vec3,
  radius: number,
  factionId: FactionId
): Unit[] {
  return findUnitsInRadius(state, position, radius, u => u.factionId !== factionId);
}

/**
 * Find the nearest enemy unit
 */
export function findNearestEnemyUnit(
  state: GameStateV2,
  position: Vec3,
  factionId: FactionId,
  maxRange: number = Infinity
): Unit | undefined {
  const enemies = state.units.filter(u => 
    u.factionId !== factionId && 
    isUnitAlive(u)
  );
  
  let nearest: Unit | undefined;
  let minDist = Infinity;
  
  for (const enemy of enemies) {
    const dist = worldDistance(position, enemy.position);
    if (dist < minDist && dist <= maxRange) {
      minDist = dist;
      nearest = enemy;
    }
  }
  
  return nearest;
}

/**
 * Find buildings within a radius
 */
export function findBuildingsInRadius(
  state: GameStateV2,
  position: Vec3,
  radius: number,
  filter?: (b: Building) => boolean
): Building[] {
  return state.buildings.filter(b => {
    if (!isBuildingAlive(b)) return false;
    if (filter && !filter(b)) return false;
    
    const dist = worldDistance(position, b.position);
    return dist <= radius;
  });
}

// ============================================================================
// SELECTION QUERIES
// ============================================================================

/**
 * Get all selected entity IDs
 */
export function getSelectedEntityIds(state: GameStateV2): EntityId[] {
  return state.selectedEntityIds;
}

/**
 * Check if an entity is selected
 */
export function isSelected(state: GameStateV2, entityId: EntityId): boolean {
  return state.selectedEntityIds.includes(entityId);
}

/**
 * Get all selected units and buildings
 */
export function getSelectedEntities(state: GameStateV2): { units: Unit[]; buildings: Building[] } {
  const ids = new Set(state.selectedEntityIds);
  
  return {
    units: state.units.filter(u => ids.has(u.id)),
    buildings: state.buildings.filter(b => ids.has(b.id)),
  };
}

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Get total military strength for a faction
 */
export function getMilitaryStrength(state: GameStateV2, factionId: FactionId): number {
  return getAliveUnitsByFaction(state, factionId)
    .filter(u => u.type !== 'worker')
    .reduce((total, u) => total + (u.stats.damage * u.stats.attackSpeed) + (u.health / 10), 0);
}

/**
 * Get economy strength for a faction
 */
export function getEconomyStrength(state: GameStateV2, factionId: FactionId): number {
  const workers = countUnitsByType(state, factionId, 'worker');
  const resources = getFactionResources(state, factionId);
  return workers * 10 + resources.crystals / 100 + resources.essence / 50;
}

/**
 * Get game statistics
 */
export function getGameStatistics(state: GameStateV2) {
  return {
    tick: state.simulation.tick,
    gameTime: state.simulation.gameTime,
    playerUnits: countUnits(state, 'player'),
    enemyUnits: countUnits(state, 'enemy'),
    playerBuildings: countBuildings(state, 'player'),
    enemyBuildings: countBuildings(state, 'enemy'),
    playerResources: getFactionResources(state, 'player'),
    enemyResources: getFactionResources(state, 'enemy'),
  };
}
