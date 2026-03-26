/**
 * InputController - Unified input handling for desktop and mobile
 * 
 * Handles:
 * - Touch gestures (tap, long-press, pinch-zoom, two-finger pan)
 * - Mouse input (click, drag, scroll)
 * - Keyboard shortcuts
 * - Gamepad support (future)
 */

import type { EntityId, Vec3, Vec2 } from '@/lib/game/core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface InputCallbacks {
  // Selection
  onSelectEntities: (ids: EntityId[], addToSelection: boolean) => void;
  onClearSelection: () => void;
  
  // Movement
  onMoveUnits: (unitIds: EntityId[], target: Vec3) => void;
  onAttackMove: (unitIds: EntityId[], target: Vec3) => void;
  
  // Combat
  onAttackTarget: (unitIds: EntityId[], targetId: EntityId) => void;
  
  // Building
  onStartBuilding: (type: string) => void;
  onCancelBuilding: () => void;
  onPlaceBuilding: (position: Vec2) => void;
  
  // Camera
  onCameraPan: (dx: number, dy: number) => void;
  onCameraZoom: (delta: number, center?: { x: number; y: number }) => void;
  
  // Game
  onPause: () => void;
  onResume: () => void;
  onStopUnits: (unitIds: EntityId[]) => void;
  
  // Coordinate conversion - required for live touch input
  screenToWorld: (screenX: number, screenY: number) => Vec3;
  
  // Entity query - required for touch selection
  findEntityAtPosition: (worldX: number, worldZ: number) => { id: EntityId; type: 'unit' | 'building' | 'resource'; isEnemy: boolean } | null;
  
  // Economy
  onGatherResources: (workerIds: EntityId[], resourceId: EntityId) => void;
}

export interface InputState {
  selectedUnits: EntityId[];
  isPlacingBuilding: boolean;
  buildingType: string | null;
  isPaused: boolean;
}

// ============================================================================
// TOUCH CONTROLLER
// ============================================================================

export class TouchController {
  private element: HTMLElement;
  private callbacks: InputCallbacks;
  private getState: () => InputState;
  
  // Touch state
  private touches: Map<number, Touch> = new Map();
  private lastTouchTime: number = 0;
  private lastTapTime: number = 0;
  private longPressTimer: NodeJS.Timeout | null = null;
  private initialPinchDistance: number = 0;
  private isPanning: boolean = false;
  
  // Single-touch gesture state
  private isDragging: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private lastTouchX: number = 0;
  private lastTouchY: number = 0;
  
  // Two-touch gesture state
  private lastCenterX: number = 0;
  private lastCenterY: number = 0;
  
  // Gesture thresholds
  private readonly TAP_THRESHOLD = 10; // pixels
  private readonly LONG_PRESS_DELAY = 500; // ms
  private readonly DOUBLE_TAP_DELAY = 300; // ms
  private readonly PINCH_ZOOM_THRESHOLD = 10; // pixels
  
  constructor(element: HTMLElement, callbacks: InputCallbacks, getState: () => InputState) {
    this.element = element;
    this.callbacks = callbacks;
    this.getState = getState;
    
    this.bindEvents();
  }
  
  private bindEvents(): void {
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
  }
  
  destroy(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);
  }
  
  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    
    // Store all touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touches.set(touch.identifier, touch);
    }
    
    const touchCount = this.touches.size;
    
    if (touchCount === 1) {
      // Single touch - could be tap, long-press, or drag
      const touch = e.touches[0];
      this.lastTouchTime = Date.now();
      
      // Store true touch-start position (for tap detection)
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      // Store previous-frame position (for pan deltas)
      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
      // Reset drag state
      this.isDragging = false;
      
      // Start long-press timer
      this.longPressTimer = setTimeout(() => {
        this.handleLongPress(touch);
      }, this.LONG_PRESS_DELAY);
      
    } else if (touchCount === 2) {
      // Two fingers - pinch zoom or pan
      this.clearLongPressTimer();
      
      const touches = Array.from(this.touches.values());
      this.initialPinchDistance = this.getDistance(touches[0], touches[1]);
      
      // Store initial center for delta calculation
      this.lastCenterX = (touches[0].clientX + touches[1].clientX) / 2;
      this.lastCenterY = (touches[0].clientY + touches[1].clientY) / 2;
      this.isPanning = true;
    }
  };
  
  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    
    // Update stored touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touches.set(touch.identifier, touch);
    }
    
    const touchCount = this.touches.size;
    
    if (touchCount === 1) {
      // Single finger - cancel long-press on any movement
      this.clearLongPressTimer();
      
      const touch = e.touches[0];
      
      // Check if moved beyond tap threshold from START position
      const totalDx = touch.clientX - this.touchStartX;
      const totalDy = touch.clientY - this.touchStartY;
      const totalDistance = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
      
      if (!this.isDragging && totalDistance > this.TAP_THRESHOLD) {
        // Transition from potential-tap to drag mode
        this.isDragging = true;
      }
      
      if (this.isDragging) {
        // Compute per-frame delta for smooth pan
        const dx = touch.clientX - this.lastTouchX;
        const dy = touch.clientY - this.lastTouchY;
        this.callbacks.onCameraPan(-dx * 0.5, -dy * 0.5);
      }
      
      // Update last position for next frame
      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
    } else if (touchCount === 2) {
      // Two finger gestures
      const touches = Array.from(this.touches.values());
      const currentDistance = this.getDistance(touches[0], touches[1]);
      
      // Compute current center
      const centerX = (touches[0].clientX + touches[1].clientX) / 2;
      const centerY = (touches[0].clientY + touches[1].clientY) / 2;
      
      // Pinch zoom
      if (Math.abs(currentDistance - this.initialPinchDistance) > this.PINCH_ZOOM_THRESHOLD) {
        const delta = (currentDistance - this.initialPinchDistance) * 0.05;
        this.callbacks.onCameraZoom(-delta, { x: centerX, y: centerY });
        this.initialPinchDistance = currentDistance;
      }
      
      // Pan camera using center delta (can happen alongside zoom)
      const dx = centerX - this.lastCenterX;
      const dy = centerY - this.lastCenterY;
      
      // Update last center for next frame
      this.lastCenterX = centerX;
      this.lastCenterY = centerY;
      
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        this.callbacks.onCameraPan(-dx * 0.5, -dy * 0.5);
      }
    }
  };
  
  private handleTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    
    const touchCount = this.touches.size;
    
    // Check for tap (only if not dragging)
    if (touchCount === 1 && !this.isDragging) {
      const touch = e.changedTouches[0];
      
      // Use stored touch-start position (not the updated touch in map)
      const dx = touch.clientX - this.touchStartX;
      const dy = touch.clientY - this.touchStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < this.TAP_THRESHOLD) {
        // It's a tap
        const now = Date.now();
        const timeSinceLastTap = now - this.lastTapTime;
        
        if (timeSinceLastTap < this.DOUBLE_TAP_DELAY) {
          // Double tap
          this.handleDoubleTap(touch);
        } else {
          // Single tap
          this.handleTap(touch);
        }
        
        this.lastTapTime = now;
      }
    }
    
    // Remove ended touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touches.delete(touch.identifier);
    }
    
    this.clearLongPressTimer();
    this.isPanning = false;
  };
  
  private handleTouchCancel = (e: TouchEvent): void => {
    this.touches.clear();
    this.clearLongPressTimer();
    this.isPanning = false;
  };
  
  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
  
  private getDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  private handleTap(touch: Touch): void {
    const state = this.getState();
    const worldPos = this.callbacks.screenToWorld(touch.clientX, touch.clientY);
    
    // 1. Placement mode (building or rally point) takes priority
    if (state.isPlacingBuilding) {
      this.callbacks.onPlaceBuilding({ x: worldPos.x, y: worldPos.z });
      return;
    }
    
    // Check for entity at tap position
    const entity = this.callbacks.findEntityAtPosition(worldPos.x, worldPos.z);
    
    if (entity) {
      // 2. If resource node and player has selected units, issue gather command
      if (entity.type === 'resource') {
        if (state.selectedUnits.length > 0) {
          this.callbacks.onGatherResources(state.selectedUnits, entity.id);
        }
        // Resources are not selectable - do nothing if no units selected
        return;
      }
      
      // 3. If enemy and player has selected units, issue attack command
      if (entity.isEnemy && state.selectedUnits.length > 0) {
        this.callbacks.onAttackTarget(state.selectedUnits, entity.id);
        return;
      }
      
      // 4. Select the entity (friendly unit/building)
      this.callbacks.onSelectEntities([entity.id], false);
      return;
    }
    
    // 5. No entity - move selected units if any
    if (state.selectedUnits.length > 0) {
      this.callbacks.onMoveUnits(state.selectedUnits, worldPos);
    }
  }
  
  private handleDoubleTap(touch: Touch): void {
    const state = this.getState();
    
    if (state.selectedUnits.length > 0) {
      // Attack move
      const worldPos = this.callbacks.screenToWorld(touch.clientX, touch.clientY);
      this.callbacks.onAttackMove(state.selectedUnits, worldPos);
    }
  }
  
  private handleLongPress(touch: Touch): void {
    // Long press - could be used for context menu or special actions
    console.log('[TouchController] Long press detected');
  }
}

// ============================================================================
// KEYBOARD CONTROLLER
// ============================================================================

export class KeyboardController {
  private callbacks: InputCallbacks;
  private getState: () => InputState;
  
  // Key states
  private pressedKeys: Set<string> = new Set();
  
  constructor(callbacks: InputCallbacks, getState: () => InputState) {
    this.callbacks = callbacks;
    this.getState = getState;
    
    this.bindEvents();
  }
  
  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }
  
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.pressedKeys.has(e.key)) return;
    this.pressedKeys.add(e.key);
    
    const state = this.getState();
    
    switch (e.key.toLowerCase()) {
      case 'escape':
        if (state.isPlacingBuilding) {
          this.callbacks.onCancelBuilding();
        } else {
          this.callbacks.onClearSelection();
        }
        break;
        
      case 's':
        // Stop units
        if (state.selectedUnits.length > 0) {
          this.callbacks.onStopUnits(state.selectedUnits);
        }
        break;
        
      case 'p':
      case 'pause':
        if (state.isPaused) {
          this.callbacks.onResume();
        } else {
          this.callbacks.onPause();
        }
        break;
        
      // Number keys for control groups (future)
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '0':
        // TODO: Control groups
        break;
    }
  };
  
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.pressedKeys.delete(e.key);
  };
}

// ============================================================================
// INPUT MANAGER
// ============================================================================

export class InputManager {
  private touchController: TouchController | null = null;
  private keyboardController: KeyboardController | null = null;
  
  constructor(
    element: HTMLElement,
    callbacks: InputCallbacks,
    getState: () => InputState
  ) {
    // Initialize touch controller
    this.touchController = new TouchController(element, callbacks, getState);
    
    // Initialize keyboard controller
    this.keyboardController = new KeyboardController(callbacks, getState);
    
    console.log('[InputManager] Initialized');
  }
  
  destroy(): void {
    this.touchController?.destroy();
    this.keyboardController?.destroy();
    console.log('[InputManager] Destroyed');
  }
}
