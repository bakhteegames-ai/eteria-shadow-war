'use client';

import { useEffect, useRef, useState } from 'react';
import * as pc from 'playcanvas';
import { useGameStore } from '@/lib/game/store';
import { UNIT_STATS, BUILDING_STATS, TILE_SIZE, CAMERA_SETTINGS, COLORS } from '@/lib/game/constants';
import type { Faction, UnitType, BuildingType } from '@/lib/game/types';

interface GameCanvasProps {
  onEntitySelect: (entityIds: string[], type: 'unit' | 'building') => void;
  onMapClick: (position: { x: number; z: number }) => void;
}

export default function GameCanvas({ onEntitySelect, onMapClick }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<pc.Application | null>(null);
  const cameraRef = useRef<pc.Entity | null>(null);
  const entitiesRef = useRef<Map<string, pc.Entity>>(new Map());
  
  const playerFaction = useGameStore(s => s.playerFaction);
  const playerUnits = useGameStore(s => s.playerUnits);
  const playerBuildings = useGameStore(s => s.playerBuildings);
  const aiUnits = useGameStore(s => s.aiUnits);
  const aiBuildings = useGameStore(s => s.aiBuildings);
  const cameraPosition = useGameStore(s => s.cameraPosition);
  const cameraZoom = useGameStore(s => s.cameraZoom);
  const dispatch = useGameStore(s => s.dispatch);
  const selectedUnits = useGameStore(s => s.selectedUnits);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Prevent context menu
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

    // Camera - positioned over player base initially
    // Player base is at tile (8,8) = world (16,16) with TILE_SIZE=2
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.1, 0.12, 0.18),
      farClip: 500,
      nearClip: 0.1,
      orthoHeight: CAMERA_SETTINGS.initialDistance
    });
    camera.setPosition(25, 50, 25);  // Centered on player base area
    camera.setEulerAngles(-45, -45, 0);
    app.root.addChild(camera);
    cameraRef.current = camera;

    // Light
    const light = new pc.Entity('light');
    light.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.98, 0.95),
      intensity: 1.2
    });
    light.setEulerAngles(45, 30, 0);
    app.root.addChild(light);

    // Ambient
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

    // Decorations - avoid player base (8,8) and AI base (32,32)
    const treeMat = new pc.StandardMaterial();
    treeMat.diffuse = new pc.Color(0.15, 0.35, 0.12);
    treeMat.update();

    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 70 + 5;
      const z = Math.random() * 70 + 5;
      // Avoid player base (around 16,16 world) and AI base (around 64,64 world)
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
      const pu = useGameStore.getState().playerUnits;
      const au = useGameStore.getState().aiUnits;
      const pb = useGameStore.getState().playerBuildings;
      const ab = useGameStore.getState().aiBuildings;
      
      for (const u of pu) {
        const d = Math.hypot(u.position.x - wx, u.position.z - wz);
        if (d < 1.2) return { id: u.id, type: 'unit' as const, isEnemy: false };
      }
      for (const u of au) {
        const d = Math.hypot(u.position.x - wx, u.position.z - wz);
        if (d < 1.2) return { id: u.id, type: 'unit' as const, isEnemy: true };
      }
      for (const b of pb) {
        const d = Math.hypot(b.position.x - wx, b.position.z - wz);
        if (d < 2.5) return { id: b.id, type: 'building' as const, isEnemy: false };
      }
      for (const b of ab) {
        const d = Math.hypot(b.position.x - wx, b.position.z - wz);
        if (d < 2.5) return { id: b.id, type: 'building' as const, isEnemy: true };
      }
      return null;
    };

    app.mouse?.on(pc.EVENT_MOUSEDOWN, (e: pc.MouseEvent) => {
      lastPos = { x: e.x, y: e.y };
      dragStart = { x: e.x, y: e.y };
      
      if (e.button === pc.MOUSEBUTTON_RIGHT) {
        isPanning = true;
      }
    });

    app.mouse?.on(pc.EVENT_MOUSEUP, (e: pc.MouseEvent) => {
      const dx = e.x - dragStart.x;
      const dy = e.y - dragStart.y;
      const wasDrag = Math.hypot(dx, dy) > 5;
      
      if (!wasDrag) {
        if (e.button === pc.MOUSEBUTTON_LEFT) {
          const wp = getWorldPos(e.x, e.y);
          const ent = findEntity(wp.x, wp.z);
          
          if (ent) {
            onEntitySelect([ent.id], ent.type);
          } else {
            const sel = useGameStore.getState().selectedUnits;
            if (sel.length > 0) {
              onMapClick({ x: wp.x / TILE_SIZE, z: wp.z / TILE_SIZE });
            }
          }
        } else if (e.button === pc.MOUSEBUTTON_RIGHT) {
          const wp = getWorldPos(e.x, e.y);
          const ent = findEntity(wp.x, wp.z);
          const sel = useGameStore.getState().selectedUnits;
          
          if (ent?.isEnemy && sel.length > 0) {
            dispatch({ type: 'ATTACK_TARGET', payload: { unitIds: sel, targetId: ent.id } });
          } else if (sel.length > 0) {
            onMapClick({ x: wp.x / TILE_SIZE, z: wp.z / TILE_SIZE });
          }
        }
      }
      
      isDragging = false;
      isPanning = false;
    });

    app.mouse?.on(pc.EVENT_MOUSEMOVE, (e: pc.MouseEvent) => {
      if (isPanning) {
        const dx = e.x - lastPos.x;
        const dy = e.y - lastPos.y;
        const cam = cameraRef.current;
        
        if (cam) {
          const p = cam.getPosition();
          cam.setPosition(
            Math.max(10, Math.min(70, p.x - dx * 0.25)),
            p.y,
            Math.max(10, Math.min(70, p.z - dy * 0.25))
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
        dispatch({ type: 'UPDATE_CAMERA', payload: { zoom: nz } });
      }
    });

    app.start();

    const onResize = () => app.resizeCanvas();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      canvasRef.current?.removeEventListener('contextmenu', preventContext);
      app.destroy();
    };
  }, []);

  // Update entities
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    const allUnits = [...playerUnits, ...aiUnits];
    const allBuildings = [...playerBuildings, ...aiBuildings];

    // Remove old
    entitiesRef.current.forEach((e, id) => {
      const exists = allUnits.some(u => u.id === id) || allBuildings.some(b => b.id === id);
      if (!exists) {
        e.destroy();
        entitiesRef.current.delete(id);
      }
    });

    // Materials
    const getMat = (faction: Faction, isBuilding = false) => {
      const m = new pc.StandardMaterial();
      m.diffuse = faction === 'altera' 
        ? (isBuilding ? new pc.Color(0.15, 0.3, 0.6) : new pc.Color(0.2, 0.45, 0.9))
        : (isBuilding ? new pc.Color(0.5, 0.12, 0.12) : new pc.Color(0.85, 0.2, 0.2));
      m.update();
      return m;
    };

    // Create/update units
    for (const unit of allUnits) {
      let e = entitiesRef.current.get(unit.id);
      
      if (!e) {
        e = new pc.Entity(unit.id);
        const mat = getMat(unit.faction);
        
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

      e.setPosition(unit.position.x * TILE_SIZE, 0, unit.position.z * TILE_SIZE);

      // Selection indicator
      let ring = e.findByName('ring');
      const sel = selectedUnits.includes(unit.id);
      
      if (sel && !ring) {
        ring = new pc.Entity('ring');
        const rm = new pc.StandardMaterial();
        rm.diffuse = new pc.Color(0, 1, 0);
        rm.emissive = new pc.Color(0, 0.4, 0);
        rm.opacity = 0.8;
        rm.blendType = pc.BLEND_NORMAL;
        rm.update();
        (ring as any).addComponent('render', { type: 'ring', material: rm });
        ring.setLocalScale(1, 1, 1);
        ring.setLocalEulerAngles(90, 0, 0);
        ring.setLocalPosition(0, 0.02, 0);
        e.addChild(ring);
      } else if (!sel && ring) {
        ring.destroy();
      }

      // Health bar
      let hp = e.findByName('hp');
      if (!hp) {
        hp = new pc.Entity('hp');
        const bgm = new pc.StandardMaterial();
        bgm.diffuse = new pc.Color(0.15, 0.15, 0.15);
        bgm.update();
        (hp as any).addComponent('render', { type: 'plane', material: bgm });
        hp.setLocalScale(0.65, 0.07, 0.01);
        hp.setLocalEulerAngles(90, 0, 0);
        hp.setLocalPosition(0, 1.4, 0);
        e.addChild(hp);
        
        const fill = new pc.Entity('hpf');
        const fm = new pc.StandardMaterial();
        fm.diffuse = new pc.Color(0, 0.8, 0);
        fm.update();
        (fill as any).addComponent('render', { type: 'plane', material: fm });
        fill.setLocalScale(0.62, 0.05, 0.02);
        fill.setLocalPosition(0, 0, -0.01);
        hp.addChild(fill);
      }
      
      const hpf = hp.findByName('hpf');
      if (hpf) {
        const pct = Math.max(0, unit.stats.health / unit.stats.maxHealth);
        hpf.setLocalScale(0.62 * pct, 0.05, 0.02);
        const m = (hpf as any).render?.material as pc.StandardMaterial;
        if (m) {
          m.diffuse = pct > 0.5 ? new pc.Color(0, 0.8, 0) : pct > 0.25 ? new pc.Color(0.9, 0.9, 0) : new pc.Color(0.9, 0, 0);
          m.update();
        }
      }
    }

    // Create/update buildings
    for (const bld of allBuildings) {
      let e = entitiesRef.current.get(bld.id);
      
      if (!e) {
        e = new pc.Entity(bld.id);
        const mat = getMat(bld.faction, true);
        
        const main = new pc.Entity('main');
        switch (bld.type) {
          case 'townCenter':
            main.addComponent('render', { type: 'cylinder', material: mat });
            main.setLocalScale(2.2, 1.4, 2.2);
            main.setLocalPosition(0, 1.4, 0);
            e.addChild(main);
            
            const roof = new pc.Entity('roof');
            const rm = new pc.StandardMaterial();
            rm.diffuse = new pc.Color(0.35, 0.2, 0.1);
            rm.update();
            roof.addComponent('render', { type: 'cone', material: rm });
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

      e.setPosition(bld.position.x * TILE_SIZE, 0, bld.position.z * TILE_SIZE);
      e.setLocalScale(bld.isConstructing ? Math.max(0.3, bld.constructionProgress / 100) : 1, 1, 1);
    }
  }, [playerUnits, aiUnits, playerBuildings, aiBuildings, selectedUnits, playerFaction]);

  // Camera update
  useEffect(() => {
    const cam = cameraRef.current;
    if (cam?.camera) {
      cam.camera.orthoHeight = cameraZoom;
    }
  }, [cameraZoom]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: 'none', outline: 'none' }}
      tabIndex={0}
    />
  );
}
