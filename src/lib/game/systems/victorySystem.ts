/**
 * Eteria: Shadow War - Victory System
 * 
 * Checks win/defeat conditions.
 * Currently: Destroy enemy Town Center = victory, lose own TC = defeat.
 */

import type { GameStateV2, FactionId, BuildingType } from '../core/types';
import { VICTORY_CONFIG } from '../core/constants';
import { isBuildingAlive } from '../core/model';
import { getTownCenter } from '../core/queries';

// ============================================================================
// VICTORY CHECK
// ============================================================================

/**
 * Check victory/defeat conditions
 */
export function checkVictory(state: GameStateV2): GameStateV2 {
  // Skip if already in terminal state
  if (state.simulation.phase === 'victory' || state.simulation.phase === 'defeat') {
    return state;
  }
  
  // Check each faction's critical buildings
  const playerHasTC = hasCriticalBuildings(state, 'player');
  const enemyHasTC = hasCriticalBuildings(state, 'enemy');
  
  if (!playerHasTC) {
    // Player lost
    return {
      ...state,
      simulation: {
        ...state.simulation,
        phase: 'defeat',
        victoryFactionId: 'enemy',
      },
    };
  }
  
  if (!enemyHasTC) {
    // Player won
    return {
      ...state,
      simulation: {
        ...state.simulation,
        phase: 'victory',
        victoryFactionId: 'player',
      },
    };
  }
  
  return state;
}

/**
 * Check if a faction has any critical buildings alive
 */
function hasCriticalBuildings(state: GameStateV2, factionId: FactionId): boolean {
  const criticalTypes = VICTORY_CONFIG.criticalBuildings;
  
  return state.buildings.some(b => 
    b.factionId === factionId &&
    criticalTypes.includes(b.type) &&
    isBuildingAlive(b)
  );
}

// ============================================================================
// VICTORY QUERIES
// ============================================================================

/**
 * Check if player has won
 */
export function hasPlayerWon(state: GameStateV2): boolean {
  return state.simulation.phase === 'victory';
}

/**
 * Check if player has lost
 */
export function hasPlayerLost(state: GameStateV2): boolean {
  return state.simulation.phase === 'defeat';
}

/**
 * Get winner faction
 */
export function getWinner(state: GameStateV2): FactionId | undefined {
  if (state.simulation.phase === 'victory' || state.simulation.phase === 'defeat') {
    return state.simulation.victoryFactionId;
  }
  return undefined;
}

/**
 * Get game result message
 */
export function getGameResultMessage(state: GameStateV2): string | null {
  switch (state.simulation.phase) {
    case 'victory':
      return 'Victory! You have conquered your enemies!';
    case 'defeat':
      return 'Defeat! Your kingdom has fallen...';
    default:
      return null;
  }
}
