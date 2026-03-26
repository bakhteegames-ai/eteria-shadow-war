'use client';

import { useEffect, useState } from 'react';
import { bootstrapPlatform, isPlatformBootstrapped } from '@/platform/state/bootstrap';
import { usePlatformStore } from '@/platform/state/platformStore';

interface PlatformProviderProps {
  children: React.ReactNode;
  /** Show loading state during bootstrap */
  showLoading?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
}

/**
 * Platform Provider
 * Initializes the platform layer on app startup
 * Should wrap the application root
 */
export function PlatformProvider({
  children,
  showLoading = false,
  loadingComponent,
}: PlatformProviderProps) {
  const [mounted, setMounted] = useState(false);
  const { isInitialized, isInitializing, error, platformId } = usePlatformStore();

  useEffect(() => {
    setMounted(true);

    // Skip if already bootstrapped
    if (isPlatformBootstrapped()) {
      return;
    }

    // Initialize platform
    bootstrapPlatform().catch((err) => {
      console.error('[PlatformProvider] Bootstrap failed:', err);
    });
  }, []);

  // Show nothing during SSR
  if (!mounted) {
    return null;
  }

  // Show loading state if requested
  if (showLoading && isInitializing && !isInitialized) {
    return (
      loadingComponent || (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-white text-lg">Initializing...</div>
        </div>
      )
    );
  }

  // Log errors but don't block rendering
  if (error) {
    console.warn('[PlatformProvider] Platform error:', error);
  }

  return <>{children}</>;
}

/**
 * Hook to access the platform adapter
 */
export function usePlatform() {
  const { adapter, platformId, capabilities, isInitialized, error } = usePlatformStore();
  
  return {
    adapter,
    platformId,
    capabilities,
    isReady: isInitialized && adapter !== null,
    error,
  };
}

/**
 * Hook to check a specific capability
 */
export function useCapability(key: 'ads' | 'rewardedAds' | 'fullscreen' | 'fullscreenAllowed' | 'platformPauseResume' | 'storage' | 'leaderboards' | 'auth' | 'payments' | 'locale') {
  const capabilities = usePlatformStore((s) => s.capabilities);
  return capabilities[key] === true;
}

/**
 * Development-only platform diagnostics component
 */
export function PlatformDiagnostics() {
  const platformId = usePlatformStore((s) => s.platformId);
  const isInitialized = usePlatformStore((s) => s.isInitialized);
  const capabilities = usePlatformStore((s) => s.capabilities);
  const error = usePlatformStore((s) => s.error);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-2 right-2 bg-black/80 text-white text-xs p-2 rounded z-[9999] font-mono">
      <div>Platform: {platformId || 'none'}</div>
      <div>Ready: {isInitialized ? '✓' : '✗'}</div>
      {error && <div className="text-red-400">Error: {error}</div>}
      <details className="mt-1">
        <summary className="cursor-pointer">Capabilities</summary>
        <pre className="mt-1 text-[10px] overflow-auto max-h-32">
          {JSON.stringify(capabilities, null, 2)}
        </pre>
      </details>
    </div>
  );
}
