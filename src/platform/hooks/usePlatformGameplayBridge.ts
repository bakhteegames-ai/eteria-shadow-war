/**
 * Platform Gameplay Bridge V2
 * Connects platform pause/resume events to game state
 * 
 * Works with the new simulation core through DOM events.
 * The GameProviderV2 listens for 'platform-pause' and 'platform-resume' events.
 */

import { useEffect } from 'react';
import { platformEvents } from '@/platform/core/PlatformEvents';
import { usePlatform } from '@/platform/state/PlatformProvider';

/**
 * Hook to bridge platform lifecycle events to game state
 * Should be used in the game page component
 * 
 * When the platform requests pause (e.g., during ads, background):
 * - Dispatches 'platform-pause' event
 * 
 * When the platform signals resume:
 * - Dispatches 'platform-resume' event
 */
export function usePlatformGameplayBridge() {
  const { adapter, platformId } = usePlatform();

  useEffect(() => {
    let platformPaused = false;

    // Handle platform pause event
    const unsubscribePause = platformEvents.on('platform:pause', ({ reason }) => {
      console.log(`[PlatformBridge] Platform pause: ${reason}`);
      platformPaused = true;
      
      // Dispatch custom event for GameProviderV2 to handle
      window.dispatchEvent(new CustomEvent('platform-pause', { detail: { reason } }));
    });

    // Handle platform resume event
    const unsubscribeResume = platformEvents.on('platform:resume', ({ reason }) => {
      console.log(`[PlatformBridge] Platform resume: ${reason}`);
      
      // Only auto-resume if we were paused by platform
      if (platformPaused) {
        platformPaused = false;
        
        // Dispatch custom event for GameProviderV2 to handle
        window.dispatchEvent(new CustomEvent('platform-resume', { detail: { reason } }));
      }
    });

    // Notify platform that gameplay started
    if (adapter && 'gameplayStart' in adapter && typeof (adapter as any).gameplayStart === 'function') {
      (adapter as any).gameplayStart();
    }

    return () => {
      unsubscribePause();
      unsubscribeResume();
      
      // Notify platform that gameplay stopped
      if (adapter && 'gameplayStop' in adapter && typeof (adapter as any).gameplayStop === 'function') {
        (adapter as any).gameplayStop();
      }
    };
  }, [adapter]);

  // Return useful info for debugging
  return {
    platformId,
  };
}

/**
 * Optional: Hook for "happy time" events
 * Call this when the player achieves something notable
 */
export function useHappyTime() {
  const { adapter } = usePlatform();

  return (intensity: number = 1) => {
    if (adapter && 'happyTime' in adapter && typeof (adapter as any).happyTime === 'function') {
      (adapter as any).happyTime(intensity);
    }
  };
}

/**
 * Hook for gameplay tracking (time, progress)
 */
export function useGameplayTracking() {
  const { adapter } = usePlatform();

  const trackGameplayTime = (seconds: number) => {
    if (adapter && 'gameplayTime' in adapter && typeof (adapter as any).gameplayTime === 'function') {
      (adapter as any).gameplayTime(seconds);
    }
  };

  const trackLevelComplete = (levelId: string, score?: number) => {
    if (adapter && 'levelComplete' in adapter && typeof (adapter as any).levelComplete === 'function') {
      (adapter as any).levelComplete(levelId, score);
    }
  };

  return {
    trackGameplayTime,
    trackLevelComplete,
  };
}
