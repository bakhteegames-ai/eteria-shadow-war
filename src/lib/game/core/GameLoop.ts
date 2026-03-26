/**
 * Eteria: Shadow War - Game Loop
 * 
 * Fixed timestep simulation loop independent of render frame rate.
 * Ensures deterministic behavior across different frame rates.
 * 
 * Design principles:
 * - Fixed timestep (60Hz simulation)
 * - Accumulator pattern for frame rate independence
 * - Max catch-up to prevent spiral of death
 * - Pause/resume support
 * - No DOM/PlayCanvas dependencies
 */

import type { GameStateV2, GameCommand } from './types';
import { tickSimulation, type TickResult } from './simulation';
import { SIMULATION_CONFIG } from './constants';

// ============================================================================
// TYPES
// ============================================================================

export interface GameLoopCallbacks {
  /** Called after each simulation tick with new state */
  onTick: (state: GameStateV2) => void;
  /** Called when game is paused */
  onPause?: () => void;
  /** Called when game is resumed */
  onResume?: () => void;
  /** Called on phase change (victory/defeat) */
  onPhaseChange?: (phase: GameStateV2['simulation']['phase']) => void;
}

export interface GameLoopState {
  isRunning: boolean;
  isPaused: boolean;
  tick: number;
  accumulator: number;
  lastTime: number;
}

// ============================================================================
// GAME LOOP CLASS
// ============================================================================

/**
 * Fixed timestep game loop
 * 
 * Usage:
 * ```ts
 * const loop = new GameLoop(initialState, callbacks);
 * loop.start();
 * // Later:
 * loop.pause();
 * loop.resume();
 * loop.stop();
 * ```
 */
export class GameLoop {
  private state: GameStateV2;
  private callbacks: GameLoopCallbacks;
  private loopState: GameLoopState;
  private rafId: number | null = null;
  private boundTick: (time: number) => void;
  
  /** Pending commands to process on next tick */
  private pendingCommands: GameCommand[] = [];
  
  constructor(initialState: GameStateV2, callbacks: GameLoopCallbacks) {
    this.state = initialState;
    this.callbacks = callbacks;
    this.loopState = {
      isRunning: false,
      isPaused: false,
      tick: 0,
      accumulator: 0,
      lastTime: 0,
    };
    this.boundTick = this.tick.bind(this);
  }
  
  /**
   * Start the game loop
   */
  start(): void {
    if (this.loopState.isRunning) return;
    
    this.loopState.isRunning = true;
    this.loopState.isPaused = false;
    this.loopState.accumulator = 0;
    this.loopState.lastTime = performance.now();
    
    this.rafId = requestAnimationFrame(this.boundTick);
  }
  
  /**
   * Stop the game loop completely
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.loopState.isRunning = false;
  }
  
  /**
   * Pause the game loop
   */
  pause(): void {
    if (!this.loopState.isRunning || this.loopState.isPaused) return;
    
    this.loopState.isPaused = true;
    this.callbacks.onPause?.();
  }
  
  /**
   * Resume the game loop
   */
  resume(): void {
    if (!this.loopState.isRunning || !this.loopState.isPaused) return;
    
    this.loopState.isPaused = false;
    this.loopState.lastTime = performance.now();
    this.callbacks.onResume?.();
  }
  
  /**
   * Toggle pause state
   */
  togglePause(): void {
    if (this.loopState.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }
  
  /**
   * Submit a command to be processed on next tick
   */
  submitCommand(command: GameCommand): void {
    this.pendingCommands.push(command);
  }
  
  /**
   * Submit multiple commands
   */
  submitCommands(commands: GameCommand[]): void {
    this.pendingCommands.push(...commands);
  }
  
  /**
   * Get current game state (read-only snapshot)
   */
  getState(): Readonly<GameStateV2> {
    return this.state;
  }
  
  /**
   * Get current tick number
   */
  getTick(): number {
    return this.loopState.tick;
  }
  
  /**
   * Check if loop is running
   */
  isRunning(): boolean {
    return this.loopState.isRunning;
  }
  
  /**
   * Check if loop is paused
   */
  isPaused(): boolean {
    return this.loopState.isPaused;
  }
  
  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================
  
  /**
   * Main tick function - called by requestAnimationFrame
   */
  private tick(time: number): void {
    if (!this.loopState.isRunning) return;
    
    // Calculate delta time
    const deltaTime = time - this.loopState.lastTime;
    this.loopState.lastTime = time;
    
    // Skip if paused
    if (this.loopState.isPaused) {
      this.rafId = requestAnimationFrame(this.boundTick);
      return;
    }
    
    // Add to accumulator (clamped to prevent spiral of death)
    this.loopState.accumulator += Math.min(deltaTime, SIMULATION_CONFIG.maxFrameTime);
    
    // Fixed timestep updates
    const fixedTimestep = SIMULATION_CONFIG.fixedTimestep;
    let ticksThisFrame = 0;
    const maxTicksPerFrame = 10; // Safety limit
    
    while (
      this.loopState.accumulator >= fixedTimestep && 
      ticksThisFrame < maxTicksPerFrame
    ) {
      // Process pending commands
      const commands = this.pendingCommands;
      this.pendingCommands = [];
      
      // Run simulation tick
      const result: TickResult = tickSimulation(this.state, fixedTimestep / 1000, commands);
      this.state = result.state;
      
      // Queue AI commands for next tick processing
      if (result.aiCommands.length > 0) {
        this.pendingCommands.push(...result.aiCommands);
      }
      
      this.loopState.accumulator -= fixedTimestep;
      this.loopState.tick++;
      ticksThisFrame++;
      
      // Check for phase change
      if (this.state.simulation.phase !== 'running') {
        this.callbacks.onPhaseChange?.(this.state.simulation.phase);
        // Don't stop - let the UI handle victory/defeat
      }
    }
    
    // Notify callback with updated state
    this.callbacks.onTick(this.state);
    
    // Schedule next frame
    this.rafId = requestAnimationFrame(this.boundTick);
  }
}

// ============================================================================
// HEADLESS SIMULATION
// ============================================================================

/**
 * Run simulation without rendering (for testing)
 * Returns final state after running for specified ticks
 */
export function runSimulationHeadless(
  initialState: GameStateV2,
  ticks: number,
  commandsPerTick?: (tick: number, state: GameStateV2) => GameCommand[]
): GameStateV2 {
  let state = initialState;
  let pendingCommands: GameCommand[] = [];
  const fixedTimestep = SIMULATION_CONFIG.fixedTimestep / 1000;
  
  for (let i = 0; i < ticks; i++) {
    const commands = [...pendingCommands, ...(commandsPerTick?.(i, state) ?? [])];
    pendingCommands = [];
    const result = tickSimulation(state, fixedTimestep, commands);
    state = result.state;
    pendingCommands.push(...result.aiCommands);
  }
  
  return state;
}

/**
 * Run simulation for a duration (in seconds)
 */
export function runSimulationForDuration(
  initialState: GameStateV2,
  durationSeconds: number,
  commandsPerTick?: (tick: number, state: GameStateV2) => GameCommand[]
): GameStateV2 {
  const ticksPerSecond = SIMULATION_CONFIG.ticksPerSecond;
  const totalTicks = Math.floor(durationSeconds * ticksPerSecond);
  return runSimulationHeadless(initialState, totalTicks, commandsPerTick);
}
