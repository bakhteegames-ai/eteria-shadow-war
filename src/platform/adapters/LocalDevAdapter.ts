/**
 * Local Development Adapter
 * Safe no-op fallback for development without any SDK dependency
 */

import { BasePlatformAdapter } from '../core/PlatformAdapter';
import { LOCALDEV_CAPABILITIES } from '../core/PlatformCapabilities';
import type { SaveData, AdResult, PlayerProfile } from '../core/PlatformTypes';

const STORAGE_KEY = 'eteria_local_save';

export class LocalDevAdapter extends BasePlatformAdapter {
  readonly id = 'localdev' as const;
  readonly displayName = 'Local Development';
  readonly capabilities = LOCALDEV_CAPABILITIES;

  isAvailable(): boolean {
    return true; // Always available as fallback
  }

  async initialize(): Promise<void> {
    console.log('[LocalDev] Platform adapter initialized');
    console.log('[LocalDev] Capabilities:', this.capabilities);
    this.setInitialized(true);
  }

  // Fullscreen - use browser API
  async requestFullscreen(): Promise<boolean> {
    if (!this.hasCapability('fullscreen')) {
      return false;
    }

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        return true;
      }
    } catch (error) {
      console.warn('[LocalDev] Fullscreen request failed:', error);
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
      console.warn('[LocalDev] Exit fullscreen failed:', error);
    }
    return false;
  }

  // Storage - localStorage
  async saveData(data: SaveData): Promise<boolean> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('[LocalDev] Data saved to localStorage');
      return true;
    } catch (error) {
      console.error('[LocalDev] Failed to save data:', error);
      return false;
    }
  }

  async loadData(): Promise<SaveData | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as SaveData;
      }
      return null;
    } catch (error) {
      console.error('[LocalDev] Failed to load data:', error);
      return null;
    }
  }

  // Simulated ads for testing UI
  async showInterstitialAd(): Promise<AdResult> {
    console.log('[LocalDev] Simulating interstitial ad (1.5s delay)');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { ok: true, shown: true };
  }

  async showRewardedAd(): Promise<AdResult> {
    console.log('[LocalDev] Simulating rewarded ad (2s delay, always rewards)');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return { ok: true, shown: true, rewarded: true };
  }

  // Mock player
  async getPlayerProfile(): Promise<PlayerProfile | null> {
    return {
      id: 'local-player',
      name: 'Local Player',
      avatarUrl: null,
      isAuthorized: false,
    };
  }

  isPlayerAuthorized(): boolean {
    return false;
  }

  // Locale
  async getLocale(): Promise<string | null> {
    if (typeof navigator !== 'undefined') {
      return navigator.language || null;
    }
    return null;
  }

  // Analytics
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    console.log(`[LocalDev] Event: ${eventName}`, params || '');
  }

  destroy(): void {
    console.log('[LocalDev] Adapter destroyed');
    this.setInitialized(false);
  }
}
