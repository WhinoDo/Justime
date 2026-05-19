/**
 * Web Browser Platform Adapter
 *
 * This adapter provides Web browser-specific functionality for the SSE service:
 * - Page Visibility API for background/foreground detection
 *
 * Usage:
 * ```typescript
 * import { WebAdapter } from './WebAdapter';
 * import { SSECore } from './SSECore';
 *
 * const adapter = new WebAdapter();
 * const sseService = new SSECore(config, adapter);
 * ```
 *
 * Note: This adapter is provided for future use when the SSE service
 * is needed in the Web frontend. Currently, the Web frontend uses
 * a different SSE implementation in useSSEChat.ts.
 */

import {
  IPlatformAdapter,
  PlatformLifecycleState,
} from './types';

/**
 * Web Browser Platform Adapter
 *
 * Implements IPlatformAdapter for Web browser environment.
 * Uses Page Visibility API to detect tab visibility changes.
 */
export class WebAdapter implements IPlatformAdapter {
  readonly platformName = 'web';
  private visibilityChangeHandler: (() => void) | null = null;
  private lifecycleListeners: Array<(state: PlatformLifecycleState) => void> = [];

  constructor() {
    this.setupVisibilityListener();
  }

  /**
   * Setup page visibility listener
   */
  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') {
      // Not in browser environment (e.g., SSR)
      return;
    }

    this.visibilityChangeHandler = () => {
      const state = this.getLifecycleState();
      this.notifyListeners(state);
    };

    // Listen for visibility change
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(state: PlatformLifecycleState): void {
    for (const listener of this.lifecycleListeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in lifecycle listener:', error);
      }
    }
  }

  /**
   * Get current lifecycle state
   */
  getLifecycleState(): PlatformLifecycleState {
    if (typeof document === 'undefined') {
      // Not in browser environment
      return 'active';
    }

    // Use Page Visibility API
    if (document.hidden) {
      return 'background';
    }
    return 'active';
  }

  /**
   * Subscribe to lifecycle state changes
   * @param callback Called when lifecycle state changes
   * @returns Unsubscribe function
   */
  onLifecycleChange(callback: (state: PlatformLifecycleState) => void): () => void {
    this.lifecycleListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.lifecycleListeners.indexOf(callback);
      if (index !== -1) {
        this.lifecycleListeners.splice(index, 1);
      }
    };
  }

  /**
   * Clean up platform resources
   */
  destroy(): void {
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    this.lifecycleListeners = [];
  }
}

/**
 * Create a Web platform adapter
 *
 * Factory function for convenience
 */
export function createWebAdapter(): IPlatformAdapter {
  return new WebAdapter();
}
