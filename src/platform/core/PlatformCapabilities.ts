/**
 * Platform Capabilities
 * Default capability sets for each platform type
 */

import type { PlatformCapabilities as TPlatformCapabilities } from './PlatformTypes';

// Re-export the type for convenience
export type { PlatformCapabilities } from './PlatformTypes';

export const DEFAULT_CAPABILITIES: TPlatformCapabilities = {
  ads: false,
  rewardedAds: false,
  fullscreen: true,
  fullscreenAllowed: true,
  platformPauseResume: false,
  storage: true, // localStorage fallback always available
  leaderboards: false,
  auth: false,
  payments: false,
  locale: false,
};

export const YANDEX_CAPABILITIES: TPlatformCapabilities = {
  ads: true,
  rewardedAds: true,
  fullscreen: true,
  fullscreenAllowed: true,
  platformPauseResume: true,
  storage: true,
  leaderboards: true,
  auth: true,
  payments: true,
  locale: true,
};

export const CRAZYGAMES_CAPABILITIES: TPlatformCapabilities = {
  ads: true,
  rewardedAds: true,
  fullscreen: true,
  fullscreenAllowed: false, // CrazyGames forbids custom fullscreen buttons
  platformPauseResume: true,
  storage: true,
  leaderboards: true,
  auth: true,
  payments: true,
  locale: false,
};

export const WEBPORTAL_CAPABILITIES: TPlatformCapabilities = {
  ...DEFAULT_CAPABILITIES,
};

export const LOCALDEV_CAPABILITIES: TPlatformCapabilities = {
  ads: false, // Simulated with delays
  rewardedAds: false,
  fullscreen: true,
  fullscreenAllowed: true,
  platformPauseResume: false,
  storage: true,
  leaderboards: false,
  auth: false,
  payments: false,
  locale: false,
};

/**
 * Check if a capability is available
 */
export function hasCapability(
  capabilities: TPlatformCapabilities,
  key: keyof TPlatformCapabilities
): boolean {
  return capabilities[key] === true;
}

/**
 * Get summary string of capabilities for debugging
 */
export function getCapabilitiesSummary(capabilities: TPlatformCapabilities): string {
  const enabled: string[] = [];
  const disabled: string[] = [];
  
  for (const [key, value] of Object.entries(capabilities)) {
    if (value) {
      enabled.push(key);
    } else {
      disabled.push(key);
    }
  }
  
  return `Enabled: [${enabled.join(', ')}] | Disabled: [${disabled.join(', ')}]`;
}
