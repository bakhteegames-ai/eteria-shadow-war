/**
 * Platform Types
 * Core type definitions for the platform integration layer
 */

export type PlatformId = 'yandex' | 'crazygames' | 'webportal' | 'localdev';

export interface PlatformCapabilities {
  /** Interstitial ads between matches */
  ads: boolean;
  /** Rewarded ads for bonuses */
  rewardedAds: boolean;
  /** Fullscreen API available (may be forbidden on some platforms) */
  fullscreen: boolean;
  /** Custom fullscreen button allowed (CrazyGames forbids this) */
  fullscreenAllowed: boolean;
  /** Platform can pause/resume gameplay */
  platformPauseResume: boolean;
  /** Cloud or platform storage available */
  storage: boolean;
  /** Leaderboards available */
  leaderboards: boolean;
  /** Player authentication available */
  auth: boolean;
  /** Payments/IAP available */
  payments: boolean;
  /** Platform-provided locale */
  locale: boolean;
}

export interface PlayerProfile {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  isAuthorized: boolean;
}

export interface SaveData {
  version: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface AdResult {
  ok: boolean;
  shown: boolean;
  rewarded?: boolean;
  error?: string;
}

export interface LeaderboardEntry {
  rank: number;
  score: number;
  playerName: string;
  playerAvatar?: string;
}

export type PlatformPauseReason = 'ad' | 'background' | 'platform' | 'user';
export type PlatformResumeReason = 'ad_complete' | 'foreground' | 'platform' | 'user';

export interface PlatformEventMap {
  'platform:pause': { reason: PlatformPauseReason };
  'platform:resume': { reason: PlatformResumeReason };
  'platform:ad_start': { type: 'interstitial' | 'rewarded' };
  'platform:ad_complete': { type: 'interstitial' | 'rewarded'; rewarded: boolean };
  'platform:auth_change': { isAuthorized: boolean };
  'platform:ready': void;
}
