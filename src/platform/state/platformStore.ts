/**
 * Platform Store
 * Minimal state module for platform bootstrap
 */

import { create } from 'zustand';
import type { PlatformAdapter } from '../core/PlatformAdapter';
import type { PlatformId } from '../core/PlatformTypes';
import type { PlatformCapabilities } from '../core/PlatformCapabilities';
import { DEFAULT_CAPABILITIES } from '../core/PlatformCapabilities';

export interface PlatformState {
  // Core state
  adapter: PlatformAdapter | null;
  platformId: PlatformId | null;
  capabilities: PlatformCapabilities;
  
  // Lifecycle state
  isInitializing: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  setAdapter: (adapter: PlatformAdapter) => void;
  setInitializing: (value: boolean) => void;
  setInitialized: (value: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePlatformStore = create<PlatformState>((set) => ({
  // Initial state
  adapter: null,
  platformId: null,
  capabilities: DEFAULT_CAPABILITIES,
  isInitializing: false,
  isInitialized: false,
  error: null,

  // Actions
  setAdapter: (adapter: PlatformAdapter) => {
    set({
      adapter,
      platformId: adapter.id,
      capabilities: adapter.capabilities,
    });
  },

  setInitializing: (value: boolean) => {
    set({ isInitializing: value });
  },

  setInitialized: (value: boolean) => {
    set({ isInitialized: value, isInitializing: false });
  },

  setError: (error: string | null) => {
    set({ error, isInitializing: false });
  },

  reset: () => {
    set({
      adapter: null,
      platformId: null,
      capabilities: DEFAULT_CAPABILITIES,
      isInitializing: false,
      isInitialized: false,
      error: null,
    });
  },
}));

/**
 * Get the platform adapter from the store
 */
export function getPlatform(): PlatformAdapter | null {
  return usePlatformStore.getState().adapter;
}

/**
 * Check if platform is ready
 */
export function isPlatformReady(): boolean {
  const state = usePlatformStore.getState();
  return state.isInitialized && state.adapter !== null;
}

/**
 * Get platform capabilities
 */
export function getCapabilities(): PlatformCapabilities {
  return usePlatformStore.getState().capabilities;
}

/**
 * Check if a specific capability is available
 */
export function hasCapability(key: keyof PlatformCapabilities): boolean {
  return usePlatformStore.getState().capabilities[key] === true;
}
