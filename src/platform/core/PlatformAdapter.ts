/**
 * Platform Adapter Interface
 * The canonical interface that all platform adapters must implement
 */

import type {
  PlatformId,
  PlatformCapabilities,
  PlayerProfile,
  SaveData,
  AdResult,
  LeaderboardEntry,
} from './PlatformTypes';
import { platformEvents } from './PlatformEvents';

export interface PlatformAdapter {
  // Identity
  readonly id: PlatformId;
  readonly displayName: string;

  // Capabilities
  readonly capabilities: PlatformCapabilities;
  hasCapability(key: keyof PlatformCapabilities): boolean;

  // Lifecycle
  initialize(): Promise<void>;
  isAvailable(): boolean;
  isInitialized(): boolean;

  // Gameplay control
  pauseGameplay(reason?: string): void;
  resumeGameplay(reason?: string): void;

  // Fullscreen (optional based on capabilities)
  requestFullscreen?(): Promise<boolean>;
  exitFullscreen?(): Promise<boolean>;

  // Ads (optional based on capabilities)
  showInterstitialAd?(): Promise<AdResult>;
  showRewardedAd?(): Promise<AdResult>;

  // Storage (optional based on capabilities)
  saveData?(data: SaveData): Promise<boolean>;
  loadData?(): Promise<SaveData | null>;

  // Player (optional based on capabilities)
  getPlayerProfile?(): Promise<PlayerProfile | null>;
  isPlayerAuthorized?(): boolean;

  // Leaderboards (optional based on capabilities)
  submitScore?(leaderboardId: string, score: number): Promise<boolean>;
  getLeaderboard?(leaderboardId: string, limit?: number): Promise<LeaderboardEntry[]>;

  // Locale (optional based on capabilities)
  getLocale?(): Promise<string | null>;

  // Analytics
  trackEvent?(eventName: string, params?: Record<string, unknown>): void;

  // Cleanup
  destroy?(): void;
}

/**
 * Base adapter class with common functionality
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly id: PlatformId;
  abstract readonly displayName: string;
  abstract readonly capabilities: PlatformCapabilities;

  private _initialized = false;

  hasCapability(key: keyof PlatformCapabilities): boolean {
    return this.capabilities[key] === true;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  protected setInitialized(value: boolean): void {
    this._initialized = value;
  }

  abstract initialize(): Promise<void>;
  abstract isAvailable(): boolean;

  pauseGameplay(reason: string = 'unknown'): void {
    platformEvents.emit('platform:pause', { reason: reason as any });
    console.log(`[Platform:${this.id}] Gameplay paused: ${reason}`);
  }

  resumeGameplay(reason: string = 'unknown'): void {
    platformEvents.emit('platform:resume', { reason: reason as any });
    console.log(`[Platform:${this.id}] Gameplay resumed: ${reason}`);
  }

  destroy?(): void {
    this._initialized = false;
  }
}
