/**
 * Platform Adapter Factory
 * Creates and selects the appropriate platform adapter
 * 
 * Detection Strategy:
 * 1. Check for explicit NEXT_PUBLIC_PLATFORM env var
 * 2. Check for localhost/development environment
 * 3. Check for specific SDK presence (Yandex, CrazyGames)
 * 4. Check referrer for known portals
 * 5. Fallback to webportal (not localdev!) for non-local production
 */

import type { PlatformAdapter } from './PlatformAdapter';
import type { PlatformId } from './PlatformTypes';

/**
 * Known portal referrer patterns
 */
const KNOWN_PORTALS = {
  yandex: ['yandex.', 'yandexgames'],
  crazygames: ['crazygames.', 'crazygames.com'],
  poki: ['poki.'],
  itch: ['itch.io'],
  newgrounds: ['newgrounds.'],
} as const;

/**
 * Check if running on localhost or development environment
 */
function isLocalEnvironment(): boolean {
  if (typeof window === 'undefined') return true;
  
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    port !== '' // Non-standard port typically means local dev
  );
}

/**
 * Check for Yandex Games SDK presence
 */
function hasYandexSDK(): boolean {
  return typeof window !== 'undefined' && 'YaGames' in window;
}

/**
 * Check for CrazyGames SDK v3 presence
 * v3 uses window.CrazyGames.SDK namespace
 */
function hasCrazyGamesSDK(): boolean {
  return typeof window !== 'undefined' && 
         window.CrazyGames !== undefined && 
         window.CrazyGames.SDK !== undefined;
}

/**
 * Check if referrer matches any known portal
 */
function getPortalFromReferrer(): PlatformId | null {
  if (typeof document === 'undefined') return null;
  
  const referrer = document.referrer.toLowerCase();
  
  for (const [portal, patterns] of Object.entries(KNOWN_PORTALS)) {
    for (const pattern of patterns) {
      if (referrer.includes(pattern)) {
        return portal as PlatformId;
      }
    }
  }
  
  return null;
}

/**
 * Check if current page is embedded in an iframe
 */
function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    return window.self !== window.top;
  } catch {
    return true; // Security exception means we're in a cross-origin iframe
  }
}

/**
 * Detect platform by checking environment
 * Returns the most appropriate platform ID
 */
function detectPlatform(): PlatformId {
  if (typeof window === 'undefined') {
    return 'localdev';
  }

  // 1. Check for explicit environment variable override
  const envPlatform = process.env.NEXT_PUBLIC_PLATFORM as PlatformId | undefined;
  if (envPlatform && ['yandex', 'crazygames', 'webportal', 'localdev'].includes(envPlatform)) {
    console.log(`[Platform] Using explicit platform from env: ${envPlatform}`);
    return envPlatform;
  }

  // 2. Check for localhost/development
  const isLocal = isLocalEnvironment();
  
  // 3. Check for specific SDK presence (highest confidence)
  if (hasYandexSDK()) {
    return 'yandex';
  }
  
  if (hasCrazyGamesSDK()) {
    return 'crazygames';
  }

  // 4. Check referrer for known portals
  const referrerPortal = getPortalFromReferrer();
  if (referrerPortal) {
    console.log(`[Platform] Detected portal from referrer: ${referrerPortal}`);
    // Return the specific portal even if SDK not loaded yet
    // The adapter will attempt to load the SDK
    if (referrerPortal === 'yandex') return 'yandex';
    if (referrerPortal === 'crazygames') return 'crazygames';
    // Other portals fall through to webportal
  }

  // 5. If not local but embedded, use webportal as degraded fallback
  if (!isLocal && isEmbedded()) {
    console.log('[Platform] Embedded in iframe without specific SDK, using webportal fallback');
    return 'webportal';
  }

  // 6. If not local and not embedded (standalone production), use webportal
  if (!isLocal) {
    console.log('[Platform] Non-local environment without SDK, using webportal');
    return 'webportal';
  }

  // 7. Default to local development
  return 'localdev';
}

let cachedAdapter: PlatformAdapter | null = null;

/**
 * Create and return the appropriate platform adapter
 * Uses singleton pattern - subsequent calls return cached adapter
 */
export async function createPlatformAdapter(): Promise<PlatformAdapter> {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const platformId = detectPlatform();
  console.log(`[Platform] Detected platform: ${platformId}`);

  let adapter: PlatformAdapter;

  switch (platformId) {
    case 'yandex':
      const { YandexGamesAdapter } = await import('../adapters/YandexGamesAdapter');
      adapter = new YandexGamesAdapter();
      break;

    case 'crazygames':
      const { CrazyGamesAdapter } = await import('../adapters/CrazyGamesAdapter');
      adapter = new CrazyGamesAdapter();
      break;

    case 'webportal':
      const { WebPortalAdapter } = await import('../adapters/WebPortalAdapter');
      adapter = new WebPortalAdapter();
      break;

    case 'localdev':
    default:
      const { LocalDevAdapter } = await import('../adapters/LocalDevAdapter');
      adapter = new LocalDevAdapter();
      break;
  }

  cachedAdapter = adapter;
  return adapter;
}

/**
 * Get the current cached adapter without creating a new one
 */
export function getPlatformAdapter(): PlatformAdapter | null {
  return cachedAdapter;
}

/**
 * Reset the adapter cache (useful for testing)
 */
export function resetPlatformAdapter(): void {
  if (cachedAdapter?.destroy) {
    cachedAdapter.destroy();
  }
  cachedAdapter = null;
}

/**
 * Get the detected platform ID without initializing
 */
export function getDetectedPlatformId(): PlatformId {
  return detectPlatform();
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    isLocalEnvironment()
  );
}
