/**
 * SDK Script Loader Utilities
 * Safe script loading for platform SDKs
 */

type ScriptLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface SDKLoadResult {
  success: boolean;
  error?: string;
}

// Cache for script load states
const scriptStates = new Map<string, ScriptLoadStatus>();
const scriptPromises = new Map<string, Promise<SDKLoadResult>>();

/**
 * Load a script dynamically and return a promise
 * Does NOT assume that an existing script tag means the SDK is ready
 */
export function loadScript(
  src: string,
  id: string,
  options?: {
    async?: boolean;
    timeout?: number;
  }
): Promise<SDKLoadResult> {
  // Check if already loading/loaded via our tracked promise
  const cached = scriptPromises.get(id);
  if (cached) {
    return cached;
  }

  // Check our tracked state (only 'loaded' from successful resolution)
  const state = scriptStates.get(id);
  if (state === 'loaded') {
    return Promise.resolve({ success: true });
  }

  const promise = new Promise<SDKLoadResult>((resolve) => {
    scriptStates.set(id, 'loading');

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = options?.async ?? true;

    const timeout = options?.timeout ?? 10000;
    const timeoutId = setTimeout(() => {
      scriptStates.set(id, 'error');
      console.error(`[SDKLoader] Timeout loading script: ${src}`);
      resolve({ success: false, error: 'Timeout' });
    }, timeout);

    script.onload = () => {
      clearTimeout(timeoutId);
      scriptStates.set(id, 'loaded');
      console.log(`[SDKLoader] Script loaded: ${src}`);
      resolve({ success: true });
    };

    script.onerror = (error) => {
      clearTimeout(timeoutId);
      scriptStates.set(id, 'error');
      console.error(`[SDKLoader] Error loading script: ${src}`, error);
      resolve({ success: false, error: 'Script load error' });
    };

    document.head.appendChild(script);
  });

  scriptPromises.set(id, promise);
  return promise;
}

/**
 * Check if an SDK script was successfully loaded via our loader
 * Only returns true if we tracked a successful load, not just DOM presence
 */
export function isScriptLoaded(id: string): boolean {
  return scriptStates.get(id) === 'loaded';
}

/**
 * Yandex Games SDK loader
 * 
 * Uses the official absolute SDK path for dynamic loading/fallback scenarios.
 * Note: For archive-based Yandex deployment, the preferred path is `/sdk.js` 
 * (relative), but this loader uses the absolute S3 URL for custom-domain 
 * and standalone testing scenarios.
 * 
 * The SDK must be loaded before calling YaGames.init().
 * 
 * @see https://yandex.ru/dev/games/doc/en/
 */
export async function loadYandexSDK(): Promise<SDKLoadResult> {
  // Check if already available
  if (typeof window !== 'undefined' && 'YaGames' in window) {
    return { success: true };
  }

  // Load the SDK script using official absolute path
  const result = await loadScript(
    'https://sdk.games.s3.yandex.net/sdk.js',
    'yandex-games-sdk',
    { timeout: 15000 }
  );

  return result;
}

/**
 * CrazyGames SDK loader (v3)
 * Note: CrazyGames typically injects their SDK into the iframe
 * This loader is for standalone testing only
 * 
 * SDK v3 uses window.CrazyGames.SDK namespace
 */
export async function loadCrazyGamesSDK(): Promise<SDKLoadResult> {
  // Check if already available (v3 namespace)
  if (typeof window !== 'undefined' && 
      window.CrazyGames !== undefined && 
      window.CrazyGames.SDK !== undefined) {
    return { success: true };
  }

  // CrazyGames SDK v3 is typically injected by the platform
  // For standalone testing, load from CDN
  const result = await loadScript(
    'https://sdk.crazygames.com/crazygames-sdk-v3.js',
    'crazygames-sdk',
    { timeout: 10000 }
  );

  return result;
}
