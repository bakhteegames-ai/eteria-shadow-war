/**
 * TouchController React Component
 * 
 * Provides mobile-friendly controls for the game.
 */

'use client';

import { useEffect, useRef } from 'react';
import { InputManager, type InputCallbacks, type InputState } from './InputController';
import { usePlayerActions } from './GameProviderV2';
import { useGameStoreV2 } from '@/lib/game/store-v2';
import type { EntityId, Vec2, Vec3 } from '@/lib/game/core/types';

interface TouchControllerProps {
  buildingType: string | null;
  isPlacingRallyPoint: boolean;
  onCancelBuilding: () => void;
  onPlaceBuilding: (position: Vec2) => void;
  onSelectEntities: (ids: EntityId[], addToSelection: boolean) => void;
  screenToWorld: (screenX: number, screenY: number) => Vec3;
  findEntityAtPosition: (worldX: number, worldZ: number) => { id: EntityId; type: 'unit' | 'building' | 'resource'; isEnemy: boolean } | null;
  onCameraPan: (dx: number, dy: number) => void;
  onCameraZoom: (delta: number, center?: { x: number; y: number }) => void;
  onGatherResources: (workerIds: EntityId[], resourceId: EntityId) => void;
}

export function TouchControllerWrapper({ 
  buildingType, 
  isPlacingRallyPoint,
  onCancelBuilding, 
  onPlaceBuilding,
  onSelectEntities,
  screenToWorld,
  findEntityAtPosition,
  onCameraPan,
  onCameraZoom,
  onGatherResources,
}: TouchControllerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputManagerRef = useRef<InputManager | null>(null);
  
  // Actions
  const { moveUnits, attackTarget, stopUnits, pauseGame } = usePlayerActions();
  
  // Store
  const selectedEntityIds = useGameStoreV2(s => s.selectedEntityIds);
  const clearSelection = useGameStoreV2(s => s.clearSelection);
  const gamePhase = useGameStoreV2(s => s.state?.simulation.phase ?? 'initializing');
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const callbacks: InputCallbacks = {
      onSelectEntities: (ids, addTo) => {
        onSelectEntities(ids, addTo);
      },
      onClearSelection: () => {
        clearSelection();
      },
      onMoveUnits: (unitIds, target) => {
        moveUnits(unitIds, target);
      },
      onAttackMove: (unitIds, target) => {
        // Attack move - move with auto-attack
        moveUnits(unitIds, target);
      },
      onAttackTarget: (unitIds, targetId) => {
        attackTarget(unitIds, targetId);
      },
      onStartBuilding: (type) => {
        // Handled by UI
      },
      onCancelBuilding: () => {
        onCancelBuilding();
      },
      onPlaceBuilding: (position) => {
        onPlaceBuilding(position);
      },
      onCameraPan: (dx, dy) => {
        onCameraPan(dx, dy);
      },
      onCameraZoom: (delta, center) => {
        onCameraZoom(delta, center);
      },
      onPause: () => {
        pauseGame(true);
      },
      onResume: () => {
        pauseGame(false);
      },
      onStopUnits: (unitIds) => {
        stopUnits(unitIds);
      },
      screenToWorld: screenToWorld,
      findEntityAtPosition: findEntityAtPosition,
      onGatherResources: (workerIds, resourceId) => {
        onGatherResources(workerIds, resourceId);
      },
    };
    
    const getState = (): InputState => ({
      selectedUnits: selectedEntityIds,
      isPlacingBuilding: buildingType !== null || isPlacingRallyPoint,
      buildingType,
      isPaused: gamePhase === 'paused',
    });
    
    inputManagerRef.current = new InputManager(
      containerRef.current,
      callbacks,
      getState
    );
    
    return () => {
      inputManagerRef.current?.destroy();
    };
  }, [buildingType, isPlacingRallyPoint, selectedEntityIds, gamePhase, clearSelection, moveUnits, attackTarget, stopUnits, pauseGame, onCancelBuilding, onPlaceBuilding, onSelectEntities, screenToWorld, findEntityAtPosition, onCameraPan, onCameraZoom, onGatherResources]);
  
  // This is an invisible overlay for touch events
  // On touch devices, capture touch events. On desktop, let canvas handle mouse.
  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-10 pointer-events-auto md:pointer-events-none"
      style={{ touchAction: 'none' }}
    />
  );
}

export default TouchControllerWrapper;
