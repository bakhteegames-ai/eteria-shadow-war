/**
 * GameProviderV2 - Connects new simulation core to React
 * 
 * Responsibilities:
 * - Initialize GameLoop with new simulation core
 * - Bridge GameLoop state updates to Zustand store
 * - Provide command submission interface
 * - Handle platform lifecycle (pause/resume)
 */

'use client';

import { useEffect, useRef, useCallback, createContext, useContext, useState } from 'react';
import { useGameStoreV2 } from '@/lib/game/store-v2';
import { GameLoop } from '@/lib/game/core/GameLoop';
import { createInitialState } from '@/lib/game/core/initialState';
import type { GameStateV2, GameCommand, GameConfig, EntityId, UnitType, BuildingType, Vec3, Vec2, FactionId } from '@/lib/game/core/types';

// ============================================================================
// CONTEXT
// ============================================================================

interface GameContextValue {
  submitCommand: (cmd: GameCommand) => void;
  submitCommands: (cmds: GameCommand[]) => void;
  gameState: GameStateV2 | null;
  isInitialized: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGameContext must be used within GameProviderV2');
  }
  return ctx;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface GameProviderV2Props {
  config: GameConfig;
  children: React.ReactNode;
  onVictory?: () => void;
  onDefeat?: () => void;
}

export function GameProviderV2({ config, children, onVictory, onDefeat }: GameProviderV2Props) {
  const gameLoopRef = useRef<GameLoop | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const updateState = useGameStoreV2(s => s.updateState);
  const initializeGame = useGameStoreV2(s => s.initializeGame);
  
  // Initialize game
  useEffect(() => {
    // Create initial state
    const initialState = createInitialState(config);
    
    // Initialize store
    initializeGame(config);
    
    // Create game loop
    const loop = new GameLoop(initialState, {
      onTick: (state) => {
        updateState(state);
      },
      onPhaseChange: (phase) => {
        if (phase === 'victory') {
          onVictory?.();
        } else if (phase === 'defeat') {
          onDefeat?.();
        }
      },
    });
    
    gameLoopRef.current = loop;
    loop.start();
    setIsInitialized(true);
    
    console.log('[GameProviderV2] Game initialized with config:', config);
    
    return () => {
      loop.stop();
      gameLoopRef.current = null;
      setIsInitialized(false);
    };
  }, [config, initializeGame, updateState, onVictory, onDefeat]);
  
  // Command submission
  const submitCommand = useCallback((cmd: GameCommand) => {
    gameLoopRef.current?.submitCommand(cmd);
  }, []);
  
  const submitCommands = useCallback((cmds: GameCommand[]) => {
    gameLoopRef.current?.submitCommands(cmds);
  }, []);
  
  // Get current state
  const gameState = useGameStoreV2(s => s.state);
  
  // Pause/Resume from platform
  useEffect(() => {
    const handlePlatformPause = () => {
      gameLoopRef.current?.pause();
    };
    
    const handlePlatformResume = () => {
      gameLoopRef.current?.resume();
    };
    
    window.addEventListener('platform-pause', handlePlatformPause);
    window.addEventListener('platform-resume', handlePlatformResume);
    
    return () => {
      window.removeEventListener('platform-pause', handlePlatformPause);
      window.removeEventListener('platform-resume', handlePlatformResume);
    };
  }, []);
  
  return (
    <GameContext.Provider value={{ submitCommand, submitCommands, gameState, isInitialized }}>
      {children}
    </GameContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to submit game commands
 */
export function useSubmitCommand() {
  const { submitCommand } = useGameContext();
  return submitCommand;
}

/**
 * Hook for player actions
 */
export function usePlayerActions() {
  const { submitCommand } = useGameContext();
  const gameState = useGameStoreV2(s => s.state);
  
  const moveUnits = useCallback((unitIds: EntityId[], target: Vec3) => {
    if (!gameState) return;
    submitCommand({
      type: 'MOVE',
      factionId: 'player',
      tick: gameState.simulation.tick,
      entityIds: unitIds,
      targetPosition: target,
    });
  }, [submitCommand, gameState]);
  
  const attackTarget = useCallback((unitIds: EntityId[], targetId: EntityId) => {
    if (!gameState) return;
    submitCommand({
      type: 'ATTACK',
      factionId: 'player',
      tick: gameState.simulation.tick,
      entityIds: unitIds,
      targetEntityId: targetId,
    });
  }, [submitCommand, gameState]);
  
  const trainUnit = useCallback((buildingId: EntityId, unitType: UnitType) => {
    if (!gameState) return;
    submitCommand({
      type: 'TRAIN',
      factionId: 'player',
      tick: gameState.simulation.tick,
      buildingId,
      unitType,
    });
  }, [submitCommand, gameState]);
  
  const buildBuilding = useCallback((workerId: EntityId, buildingType: BuildingType, position: Vec2) => {
    if (!gameState) return;
    submitCommand({
      type: 'BUILD',
      factionId: 'player',
      tick: gameState.simulation.tick,
      workerId,
      buildingType,
      position,
    });
  }, [submitCommand, gameState]);
  
  const setRallyPoint = useCallback((buildingId: EntityId, position: Vec2) => {
    if (!gameState) return;
    submitCommand({
      type: 'SET_RALLY_POINT',
      factionId: 'player',
      tick: gameState.simulation.tick,
      buildingId,
      position,
    });
  }, [submitCommand, gameState]);
  
  const gatherResource = useCallback((workerIds: EntityId[], resourceId: EntityId) => {
    if (!gameState) return;
    submitCommand({
      type: 'GATHER',
      factionId: 'player',
      tick: gameState.simulation.tick,
      workerIds,
      resourceNodeId: resourceId,
    });
  }, [submitCommand, gameState]);
  
  const selectEntities = useCallback((entityIds: EntityId[], addToSelection: boolean) => {
    if (!gameState) return;
    submitCommand({
      type: 'SELECT',
      factionId: 'player',
      tick: gameState.simulation.tick,
      entityIds,
      addToSelection,
    });
  }, [submitCommand, gameState]);
  
  const stopUnits = useCallback((unitIds: EntityId[]) => {
    if (!gameState) return;
    submitCommand({
      type: 'STOP',
      factionId: 'player',
      tick: gameState.simulation.tick,
      entityIds: unitIds,
    });
  }, [submitCommand, gameState]);
  
  const pauseGame = useCallback((pause: boolean) => {
    if (!gameState) return;
    submitCommand({
      type: 'PAUSE',
      factionId: 'player',
      tick: gameState.simulation.tick,
      pause,
    });
  }, [submitCommand, gameState]);
  
  return {
    moveUnits,
    attackTarget,
    trainUnit,
    buildBuilding,
    setRallyPoint,
    gatherResource,
    selectEntities,
    stopUnits,
    pauseGame,
  };
}

export default GameProviderV2;
