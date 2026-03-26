/**
 * CrazyGames Adapter
 * Detects CrazyGames SDK presence safely, does not crash if absent
 * 
 * IMPORTANT: CrazyGames forbids custom fullscreen buttons!
 * The adapter sets fullscreenAllowed: false
 * 
 * SDK Access Pattern (current official SDK v3):
 * - window.CrazyGames.SDK is the main namespace
 * - SDK is typically injected by CrazyGames platform
 * - For standalone testing, can load from CDN
 */

import { BasePlatformAdapter } from '../core/PlatformAdapter';
import { CRAZYGAMES_CAPABILITIES } from '../core/PlatformCapabilities';
import type { SaveData, AdResult, PlayerProfile, LeaderboardEntry } from '../core/PlatformTypes';
import { platformEvents } from '../core/PlatformEvents';
import { loadCrazyGamesSDK } from '../core/SDKLoader';

// Type declarations for CrazyGames SDK v3
declare global {
  interface Window {
    CrazyGames?: {
      SDK: CrazyGamesSDKV3;
    };
  }
}

// CrazyGames SDK v3 interface
interface CrazyGamesSDKV3 {
  game: {
    gameplayStart: () => void;
    gameplayStop: () => void;
    happyTime: (intensity: number) => void;
    requestGameplay: (callback: () => void) => void;
    loadingStart: () => void;
    loadingStop: () => void;
  };
  ad: {
    requestAd: (type: 'midgame' | 'rewarded', callbacks: {
      adStarted?: () => void;
      adFinished?: () => void;
      adError?: (error: string) => void;
    }) => void;
    hasAdblock: () => boolean;
  };
  user: {
    getSystemInfo: () => Promise<{
      device: { type: string };
      browser: { name: string; version: string };
      os: { name: string };
    }>;
    isUserAccountAvailable: () => Promise<boolean>;
    getUser: () => Promise<{
      username: string;
      profilePictureUrl: string;
    } | null>;
    showSigninModal: () => Promise<void>;
    addAuthListener: (callback: (user: { username: string; profilePictureUrl: string } | null) => void) => void;
  };
  data: {
    init: (options: { defaultData: Record<string, unknown> }) => Promise<void>;
    setData: (key: string, value: unknown) => Promise<void>;
    getData: (key: string) => Promise<unknown>;
  };
  leaderboard: {
    submitScore: (id: string, score: number) => Promise<void>;
    getLeaderboard: (id: string) => Promise<{
      result: Array<{
        rank: number;
        score: number;
        user: { username: string; profilePictureUrl: string } | null;
      }>;
    }>;
  };
}

const STORAGE_KEY = 'eteria_crazy_fallback';

// Track if SDK load was attempted
let sdkLoadAttempted = false;

export class CrazyGamesAdapter extends BasePlatformAdapter {
  readonly id = 'crazygames' as const;
  readonly displayName = 'CrazyGames';
  // IMPORTANT: fullscreenAllowed is FALSE - CrazyGames provides its own fullscreen
  readonly capabilities = CRAZYGAMES_CAPABILITIES;

  private sdk: CrazyGamesSDKV3 | null = null;
  private userAuthorized = false;

  /**
   * Check if CrazyGames SDK v3 is available in window
   */
  isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           window.CrazyGames !== undefined && 
           window.CrazyGames.SDK !== undefined;
  }

  /**
   * Get SDK reference from window (v3 namespace)
   */
  private getSDK(): CrazyGamesSDKV3 | null {
    if (this.sdk) return this.sdk;
    if (typeof window === 'undefined') return null;
    
    // v3 SDK: window.CrazyGames.SDK
    this.sdk = window.CrazyGames?.SDK || null;
    return this.sdk;
  }

  async initialize(): Promise<void> {
    // First, try to load the SDK if not already available
    // Note: This is mainly for standalone testing
    // In production, CrazyGames injects their SDK automatically
    if (!this.isAvailable() && !sdkLoadAttempted) {
      sdkLoadAttempted = true;
      console.log('[CrazyGames] SDK not present, attempting to load...');
      
      const loadResult = await loadCrazyGamesSDK();
      if (!loadResult.success) {
        console.warn('[CrazyGames] SDK load failed:', loadResult.error);
        console.warn('[CrazyGames] Running in degraded mode without SDK');
        this.setInitialized(true);
        return;
      }
    }

    const sdk = this.getSDK();

    if (!sdk) {
      console.warn('[CrazyGames] SDK not present, running in degraded mode');
      this.setInitialized(true);
      return;
    }

    try {
      console.log('[CrazyGames] Initializing SDK...');

      // Check user auth status
      if (sdk.user) {
        try {
          this.userAuthorized = await sdk.user.isUserAccountAvailable();
          console.log('[CrazyGames] User authorized:', this.userAuthorized);
        } catch {
          console.log('[CrazyGames] User auth check failed');
        }
      }

      // Notify game started
      if (sdk.game?.gameplayStart) {
        sdk.game.gameplayStart();
      }

      console.log('[CrazyGames] SDK initialized successfully');
      this.setInitialized(true);
    } catch (error) {
      console.error('[CrazyGames] SDK initialization failed:', error);
      this.setInitialized(true); // Allow degraded operation
    }
  }

  // Fullscreen - NOT ALLOWED on CrazyGames!
  async requestFullscreen(): Promise<boolean> {
    console.warn('[CrazyGames] Custom fullscreen is FORBIDDEN on CrazyGames');
    return false;
  }

  async exitFullscreen(): Promise<boolean> {
    console.warn('[CrazyGames] Custom fullscreen is FORBIDDEN on CrazyGames');
    return false;
  }

  // Ads
  async showInterstitialAd(): Promise<AdResult> {
    const sdk = this.getSDK();
    if (!sdk?.ad) {
      return { ok: false, shown: false, error: 'SDK not available' };
    }

    return new Promise((resolve) => {
      sdk.ad.requestAd('midgame', {
        adStarted: () => {
          platformEvents.emit('platform:ad_start', { type: 'interstitial' });
          this.pauseGameplay('ad');
        },
        adFinished: () => {
          platformEvents.emit('platform:ad_complete', { type: 'interstitial', rewarded: false });
          this.resumeGameplay('ad_complete');
          resolve({ ok: true, shown: true });
        },
        adError: (error) => {
          console.error('[CrazyGames] Interstitial ad error:', error);
          resolve({ ok: false, shown: false, error });
        },
      });
    });
  }

  async showRewardedAd(): Promise<AdResult> {
    const sdk = this.getSDK();
    if (!sdk?.ad) {
      return { ok: false, shown: false, rewarded: false, error: 'SDK not available' };
    }

    return new Promise((resolve) => {
      sdk.ad.requestAd('rewarded', {
        adStarted: () => {
          platformEvents.emit('platform:ad_start', { type: 'rewarded' });
          this.pauseGameplay('ad');
        },
        adFinished: () => {
          platformEvents.emit('platform:ad_complete', { type: 'rewarded', rewarded: true });
          this.resumeGameplay('ad_complete');
          resolve({ ok: true, shown: true, rewarded: true });
        },
        adError: (error) => {
          console.error('[CrazyGames] Rewarded ad error:', error);
          resolve({ ok: false, shown: false, rewarded: false, error });
        },
      });
    });
  }

  // Storage
  async saveData(data: SaveData): Promise<boolean> {
    const sdk = this.getSDK();

    if (sdk?.data) {
      try {
        await sdk.data.setData('gameSave', data);
        return true;
      } catch (error) {
        console.error('[CrazyGames] SDK save failed:', error);
      }
    }

    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async loadData(): Promise<SaveData | null> {
    const sdk = this.getSDK();

    if (sdk?.data) {
      try {
        const data = await sdk.data.getData('gameSave');
        return data as SaveData | null;
      } catch (error) {
        console.error('[CrazyGames] SDK load failed:', error);
      }
    }

    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // Player
  async getPlayerProfile(): Promise<PlayerProfile | null> {
    const sdk = this.getSDK();

    if (!sdk?.user || !this.userAuthorized) {
      return null;
    }

    try {
      const user = await sdk.user.getUser();
      if (!user) {
        return null;
      }
      return {
        id: 'crazygames_user',
        name: user.username,
        avatarUrl: user.profilePictureUrl,
        isAuthorized: true,
      };
    } catch {
      return null;
    }
  }

  isPlayerAuthorized(): boolean {
    return this.userAuthorized;
  }

  async showSignIn(): Promise<boolean> {
    const sdk = this.getSDK();
    if (!sdk?.user?.showSigninModal) return false;

    try {
      await sdk.user.showSigninModal();
      this.userAuthorized = await sdk.user.isUserAccountAvailable();
      return this.userAuthorized;
    } catch {
      return false;
    }
  }

  // Leaderboards
  async submitScore(leaderboardId: string, score: number): Promise<boolean> {
    const sdk = this.getSDK();
    if (!sdk?.leaderboard) return false;

    try {
      await sdk.leaderboard.submitScore(leaderboardId, score);
      return true;
    } catch (error) {
      console.error('[CrazyGames] Submit score failed:', error);
      return false;
    }
  }

  async getLeaderboard(leaderboardId: string): Promise<LeaderboardEntry[]> {
    const sdk = this.getSDK();
    if (!sdk?.leaderboard) return [];

    try {
      const result = await sdk.leaderboard.getLeaderboard(leaderboardId);
      return result.result.map((entry) => ({
        rank: entry.rank,
        score: entry.score,
        playerName: entry.user?.username || 'Anonymous',
        playerAvatar: entry.user?.profilePictureUrl,
      }));
    } catch (error) {
      console.error('[CrazyGames] Get leaderboard failed:', error);
      return [];
    }
  }

  // Game lifecycle
  gameplayStart(): void {
    const sdk = this.getSDK();
    sdk?.game?.gameplayStart?.();
  }

  gameplayStop(): void {
    const sdk = this.getSDK();
    sdk?.game?.gameplayStop?.();
  }

  happyTime(intensity: number = 1): void {
    const sdk = this.getSDK();
    sdk?.game?.happyTime?.(intensity);
  }

  // Analytics
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    console.log(`[CrazyGames] Event: ${eventName}`, params || '');
  }

  destroy(): void {
    const sdk = this.getSDK();
    sdk?.game?.gameplayStop?.();
    this.sdk = null;
    this.userAuthorized = false;
    this.setInitialized(false);
  }
}
