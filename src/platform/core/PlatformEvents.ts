/**
 * Platform Events
 * Simple typed event emitter for platform events
 */

import type { PlatformEventMap } from './PlatformTypes';

type EventCallback<T = unknown> = (data: T) => void;

/**
 * Simple typed event emitter for platform events
 */
class PlatformEventEmitter {
  private listeners = new Map<string, Set<EventCallback<unknown>>>();

  on<K extends keyof PlatformEventMap>(
    event: K,
    callback: EventCallback<PlatformEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off<K extends keyof PlatformEventMap>(
    event: K,
    callback: EventCallback<PlatformEventMap[K]>
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  emit<K extends keyof PlatformEventMap>(
    event: K,
    data: PlatformEventMap[K]
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[PlatformEvents] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  clearAll(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const platformEvents = new PlatformEventEmitter();

// Export class for testing
export { PlatformEventEmitter };
