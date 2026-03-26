/**
 * Web Portal Adapter
 * Generic browser fallback without hard SDK assumptions
 */

import { BasePlatformAdapter } from '../core/PlatformAdapter';
import { WEBPORTAL_CAPABILITIES } from '../core/PlatformCapabilities';
import type { SaveData, PlayerProfile } from '../core/PlatformTypes';

const STORAGE_KEY = 'eteria_portal_save';

export class WebPortalAdapter extends BasePlatformAdapter {
  readonly id = 'webportal' as const;
  readonly displayName = 'Web Portal';
  readonly capabilities = WEBPORTAL_CAPABILITIES;

  isAvailable(): boolean {
    // Available when running on web but not on a specific portal
    return typeof window !== 'undefined';
  }

  async initialize(): Promise<void> {
    console.log('[WebPortal] Platform adapter initialized');
    this.setInitialized(true);
  }

  // Fullscreen - use browser API
  async requestFullscreen(): Promise<boolean> {
    if (!this.hasCapability('fullscreen')) {
      return false;
    }

    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
        return true;
      } else if ((elem as any).webkitRequestFullscreen) {
        // Safari fallback
        (elem as any).webkitRequestFullscreen();
        return true;
      }
    } catch (error) {
      console.warn('[WebPortal] Fullscreen request failed:', error);
    }
    return false;
  }

  async exitFullscreen(): Promise<boolean> {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return true;
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
        return true;
      }
    } catch (error) {
      console.warn('[WebPortal] Exit fullscreen failed:', error);
    }
    return false;
  }

  // Storage - localStorage only
  async saveData(data: SaveData): Promise<boolean> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[WebPortal] Failed to save data:', error);
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
      console.error('[WebPortal] Failed to load data:', error);
      return null;
    }
  }

  // No player auth on generic web
  async getPlayerProfile(): Promise<PlayerProfile | null> {
    return null;
  }

  isPlayerAuthorized(): boolean {
    return false;
  }

  // Locale from browser
  async getLocale(): Promise<string | null> {
    if (typeof navigator !== 'undefined') {
      return navigator.language || (navigator as any).userLanguage || null;
    }
    return null;
  }

  // Basic analytics
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    // Could integrate with Google Analytics or similar here
    console.log(`[WebPortal] Event: ${eventName}`, params || '');
  }

  destroy(): void {
    this.setInitialized(false);
  }
}
