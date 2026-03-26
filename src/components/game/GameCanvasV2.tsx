/**
 * GameCanvasV2 - PlayCanvas renderer for new simulation core
 * 
 * Renders the game state from store-v2 using PlayCanvas.
 * Pure presenter component - no game logic here.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as pc from 'playcanvas';
import { useGameStoreV2, selectPlayerUnits, selectEnemyUnits, selectPlayerBuildings, selectEnemyBuildings } from '@/lib/game/store-v2';
import { UNIT_STATS, BUILDING_STATS, MAP_SIZE } from '@/lib/game/core/constants';
import { usePlayerActions } from './GameProviderV2';
import type { EntityId, Unit, Building, ResourceNode, Vec3 } from '@/lib/game/core/types';

// ============================================================================
// TYPES
// ============================================================================

interface CameraFunctions {
  getWorldPos: (screenX: number, screenY: number) => { x: number; z: number };
  findEntity: (worldX: number, worldZ: number) => { id: EntityId; type: 'unit' | 'building' | 'resource'; isEnemy: boolean } | null;
  panCamera: (dx: number, dy: number) => void;
  zoomCamera: (delta: number) => void;
}

interface GameCanvasV2Props {
  onEntitySelect: (entityIds: EntityId[], type: 'unit' | 'building') => void;
  onMapClick: (position: { x: number; z: number }) => void;
  onCameraFunctionsReady?: (funcs: CameraFunctions) => void;
}

// ============================================================================
// CAMERA SETTINGS
// ============================================================================

const CAMERA_SETTINGS = {
  initialDistance: 30,
  minZoom: 15,
  maxZoom: 60,
  panSpeed: 0.3,
};

const TILE_SIZE = MAP_SIZE.tileSize;

// ============================================================================
// COMPONENT
// ============================================================================

export default function GameCanvasV2({ onEntitySelect, onMapClick, onCameraFunctionsReady }: GameCanvasV2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<pc.Application | null>(null);
  const cameraRef = useRef<pc.Entity | null>(null);
  const entitiesRef = useRef<Map<string, pc.Entity>>(new Map());
  const resourceNodesRef = useRef<Map<string, pc.Entity>>(new Map());
  
  // Cached materials (created once, reused)
  const materialsRef = useRef<{
    playerUnit: pc.StandardMaterial | null;
    enemyUnit: pc.StandardMaterial | null;
    playerBuilding: pc.StandardMaterial | null;
    enemyBuilding: pc.StandardMaterial | null;
    resource: pc.StandardMaterial | null;
    selectionRing: pc.StandardMaterial | null;
    healthBarBg: pc.StandardMaterial | null;
    healthBarGreen: pc.StandardMaterial | null;
    healthBarYellow: pc.StandardMaterial | null;
    healthBarRed: pc.StandardMaterial | null;
    roof: pc.StandardMaterial | null;
  }>({
    playerUnit: null,
    enemyUnit: null,
    playerBuilding: null,
    enemyBuilding: null,
    resource: null,
    selectionRing: null,
    healthBarBg: null,
    healthBarGreen: null,
    healthBarYellow: null,
    healthBarRed: null,
    roof: null,
  });
  
  // Store selectors
  const gameState = useGameStoreV2(s => s.state);
  const selectedEntityIds = useGameStoreV2(s => s.selectedEntityIds);
  
  // Player actions
  const { attackTarget, gatherResource } = usePlayerActions();
  
  // Initialize PlayCanvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const preventContext = (e: Event) => e.preventDefault();
    canvasRef.current.addEventListener('contextmenu', preventContext);
    
    // Create PlayCanvas app
    const app = new pc.Application(canvasRef.current, {
      mouse: new pc.Mouse(canvasRef.current),
      touch: new pc.TouchDevice(canvasRef.current)
    });
    appRef.current = app;
    
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    
    // Camera
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.1, 0.12, 0.18),
      farClip: 500,
      nearClip: 0.1,
      orthoHeight: CAMERA_SETTINGS.initialDistance
    });
    camera.setPosition(25, 50, 25);
    camera.setEulerAngles(-45, -45, 0);
    app.root.addChild(camera);
    cameraRef.current = camera;
    
    // Lights
    const light = new pc.Entity('light');
    light.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.98, 0.95),
      intensity: 1.2
    });
    light.setEulerAngles(45, 30, 0);
    app.root.addChild(light);
    
    const ambient = new pc.Entity('ambient');
    ambient.addComponent('light', {
      type: 'omni',
      color: new pc.Color(0.3, 0.3, 0.4),
      intensity: 0.6,
      range: 150
    });
    ambient.setPosition(40, 40, 40);
    app.root.addChild(ambient);
    
    // Ground
    const groundMat = new pc.StandardMaterial();
    groundMat.diffuse = new pc.Color(0.22, 0.4, 0.18);
    groundMat.update();
    
    const ground = new pc.Entity('ground');
    ground.addComponent('render', { type: 'plane', material: groundMat });
    ground.setLocalScale(200, 1, 200);
    ground.setPosition(40, 0, 40);
    app.root.addChild(ground);
    
    // Grid
    const gridMat = new pc.StandardMaterial();
    gridMat.diffuse = new pc.Color(0.15, 0.28, 0.12);
    gridMat.opacity = 0.35;
    gridMat.blendType = pc.BLEND_NORMAL;
    gridMat.update();
    
    for (let i = 0; i <= 80; i += 4) {
      const lx = new pc.Entity(`gx${i}`);
      lx.addComponent('render', { type: 'box', material: gridMat });
      lx.setLocalScale(0.03, 0.01, 80);
      lx.setPosition(i, 0.005, 40);
      app.root.addChild(lx);
      
      const lz = new pc.Entity(`gz${i}`);
      lz.addComponent('render', { type: 'box', material: gridMat });
      lz.setLocalScale(80, 0.01, 0.03);
      lz.setPosition(40, 0.005, i);
      app.root.addChild(lz);
    }
    
    // Decorations - trees
    const treeMat = new pc.StandardMaterial();
    treeMat.diffuse = new pc.Color(0.15, 0.35, 0.12);
    treeMat.update();
    
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 70 + 5;
      const z = Math.random() * 70 + 5;
      if ((x < 25 && z < 25) || (x > 55 && z > 55)) continue;
      
      const tree = new pc.Entity(`tree${i}`);
      tree.addComponent('render', { type: 'cylinder', material: treeMat });
      tree.setLocalScale(0.3, 1.5 + Math.random(), 0.3);
      tree.setPosition(x, 0.75, z);
      app.root.addChild(tree);
      
      const top = new pc.Entity(`top${i}`);
      top.addComponent('render', { type: 'cone', material: treeMat });
      top.setLocalScale(1.3, 2, 1.3);
      top.setPosition(x, 2.5, z);
      app.root.addChild(top);
    }
    
    // Input handling
    let isDragging = false;
    let isPanning = false;
    let isSelecting = false;  // Left-button drag for box selection
    let lastPos = { x: 0, y: 0 };
    let dragStart = { x: 0, y: 0 };
    
    const getWorldPos = (screenX: number, screenY: number) => {
      const cam = cameraRef.current;
      if (!cam || !canvasRef.current) return { x: 40, z: 40 };
      
      const ortho = cam.camera?.orthoHeight || 30;
      const aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
      const nx = (screenX / canvasRef.current.clientWidth) * 2 - 1;
      const ny = -((screenY / canvasRef.current.clientHeight) * 2 - 1);
      const cp = cam.getPosition();
      
      return {
        x: Math.max(0, Math.min(80, cp.x + nx * ortho * aspect * 0.5)),
        z: Math.max(0, Math.min(80, cp.z + ny * ortho * 0.5))
      };
    };
    
    const findEntity = (wx: number, wz: number) => {
      const state = useGameStoreV2.getState().state;
      if (!state) return null;
      
      // Check units
      for (const u of state.units) {
        const d = Math.hypot(u.position.x - wx, u.position.z - wz);
        if (d < 1.2) return { id: u.id, type: 'unit' as const, isEnemy: u.factionId === 'enemy' };
      }
      
      // Check buildings
      for (const b of state.buildings) {
        const d = Math.hypot(b.position.x - wx, b.position.z - wz);
        if (d < 2.5) return { id: b.id, type: 'building' as const, isEnemy: b.factionId === 'enemy' };
      }
      
      // Check resource nodes
      for (const r of state.map.resourceNodes) {
        // Resource position is Vec2 (x, y = grid y), convert to world coords
        const worldX = r.position.x;
        const worldZ = r.position.y;
        const d = Math.hypot(worldX - wx, worldZ - wz);
        if (d < 1.5) return { id: r.id, type: 'resource' as const, isEnemy: false };
      }
      
      return null;
    };
    
    // Camera control functions for touch input
    const panCamera = (dx: number, dy: number) => {
      const cam = cameraRef.current;
      if (!cam) return;
      
      const p = cam.getPosition();
      cam.setPosition(
        Math.max(10, Math.min(70, p.x - dx * CAMERA_SETTINGS.panSpeed)),
        p.y,
        Math.max(10, Math.min(70, p.z - dy * CAMERA_SETTINGS.panSpeed))
      );
    };
    
    const zoomCamera = (delta: number) => {
      const cam = cameraRef.current;
      if (!cam?.camera) return;
      
      const newZoom = Math.max(
        CAMERA_SETTINGS.minZoom,
        Math.min(CAMERA_SETTINGS.maxZoom, (cam.camera.orthoHeight || 30) + delta)
      );
      cam.camera.orthoHeight = newZoom;
    };
    
    // Expose camera functions to parent for touch input
    if (onCameraFunctionsReady) {
      onCameraFunctionsReady({
        getWorldPos,
        findEntity,
        panCamera,
        zoomCamera,
      });
    }
    
    app.mouse?.on(pc.EVENT_MOUSEDOWN, (e: pc.MouseEvent) => {
      lastPos = { x: e.x, y: e.y };
      dragStart = { x: e.x, y: e.y };
      
      if (e.button === pc.MOUSEBUTTON_LEFT) {
        isSelecting = true;
      } else if (e.button === pc.MOUSEBUTTON_RIGHT) {
        isPanning = true;
      }
    });
    
    app.mouse?.on(pc.EVENT_MOUSEUP, (e: pc.MouseEvent) => {
      const dx = e.x - dragStart.x;
      const dy = e.y - dragStart.y;
      const wasDrag = Math.hypot(dx, dy) > 5;
      
      // Box selection with left-button drag
      if (wasDrag && e.button === pc.MOUSEBUTTON_LEFT && isSelecting) {
        const state = useGameStoreV2.getState();
        const gameState = state.state;
        
        if (gameState) {
          // Get world coordinates of drag corners
          const screenMinX = Math.min(dragStart.x, e.x);
          const screenMaxX = Math.max(dragStart.x, e.x);
          const screenMinY = Math.min(dragStart.y, e.y);
          const screenMaxY = Math.max(dragStart.y, e.y);
          
          // Convert all four corners to get correct world bounds
          const worldTopLeft = getWorldPos(screenMinX, screenMinY);
          const worldBottomRight = getWorldPos(screenMaxX, screenMaxY);
          
          // Normalize world-space bounds (Z may be inverted relative to screen Y)
          const minWorldX = Math.min(worldTopLeft.x, worldBottomRight.x);
          const maxWorldX = Math.max(worldTopLeft.x, worldBottomRight.x);
          const minWorldZ = Math.min(worldTopLeft.z, worldBottomRight.z);
          const maxWorldZ = Math.max(worldTopLeft.z, worldBottomRight.z);
          
          // Find all player units within the box
          const selectedUnitIds: EntityId[] = [];
          for (const unit of gameState.units) {
            if (unit.factionId === 'player') {
              const ux = unit.position.x;
              const uz = unit.position.z;
              if (ux >= minWorldX && ux <= maxWorldX &&
                  uz >= minWorldZ && uz <= maxWorldZ) {
                selectedUnitIds.push(unit.id);
              }
            }
          }
          
          if (selectedUnitIds.length > 0) {
            onEntitySelect(selectedUnitIds, 'unit');
          }
        }
      } else if (!wasDrag) {
        const state = useGameStoreV2.getState();
        const selectedIds = state.selectedEntityIds;
        
        if (e.button === pc.MOUSEBUTTON_LEFT) {
          const wp = getWorldPos(e.x, e.y);
          const ent = findEntity(wp.x, wp.z);
          
          // Only select units/buildings (not resources)
          if (ent && (ent.type === 'unit' || ent.type === 'building')) {
            onEntitySelect([ent.id], ent.type);
          } else if (selectedIds.length > 0) {
            onMapClick({ x: wp.x / TILE_SIZE, z: wp.z / TILE_SIZE });
          }
        } else if (e.button === pc.MOUSEBUTTON_RIGHT) {
          const wp = getWorldPos(e.x, e.y);
          const ent = findEntity(wp.x, wp.z);
          
          if (ent?.type === 'resource' && selectedIds.length > 0) {
            // Right-click on resource: gather with selected units
            gatherResource(selectedIds, ent.id);
          } else if (ent?.isEnemy && selectedIds.length > 0) {
            attackTarget(selectedIds, ent.id);
          } else if (selectedIds.length > 0) {
            onMapClick({ x: wp.x / TILE_SIZE, z: wp.z / TILE_SIZE });
          }
        }
      }
      
      isDragging = false;
      isPanning = false;
      isSelecting = false;
    });
    
    app.mouse?.on(pc.EVENT_MOUSEMOVE, (e: pc.MouseEvent) => {
      if (isPanning) {
        const dx = e.x - lastPos.x;
        const dy = e.y - lastPos.y;
        const cam = cameraRef.current;
        
        if (cam) {
          const p = cam.getPosition();
          cam.setPosition(
            Math.max(10, Math.min(70, p.x - dx * CAMERA_SETTINGS.panSpeed)),
            p.y,
            Math.max(10, Math.min(70, p.z - dy * CAMERA_SETTINGS.panSpeed))
          );
        }
      }
      lastPos = { x: e.x, y: e.y };
    });
    
    app.mouse?.on(pc.EVENT_MOUSEWHEEL, (e: pc.MouseEvent) => {
      const cam = cameraRef.current;
      if (cam?.camera) {
        const d = e.wheelDelta > 0 ? -3 : 3;
        const nz = Math.max(CAMERA_SETTINGS.minZoom, Math.min(CAMERA_SETTINGS.maxZoom, (cam.camera.orthoHeight || 30) + d));
        cam.camera.orthoHeight = nz;
      }
    });
    
    // Initialize cached materials
    const mats = materialsRef.current;
    if (!mats.playerUnit) {
      mats.playerUnit = new pc.StandardMaterial();
      mats.playerUnit.diffuse = new pc.Color(0.2, 0.45, 0.9);
      mats.playerUnit.update();
      
      mats.enemyUnit = new pc.StandardMaterial();
      mats.enemyUnit.diffuse = new pc.Color(0.85, 0.2, 0.2);
      mats.enemyUnit.update();
      
      mats.playerBuilding = new pc.StandardMaterial();
      mats.playerBuilding.diffuse = new pc.Color(0.15, 0.3, 0.6);
      mats.playerBuilding.update();
      
      mats.enemyBuilding = new pc.StandardMaterial();
      mats.enemyBuilding.diffuse = new pc.Color(0.5, 0.12, 0.12);
      mats.enemyBuilding.update();
      
      mats.resource = new pc.StandardMaterial();
      mats.resource.diffuse = new pc.Color(0.3, 0.8, 0.9);
      mats.resource.update();
      
      mats.selectionRing = new pc.StandardMaterial();
      mats.selectionRing.diffuse = new pc.Color(0, 1, 0);
      mats.selectionRing.emissive = new pc.Color(0, 0.4, 0);
      mats.selectionRing.opacity = 0.8;
      mats.selectionRing.blendType = pc.BLEND_NORMAL;
      mats.selectionRing.update();
      
      mats.healthBarBg = new pc.StandardMaterial();
      mats.healthBarBg.diffuse = new pc.Color(0.15, 0.15, 0.15);
      mats.healthBarBg.update();
      
      mats.healthBarGreen = new pc.StandardMaterial();
      mats.healthBarGreen.diffuse = new pc.Color(0, 0.8, 0);
      mats.healthBarGreen.update();
      
      mats.healthBarYellow = new pc.StandardMaterial();
      mats.healthBarYellow.diffuse = new pc.Color(0.9, 0.9, 0);
      mats.healthBarYellow.update();
      
      mats.healthBarRed = new pc.StandardMaterial();
      mats.healthBarRed.diffuse = new pc.Color(0.9, 0, 0);
      mats.healthBarRed.update();
      
      mats.roof = new pc.StandardMaterial();
      mats.roof.diffuse = new pc.Color(0.35, 0.2, 0.1);
      mats.roof.update();
    }
    
    app.start();
    
    const onResize = () => app.resizeCanvas();
    window.addEventListener('resize', onResize);
    
    return () => {
      window.removeEventListener('resize', onResize);
      canvasRef.current?.removeEventListener('contextmenu', preventContext);
      app.destroy();
    };
  }, [onEntitySelect, onMapClick, attackTarget, onCameraFunctionsReady]);
  
  // Update entities from game state
  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;
    
    const allUnits = gameState.units;
    const allBuildings = gameState.buildings;
    const resourceNodes = gameState.map.resourceNodes;
    const selectedSet = new Set(selectedEntityIds);
    
    // Remove old entities
    entitiesRef.current.forEach((e, id) => {
      const exists = allUnits.some(u => u.id === id) || allBuildings.some(b => b.id === id);
      if (!exists) {
        e.destroy();
        entitiesRef.current.delete(id);
      }
    });
    
    // Remove old resource nodes
    resourceNodesRef.current.forEach((e, id) => {
      const exists = resourceNodes.some(r => r.id === id);
      if (!exists) {
        e.destroy();
        resourceNodesRef.current.delete(id);
      }
    });
    
    // Get cached material for faction
    const mats = materialsRef.current;
    const getUnitMat = (factionId: string): pc.StandardMaterial => {
      return factionId === 'player' ? mats.playerUnit! : mats.enemyUnit!;
    };
    
    const getBuildingMat = (factionId: string): pc.StandardMaterial => {
      return factionId === 'player' ? mats.playerBuilding! : mats.enemyBuilding!;
    };
    
    // Create/update units
    for (const unit of allUnits) {
      let e = entitiesRef.current.get(unit.id);
      
      if (!e) {
        e = new pc.Entity(unit.id);
        const mat = getUnitMat(unit.factionId);
        
        const body = new pc.Entity('body');
        switch (unit.type) {
          case 'worker':
            body.addComponent('render', { type: 'cylinder', material: mat });
            body.setLocalScale(0.35, 0.3, 0.35);
            body.setLocalPosition(0, 0.25, 0);
            break;
          case 'warrior':
            body.addComponent('render', { type: 'box', material: mat });
            body.setLocalScale(0.5, 0.65, 0.35);
            body.setLocalPosition(0, 0.5, 0);
            break;
          case 'archer':
            body.addComponent('render', { type: 'cylinder', material: mat });
            body.setLocalScale(0.28, 0.55, 0.28);
            body.setLocalPosition(0, 0.45, 0);
            break;
          case 'knight':
            body.addComponent('render', { type: 'box', material: mat });
            body.setLocalScale(0.75, 0.45, 0.45);
            body.setLocalPosition(0, 0.4, 0);
            break;
          case 'mage':
            body.addComponent('render', { type: 'cylinder', material: mat });
            body.setLocalScale(0.4, 0.6, 0.4);
            body.setLocalPosition(0, 0.5, 0);
            break;
        }
        e.addChild(body);
        
        const head = new pc.Entity('head');
        head.addComponent('render', { type: 'sphere', material: mat });
        head.setLocalScale(0.22, 0.22, 0.22);
        head.setLocalPosition(0, unit.type === 'worker' ? 0.55 : 0.95, 0);
        e.addChild(head);
        
        app.root.addChild(e);
        entitiesRef.current.set(unit.id, e);
      }
      
      e.setPosition(unit.position.x, 0, unit.position.z);
      
      // Selection ring
      let ring = e.findByName('ring');
      const isSelected = selectedSet.has(unit.id);
      
      if (isSelected && !ring) {
        ring = new pc.Entity('ring');
        ring.addComponent('render', { type: 'ring', material: mats.selectionRing! });
        ring.setLocalScale(1, 1, 1);
        ring.setLocalEulerAngles(90, 0, 0);
        ring.setLocalPosition(0, 0.02, 0);
        e.addChild(ring);
      } else if (!isSelected && ring) {
        ring.destroy();
      }
      
      // Health bar
      let hp = e.findByName('hp');
      if (!hp) {
        hp = new pc.Entity('hp');
        hp.addComponent('render', { type: 'plane', material: mats.healthBarBg! });
        hp.setLocalScale(0.65, 0.07, 0.01);
        hp.setLocalEulerAngles(90, 0, 0);
        hp.setLocalPosition(0, 1.4, 0);
        e.addChild(hp);
        
        const fill = new pc.Entity('hpf');
        fill.addComponent('render', { type: 'plane', material: mats.healthBarGreen! });
        fill.setLocalScale(0.62, 0.05, 0.02);
        fill.setLocalPosition(0, 0, -0.01);
        hp.addChild(fill);
      }
      
      const hpf = hp.findByName('hpf');
      if (hpf) {
        const pct = Math.max(0, unit.health / unit.stats.maxHealth);
        hpf.setLocalScale(0.62 * pct, 0.05, 0.02);
        // Update health bar material based on percentage (use cached materials)
        const renderComp = hpf.render;
        if (renderComp) {
          let targetMat: pc.StandardMaterial;
          if (pct > 0.5) {
            targetMat = mats.healthBarGreen!;
          } else if (pct > 0.25) {
            targetMat = mats.healthBarYellow!;
          } else {
            targetMat = mats.healthBarRed!;
          }
          // Only update if material changed (avoid unnecessary updates)
          if (renderComp.material !== targetMat) {
            renderComp.material = targetMat;
          }
        }
      }
    }
    
    // Create/update buildings
    for (const bld of allBuildings) {
      let e = entitiesRef.current.get(bld.id);
      
      if (!e) {
        e = new pc.Entity(bld.id);
        const mat = getBuildingMat(bld.factionId);
        
        const main = new pc.Entity('main');
        switch (bld.type) {
          case 'townCenter':
            main.addComponent('render', { type: 'cylinder', material: mat });
            main.setLocalScale(2.2, 1.4, 2.2);
            main.setLocalPosition(0, 1.4, 0);
            e.addChild(main);
            
            const roof = new pc.Entity('roof');
            roof.addComponent('render', { type: 'cone', material: mats.roof! });
            roof.setLocalScale(2.8, 1.3, 2.8);
            roof.setLocalPosition(0, 3.2, 0);
            e.addChild(roof);
            break;
          default:
            main.addComponent('render', { type: 'box', material: mat });
            main.setLocalScale(2, 1.2, 1.8);
            main.setLocalPosition(0, 1.2, 0);
            e.addChild(main);
        }
        
        app.root.addChild(e);
        entitiesRef.current.set(bld.id, e);
      }
      
      e.setPosition(bld.position.x, 0, bld.position.z);
      e.setLocalScale(bld.isConstructing ? Math.max(0.3, bld.constructionProgress / 100) : 1, 1, 1);
    }
    
    // Create/update resource nodes (use cached material)
    for (const node of resourceNodes) {
      let e = resourceNodesRef.current.get(node.id);
      
      if (!e) {
        e = new pc.Entity(node.id);
        e.addComponent('render', { type: 'sphere', material: mats.resource! });
        e.setLocalScale(1, 1, 1);
        app.root.addChild(e);
        resourceNodesRef.current.set(node.id, e);
      }
      
      e.setPosition(node.position.x, 0.5, node.position.y);
      // Scale based on remaining resources
      const scale = Math.max(0.3, node.amount / node.maxAmount);
      e.setLocalScale(scale, scale, scale);
    }
    
  }, [gameState, selectedEntityIds]);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: 'none', outline: 'none' }}
      tabIndex={0}
    />
  );
}
