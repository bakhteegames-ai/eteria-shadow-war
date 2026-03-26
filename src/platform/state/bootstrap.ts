/**
 * Platform Bootstrap
 * Initialize platform once on app startup
 */

import { createPlatformAdapter, isDevelopment } from '../core/createPlatformAdapter';
import { usePlatformStore } from './platformStore';
import { platformEvents } from '../core/PlatformEvents';

let bootstrapPromise: Promise<void> | null = null;
let isBootstrapped = false;

/**
 * Initialize the platform layer
 * Should be called once on app startup
 * Safe to call multiple times - subsequent calls return cached promise
 */
export async function bootstrapPlatform(): Promise<void> {
  // Return cached promise if already bootstrapping/bootstrapped
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  if (isBootstrapped) {
    return Promise.resolve();
  }

  const store = usePlatformStore.getState();

  bootstrapPromise = (async () => {
    try {
      store.setInitializing(true);
      console.log('[Platform] Starting bootstrap...');

      // Create and initialize adapter
      const adapter = await createPlatformAdapter();
      store.setAdapter(adapter);

      // Initialize the adapter
      await adapter.initialize();

      // Mark as ready
      store.setInitialized(true);
      isBootstrapped = true;

      // Emit ready event
      platformEvents.emit('platform:ready', undefined);

      console.log('[Platform] Bootstrap complete:', {
        id: adapter.id,
        capabilities: adapter.capabilities,
      });

      // Dev diagnostics
      if (isDevelopment()) {
        logDiagnostics(adapter);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Platform] Bootstrap failed:', error);
      store.setError(message);
      throw error;
    }
  })();

  return bootstrapPromise;
}

/**
 * Check if platform has been bootstrapped
 */
export function isPlatformBootstrapped(): boolean {
  return isBootstrapped;
}

/**
 * Log platform diagnostics (dev only)
 */
function logDiagnostics(adapter: any): void {
  console.group('🎮 Platform Diagnostics');
  console.log('Platform ID:', adapter.id);
  console.log('Display Name:', adapter.displayName);
  console.log('Initialized:', adapter.isInitialized?.());
  console.groupCollapsed('Capabilities');
  console.table(adapter.capabilities);
  console.groupEnd();
  console.groupEnd();
}

/**
 * Reset platform bootstrap state (for testing)
 */
export function resetPlatformBootstrap(): void {
  const store = usePlatformStore.getState();
  
  if (store.adapter?.destroy) {
    store.adapter.destroy();
  }
  
  store.reset();
  bootstrapPromise = null;
  isBootstrapped = false;
}
