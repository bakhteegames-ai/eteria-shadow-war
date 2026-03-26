/**
 * Eteria: Shadow War - Store V2 (Zustand Bridge)
 * 
 * Bridge between the new simulation core and React/UI.
 * This is NOT the authoritative state - it's a projection for React.
 * 
 * The simulation core holds the truth. This store:
 * - Receives snapshots from the GameLoop
 * - Provides React-friendly selectors
 * - Handles UI-specific state (selection, modals)
 */

import { create } from 'zustand';
import type { 
  GameStateV2, 
  GameConfig, 
  EntityId,
  GamePhase,
  ResourcePool,
  Unit,
  Building,
} from './core/types';
import { createInitialState } from './core/initialState';

// ============================================================================
// STORE TYPES
// ============================================================================

export interface GameStoreV2 {
  // Core state (projection)
  state: GameStateV2 | null;
  
  // UI state
  selectedEntityIds: EntityId[];
  hoveredEntityId: EntityId | null;
  showBuildMenu: boolean;
  showPauseMenu: boolean;
  
  // Initialization
  isInitialized: boolean;
  error: string | null;
  
  // Actions
  initializeGame: (config: GameConfig) => void;
  updateState: (newState: GameStateV2) => void;
  selectEntities: (ids: EntityId[], addToSelection: boolean) => void;
  clearSelection: () => void;
  setHoveredEntity: (id: EntityId | null) => void;
  toggleBuildMenu: () => void;
  togglePauseMenu: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// ============================================================================
// SELECTORS (for components)
// ============================================================================

export const selectGamePhase = (state: GameStoreV2): GamePhase | null => 
  state.state?.simulation.phase ?? null;

export const selectGameTime = (state: GameStoreV2): number => 
  state.state?.simulation.gameTime ?? 0;

export const selectTick = (state: GameStoreV2): number => 
  state.state?.simulation.tick ?? 0;

export const selectPlayerResources = (state: GameStoreV2): ResourcePool => 
  state.state?.factions.player.resources ?? { crystals: 0, essence: 0 };

export const selectEnemyResources = (state: GameStoreV2): ResourcePool => 
  state.state?.factions.enemy.resources ?? { crystals: 0, essence: 0 };

export const selectPlayerUnits = (state: GameStoreV2): Unit[] => 
  state.state?.units.filter(u => u.factionId === 'player') ?? [];

export const selectEnemyUnits = (state: GameStoreV2): Unit[] => 
  state.state?.units.filter(u => u.factionId === 'enemy') ?? [];

export const selectPlayerBuildings = (state: GameStoreV2): Building[] => 
  state.state?.buildings.filter(b => b.factionId === 'player') ?? [];

export const selectEnemyBuildings = (state: GameStoreV2): Building[] => 
  state.state?.buildings.filter(b => b.factionId === 'enemy') ?? [];

export const selectSelectedUnits = (state: GameStoreV2): Unit[] => {
  if (!state.state) return [];
  const selectedIds = new Set(state.selectedEntityIds);
  return state.state.units.filter(u => selectedIds.has(u.id));
};

export const selectSelectedBuildings = (state: GameStoreV2): Building[] => {
  if (!state.state) return [];
  const selectedIds = new Set(state.selectedEntityIds);
  return state.state.buildings.filter(b => selectedIds.has(b.id));
};

export const selectUnitById = (id: EntityId) => (state: GameStoreV2): Unit | undefined =>
  state.state?.units.find(u => u.id === id);

export const selectBuildingById = (id: EntityId) => (state: GameStoreV2): Building | undefined =>
  state.state?.buildings.find(b => b.id === id);

export const selectIsVictory = (state: GameStoreV2): boolean =>
  state.state?.simulation.phase === 'victory';

export const selectIsDefeat = (state: GameStoreV2): boolean =>
  state.state?.simulation.phase === 'defeat';

export const selectIsPaused = (state: GameStoreV2): boolean =>
  state.state?.simulation.phase === 'paused';

export const selectIsRunning = (state: GameStoreV2): boolean =>
  state.state?.simulation.phase === 'running';

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useGameStoreV2 = create<GameStoreV2>((set, get) => ({
  // Initial state
  state: null,
  selectedEntityIds: [],
  hoveredEntityId: null,
  showBuildMenu: false,
  showPauseMenu: false,
  isInitialized: false,
  error: null,
  
  // Actions
  initializeGame: (config: GameConfig) => {
    try {
      const initialState = createInitialState(config);
      set({
        state: initialState,
        isInitialized: true,
        error: null,
        selectedEntityIds: [],
      });
    } catch (error) {
      console.error('[StoreV2] Failed to initialize game:', error);
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },
  
  updateState: (newState: GameStateV2) => {
    set({ state: newState });
  },
  
  selectEntities: (ids: EntityId[], addToSelection: boolean) => {
    if (addToSelection) {
      const current = get().selectedEntityIds;
      const newSet = new Set(current);
      ids.forEach(id => newSet.add(id));
      set({ selectedEntityIds: Array.from(newSet) });
    } else {
      set({ selectedEntityIds: ids });
    }
  },
  
  clearSelection: () => {
    set({ selectedEntityIds: [] });
  },
  
  setHoveredEntity: (id: EntityId | null) => {
    set({ hoveredEntityId: id });
  },
  
  toggleBuildMenu: () => {
    set(state => ({ showBuildMenu: !state.showBuildMenu }));
  },
  
  togglePauseMenu: () => {
    set(state => ({ showPauseMenu: !state.showPauseMenu }));
  },
  
  setError: (error: string | null) => {
    set({ error });
  },
  
  reset: () => {
    set({
      state: null,
      selectedEntityIds: [],
      hoveredEntityId: null,
      showBuildMenu: false,
      showPauseMenu: false,
      isInitialized: false,
      error: null,
    });
  },
}));

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to get current game state
 */
export function useGameState(): GameStateV2 | null {
  return useGameStoreV2(s => s.state);
}

/**
 * Hook to check if game is initialized
 */
export function useGameInitialized(): boolean {
  return useGameStoreV2(s => s.isInitialized);
}

/**
 * Hook for player resources
 */
export function usePlayerResources(): ResourcePool {
  return useGameStoreV2(selectPlayerResources);
}

/**
 * Hook for selected units
 */
export function useSelectedUnits(): Unit[] {
  return useGameStoreV2(selectSelectedUnits);
}

/**
 * Hook for game phase
 */
export function useGamePhase(): GamePhase | null {
  return useGameStoreV2(selectGamePhase);
}
