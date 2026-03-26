/**
 * Yandex Games Adapter
 * Properly loads Yandex SDK before initialization
 * Falls back to degraded mode if SDK unavailable
 */

import { BasePlatformAdapter } from '../core/PlatformAdapter';
import { YANDEX_CAPABILITIES } from '../core/PlatformCapabilities';
import type { SaveData, AdResult, PlayerProfile, LeaderboardEntry } from '../core/PlatformTypes';
import { platformEvents } from '../core/PlatformEvents';
import { loadYandexSDK } from '../core/SDKLoader';

// Yandex SDK types
interface YandexSDK {
  environment: {
    i18n: { lang: string };
    payload: string;
  };
  getPlayer: (options?: { signed: boolean }) => Promise<YandexPlayer>;
  getLeaderboards: () => Promise<YandexLeaderboards>;
  adv: {
    showFullscreenAdv: (callbacks: {
      onOpen?: () => void;
      onClose?: (wasShown: boolean) => void;
      onError?: (error: Error) => void;
    }) => void;
    showRewardedVideo: (callbacks: {
      onOpen?: () => void;
      onRewarded?: () => void;
      onClose?: () => void;
      onError?: (error: Error) => void;
    }) => void;
  };
  analytics: {
    hit: (url?: string) => void;
    goal: (name: string, params?: Record<string, unknown>) => void;
  };
  deviceInfo: {
    type: 'desktop' | 'mobile' | 'tablet';
    isDesktop: boolean;
    isMobile: boolean;
    isTablet: boolean;
  };
}

interface YandexPlayer {
  signature: string;
  name: string;
  photo: string;
  uniqueID: string;
  setData: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
  getData: (keys?: string[]) => Promise<Record<string, unknown>>;
}

interface YandexLeaderboards {
  setLeaderboardScore: (name: string, score: number, extraData?: string) => Promise<void>;
  getLeaderboard: (name: string, options?: {
    includeUser?: boolean;
    quantityAround?: number;
    top?: number;
  }) => Promise<{
    playerRank?: { rank: number; score: number };
    topPlayers: Array<{
      score: number;
      rank: number;
      player: { publicName: string; photo: string };
    }>;
  }>;
}

const STORAGE_KEY = 'eteria_yandex_fallback';

// Track if SDK load was attempted
let sdkLoadAttempted = false;
let sdkAvailable = false;

export class YandexGamesAdapter extends BasePlatformAdapter {
  readonly id = 'yandex' as const;
  readonly displayName = 'Yandex Games';
  readonly capabilities = YANDEX_CAPABILITIES;

  private sdk: YandexSDK | null = null;
  private player: YandexPlayer | null = null;

  /**
   * Check if Yandex SDK is available in window
   * This does NOT load the SDK - just checks presence
   */
  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'YaGames' in window;
  }

  /**
   * Check if SDK was successfully loaded and initialized
   */
  isSDKReady(): boolean {
    return this.sdk !== null;
  }

  async initialize(): Promise<void> {
    // First, try to load the SDK if not already available
    if (!this.isAvailable() && !sdkLoadAttempted) {
      sdkLoadAttempted = true;
      console.log('[Yandex] SDK not present, attempting to load...');
      
      const loadResult = await loadYandexSDK();
      if (!loadResult.success) {
        console.warn('[Yandex] SDK load failed:', loadResult.error);
        console.warn('[Yandex] Running in degraded mode without SDK');
        this.setInitialized(true);
        return;
      }
      sdkAvailable = true;
    }

    // If SDK still not available after load attempt, degraded mode
    if (!this.isAvailable()) {
      console.warn('[Yandex] SDK not present, running in degraded mode');
      this.setInitialized(true);
      return;
    }

    try {
      console.log('[Yandex] Initializing SDK...');
      const yaGames = (window as any).YaGames;
      this.sdk = await yaGames.init();
      console.log('[Yandex] SDK initialized successfully');
      this.setInitialized(true);
      
      // Try to get player (non-blocking)
      this.initPlayer().catch((e) => {
        console.warn('[Yandex] Player init failed (non-critical):', e);
      });
    } catch (error) {
      console.error('[Yandex] SDK initialization failed:', error);
      // Don't throw - allow degraded operation
      this.setInitialized(true);
    }
  }

  private async initPlayer(): Promise<void> {
    if (!this.sdk) return;
    
    try {
      this.player = await this.sdk.getPlayer({ signed: true });
      console.log('[Yandex] Player authorized:', this.player.name);
    } catch {
      console.log('[Yandex] Player not authorized');
      this.player = null;
    }
  }

  // Fullscreen
  async requestFullscreen(): Promise<boolean> {
    if (!this.hasCapability('fullscreenAllowed')) {
      console.warn('[Yandex] Fullscreen not allowed on this platform');
      return false;
    }

    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
        return true;
      }
    } catch (error) {
      console.warn('[Yandex] Fullscreen failed:', error);
    }
    return false;
  }

  async exitFullscreen(): Promise<boolean> {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return true;
      }
    } catch (error) {
      console.warn('[Yandex] Exit fullscreen failed:', error);
    }
    return false;
  }

  // Ads
  async showInterstitialAd(): Promise<AdResult> {
    if (!this.sdk) {
      return { ok: false, shown: false, error: 'SDK not initialized' };
    }

    return new Promise((resolve) => {
      this.sdk!.adv.showFullscreenAdv({
        onOpen: () => {
          platformEvents.emit('platform:ad_start', { type: 'interstitial' });
          this.pauseGameplay('ad');
        },
        onClose: (wasShown) => {
          platformEvents.emit('platform:ad_complete', { type: 'interstitial', rewarded: false });
          this.resumeGameplay('ad_complete');
          resolve({ ok: true, shown: wasShown });
        },
        onError: (error) => {
          console.error('[Yandex] Interstitial ad error:', error);
          resolve({ ok: false, shown: false, error: error.message });
        },
      });
    });
  }

  async showRewardedAd(): Promise<AdResult> {
    if (!this.sdk) {
      return { ok: false, shown: false, rewarded: false, error: 'SDK not initialized' };
    }

    return new Promise((resolve) => {
      let rewarded = false;

      this.sdk!.adv.showRewardedVideo({
        onOpen: () => {
          platformEvents.emit('platform:ad_start', { type: 'rewarded' });
          this.pauseGameplay('ad');
        },
        onRewarded: () => {
          rewarded = true;
          console.log('[Yandex] Reward granted');
        },
        onClose: () => {
          platformEvents.emit('platform:ad_complete', { type: 'rewarded', rewarded });
          this.resumeGameplay('ad_complete');
          resolve({ ok: true, shown: true, rewarded });
        },
        onError: (error) => {
          console.error('[Yandex] Rewarded ad error:', error);
          resolve({ ok: false, shown: false, rewarded: false, error: error.message });
        },
      });
    });
  }

  // Storage
  async saveData(data: SaveData): Promise<boolean> {
    if (this.player) {
      try {
        await this.player.setData(data as Record<string, unknown>, true);
        return true;
      } catch (error) {
        console.error('[Yandex] Cloud save failed:', error);
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
    if (this.player) {
      try {
        const data = await this.player.getData();
        return data as SaveData;
      } catch (error) {
        console.error('[Yandex] Cloud load failed:', error);
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
    if (!this.player) {
      return null;
    }

    return {
      id: this.player.uniqueID,
      name: this.player.name,
      avatarUrl: this.player.photo,
      isAuthorized: true,
    };
  }

  isPlayerAuthorized(): boolean {
    return this.player !== null;
  }

  // Leaderboards
  async submitScore(leaderboardId: string, score: number): Promise<boolean> {
    if (!this.sdk) return false;

    try {
      const leaderboards = await this.sdk.getLeaderboards();
      await leaderboards.setLeaderboardScore(leaderboardId, score);
      return true;
    } catch (error) {
      console.error('[Yandex] Submit score failed:', error);
      return false;
    }
  }

  async getLeaderboard(leaderboardId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    if (!this.sdk) return [];

    try {
      const leaderboards = await this.sdk.getLeaderboards();
      const result = await leaderboards.getLeaderboard(leaderboardId, { top: limit });

      return result.topPlayers.map((p, i) => ({
        rank: p.rank,
        score: p.score,
        playerName: p.player.publicName || 'Anonymous',
        playerAvatar: p.player.photo,
      }));
    } catch (error) {
      console.error('[Yandex] Get leaderboard failed:', error);
      return [];
    }
  }

  // Locale
  async getLocale(): Promise<string | null> {
    if (this.sdk) {
      return this.sdk.environment.i18n.lang || null;
    }
    return null;
  }

  // Analytics
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    if (this.sdk) {
      this.sdk.analytics.goal(eventName, params);
    }
    console.log(`[Yandex] Event: ${eventName}`, params || '');
  }

  destroy(): void {
    this.sdk = null;
    this.player = null;
    this.setInitialized(false);
  }
}
