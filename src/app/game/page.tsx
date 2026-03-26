/**
 * Game Page V2 - Uses new simulation core
 * 
 * Main game page that connects the new simulation core
 * to the renderer and UI components.
 */

'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { GameProviderV2, usePlayerActions, useGameContext } from '@/components/game/GameProviderV2';
import GameUIV2 from '@/components/game/GameUIV2';
import { TouchControllerWrapper } from '@/components/game/TouchController';
import { useGameStoreV2 } from '@/lib/game/store-v2';
import type { BuildingType, GameConfig, EntityId, FactionType, DifficultyLevel, Vec3 } from '@/lib/game/core/types';
import { MAP_SIZE } from '@/lib/game/core/constants';
import { usePlatformGameplayBridge } from '@/platform/hooks/usePlatformGameplayBridge';

const TILE_SIZE = MAP_SIZE.tileSize;

const GameCanvasV2 = dynamic(() => import('@/components/game/GameCanvasV2'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900">
      <div className="text-white text-xl animate-pulse">Loading...</div>
    </div>
  )
});

// Camera functions type from GameCanvasV2
interface CameraFunctions {
  getWorldPos: (screenX: number, screenY: number) => { x: number; z: number };
  findEntity: (worldX: number, worldZ: number) => { id: EntityId; type: 'unit' | 'building' | 'resource'; isEnemy: boolean } | null;
  panCamera: (dx: number, dy: number) => void;
  zoomCamera: (delta: number) => void;
}

// ============================================================================
// GAME CONTENT
// ============================================================================

function GameContent() {
  const router = useRouter();
  const [isPlacingBuilding, setIsPlacingBuilding] = useState<BuildingType | null>(null);
  const [isPlacingRallyPoint, setIsPlacingRallyPoint] = useState<EntityId | null>(null);
  const [isAttackMoveMode, setIsAttackMoveMode] = useState(false);
  const [cameraFunctions, setCameraFunctions] = useState<CameraFunctions | null>(null);
  
  // Store
  const gameState = useGameStoreV2(s => s.state);
  const selectedEntityIds = useGameStoreV2(s => s.selectedEntityIds);
  const selectEntities = useGameStoreV2(s => s.selectEntities);
  const clearSelection = useGameStoreV2(s => s.clearSelection);
  
  // Player actions
  const { moveUnits, buildBuilding, gatherResource, setRallyPoint, stopUnits, attackMoveUnits } = usePlayerActions();
  
  // Helper: get selected player unit IDs
  const getSelectedPlayerUnitIds = useCallback((): EntityId[] => {
    if (!gameState) return [];
    return selectedEntityIds.filter(id => {
      const unit = gameState.units.find(u => u.id === id);
      return unit && unit.factionId === 'player';
    });
  }, [gameState, selectedEntityIds]);
  
  // Handle entity selection
  const handleEntitySelect = useCallback((entityIds: EntityId[], type: 'unit' | 'building') => {
    if (isPlacingBuilding || isPlacingRallyPoint || isAttackMoveMode) return;
    selectEntities(entityIds, false);
  }, [isPlacingBuilding, isPlacingRallyPoint, isAttackMoveMode, selectEntities]);
  
  // Handle camera functions ready
  const handleCameraFunctionsReady = useCallback((funcs: CameraFunctions) => {
    setCameraFunctions(funcs);
  }, []);
  
  // Screen to world conversion for touch (uses live camera)
  const screenToWorld = useCallback((screenX: number, screenY: number): Vec3 => {
    if (!cameraFunctions) {
      // Fallback during initialization
      return { x: 40, y: 0, z: 40 };
    }
    const pos = cameraFunctions.getWorldPos(screenX, screenY);
    return { x: pos.x, y: 0, z: pos.z };
  }, [cameraFunctions]);
  
  // Find entity at position for touch selection
  const findEntityAtPosition = useCallback((worldX: number, worldZ: number) => {
    if (!cameraFunctions) {
      return null;
    }
    return cameraFunctions.findEntity(worldX, worldZ);
  }, [cameraFunctions]);
  
  // Camera pan for touch input
  const handleCameraPan = useCallback((dx: number, dy: number) => {
    if (!cameraFunctions) return;
    cameraFunctions.panCamera(dx, dy);
  }, [cameraFunctions]);
  
  // Camera zoom for touch input
  const handleCameraZoom = useCallback((delta: number) => {
    if (!cameraFunctions) return;
    cameraFunctions.zoomCamera(delta);
  }, [cameraFunctions]);
  
  // Handle map click
  const handleMapClick = useCallback((position: { x: number; z: number }) => {
    // Attack-move mode
    if (isAttackMoveMode) {
      const worldPos = {
        x: position.x * TILE_SIZE + TILE_SIZE / 2,
        y: 0,
        z: position.z * TILE_SIZE + TILE_SIZE / 2,
      };
      const unitIds = getSelectedPlayerUnitIds();
      if (unitIds.length > 0) {
        attackMoveUnits(unitIds, worldPos);
      }
      setIsAttackMoveMode(false);
      return;
    }
    
    // Rally point placement takes priority
    if (isPlacingRallyPoint) {
      setRallyPoint(isPlacingRallyPoint, { x: position.x, y: position.z });
      setIsPlacingRallyPoint(null);
      return;
    }
    
    // Building placement
    if (isPlacingBuilding) {
      // Find a worker to build
      const worker = gameState?.units.find(u => u.factionId === 'player' && u.type === 'worker');
      if (worker) {
        buildBuilding(worker.id, isPlacingBuilding, { x: position.x, y: position.z });
      }
      setIsPlacingBuilding(null);
      return;
    }
    
    // Move selected units
    if (selectedEntityIds.length > 0) {
      // Convert tile position to world position
      const worldPos = {
        x: position.x * 2 + 1,
        y: 0,
        z: position.z * 2 + 1,
      };
      moveUnits(selectedEntityIds, worldPos);
    }
  }, [isAttackMoveMode, isPlacingRallyPoint, isPlacingBuilding, selectedEntityIds, gameState, buildBuilding, moveUnits, setRallyPoint, attackMoveUnits, getSelectedPlayerUnitIds]);
  
  // Handle building placement
  const handleBuildBuilding = useCallback((buildingType: BuildingType) => {
    setIsPlacingBuilding(buildingType);
  }, []);
  
  // Handle rally point placement start
  const handleStartRallyPoint = useCallback((buildingId: EntityId) => {
    setIsPlacingRallyPoint(buildingId);
  }, []);
  
  // Handle attack-move mode start
  const handleStartAttackMove = useCallback(() => {
    const unitIds = getSelectedPlayerUnitIds();
    if (unitIds.length > 0 && !isPlacingBuilding && !isPlacingRallyPoint) {
      setIsAttackMoveMode(true);
    }
  }, [getSelectedPlayerUnitIds, isPlacingBuilding, isPlacingRallyPoint]);
  
  // Handle touch building placement (receives world coordinates, converts to grid)
  const handleTouchPlaceBuilding = useCallback((position: { x: number; y: number }) => {
    if (isPlacingRallyPoint) {
      // Rally point placement via touch
      setRallyPoint(isPlacingRallyPoint, { x: position.x / TILE_SIZE, y: position.y / TILE_SIZE });
      setIsPlacingRallyPoint(null);
      return;
    }
    
    if (isPlacingBuilding) {
      const worker = gameState?.units.find(u => u.factionId === 'player' && u.type === 'worker');
      if (worker) {
        // Convert world coordinates to grid coordinates (same as GameCanvasV2 does for mouse)
        const gridPos = {
          x: position.x / TILE_SIZE,
          y: position.y / TILE_SIZE,
        };
        buildBuilding(worker.id, isPlacingBuilding, gridPos);
      }
      setIsPlacingBuilding(null);
    }
  }, [isPlacingRallyPoint, isPlacingBuilding, gameState, buildBuilding, setRallyPoint]);
  
  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAttackMoveMode) {
          setIsAttackMoveMode(false);
        } else if (isPlacingRallyPoint) {
          setIsPlacingRallyPoint(null);
        } else if (isPlacingBuilding) {
          setIsPlacingBuilding(null);
        } else {
          clearSelection();
        }
      } else if (e.key === 'a' || e.key === 'A') {
        const unitIds = getSelectedPlayerUnitIds();
        if (unitIds.length > 0 && !isPlacingBuilding && !isPlacingRallyPoint && !isAttackMoveMode) {
          setIsAttackMoveMode(true);
        }
      } else if (e.key === 's' || e.key === 'S') {
        const unitIds = getSelectedPlayerUnitIds();
        if (unitIds.length > 0) {
          stopUnits(unitIds);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAttackMoveMode, isPlacingRallyPoint, isPlacingBuilding, clearSelection, getSelectedPlayerUnitIds, stopUnits]);
  
  return (
    <main className="fixed inset-0 overflow-hidden bg-gray-900 select-none">
      <GameCanvasV2 
        onEntitySelect={handleEntitySelect}
        onMapClick={handleMapClick}
        onCameraFunctionsReady={handleCameraFunctionsReady}
      />
      
      <GameUIV2
        isPlacingBuilding={isPlacingBuilding}
        isPlacingRallyPoint={isPlacingRallyPoint}
        isAttackMoveMode={isAttackMoveMode}
        onCancelPlacement={() => setIsPlacingBuilding(null)}
        onCancelRallyPoint={() => setIsPlacingRallyPoint(null)}
        onStartPlacement={handleBuildBuilding}
        onStartRallyPoint={handleStartRallyPoint}
        onStartAttackMove={handleStartAttackMove}
      />
      
      {/* Touch controller for mobile devices */}
      <TouchControllerWrapper
        buildingType={isPlacingBuilding}
        isPlacingRallyPoint={isPlacingRallyPoint !== null}
        onCancelBuilding={() => setIsPlacingBuilding(null)}
        onPlaceBuilding={handleTouchPlaceBuilding}
        onSelectEntities={handleEntitySelect}
        screenToWorld={screenToWorld}
        findEntityAtPosition={findEntityAtPosition}
        onCameraPan={handleCameraPan}
        onCameraZoom={handleCameraZoom}
        onGatherResources={gatherResource}
      />
      
      {/* Building Placement Mode */}
      {isPlacingBuilding && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-center">
            <p className="text-sm font-medium">
              🏗️ Click on map to place {isPlacingBuilding.replace(/([A-Z])/g, ' $1').trim()}
            </p>
            <p className="text-xs text-gray-400">Press ESC or right-click to cancel</p>
          </div>
        </div>
      )}
      
      {/* Rally Point Placement Mode */}
      {isPlacingRallyPoint && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-center">
            <p className="text-sm font-medium">
              🚩 Click on map to set rally point
            </p>
            <p className="text-xs text-gray-400">Press ESC to cancel</p>
          </div>
        </div>
      )}
      
      {/* Attack-Move Mode Indicator */}
      {isAttackMoveMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-red-900/90 text-white px-4 py-2 rounded-lg text-center border border-red-500">
            <p className="text-sm font-medium">⚔️ Attack Move - Click target location</p>
            <p className="text-xs text-gray-300">Press ESC to cancel</p>
          </div>
        </div>
      )}
    </main>
  );
}

// ============================================================================
// GAME PAGE
// ============================================================================

export default function GamePage() {
  const router = useRouter();
  const [config, setConfig] = useState<GameConfig | null>(null);
  
  // Bridge platform lifecycle
  usePlatformGameplayBridge();
  
  // Initialize from session storage
  useEffect(() => {
    const settings = sessionStorage.getItem('gameSettings');
    if (settings) {
      const { faction, difficulty } = JSON.parse(settings);
      setConfig({
        playerFactionType: faction as FactionType,
        difficulty: difficulty as DifficultyLevel,
      });
    } else {
      router.push('/');
    }
  }, [router]);
  
  // Handle victory/defeat
  const handleVictory = useCallback(() => {
    console.log('[GamePage] Victory!');
  }, []);
  
  const handleDefeat = useCallback(() => {
    console.log('[GamePage] Defeat!');
  }, []);
  
  if (!config) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Initializing game...</div>
      </div>
    );
  }
  
  return (
    <GameProviderV2 config={config} onVictory={handleVictory} onDefeat={handleDefeat}>
      <GameContent />
    </GameProviderV2>
  );
}
