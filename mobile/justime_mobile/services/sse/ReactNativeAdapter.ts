/**
 * React Native Platform Adapter
 *
 * This adapter provides React Native-specific functionality for the SSE service:
 * - AppState-based background/foreground detection
 * - Platform detection
 *
 * Usage:
 * ```typescript
 * import { ReactNativeAdapter } from './ReactNativeAdapter';
 * import { SSECore } from './SSECore';
 *
 * const adapter = new ReactNativeAdapter();
 * const sseService = new SSECore(config, adapter);
 * ```
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  IPlatformAdapter,
  PlatformLifecycleState,
} from './types';

/**
 * React Native Platform Adapter
 *
 * Implements IPlatformAdapter for React Native environment.
 * Uses AppState API to detect background/foreground transitions.
 */
export class ReactNativeAdapter implements IPlatformAdapter {
  readonly platformName: string;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private lifecycleListeners: Array<(state: PlatformLifecycleState) => void> = [];

  constructor() {
    // Detect platform
    this.platformName = Platform.OS;

    // Setup AppState listener
    this.setupAppStateListener();
  }

  /**
   * Setup app state listener
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Convert AppStateStatus to PlatformLifecycleState
   */
  private convertAppStateStatus(status: AppStateStatus): PlatformLifecycleState {
    switch (status) {
      case 'active':
        return 'active';
      case 'background':
      case 'inactive':
        return 'background';
      default:
        return 'active';
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const state = this.convertAppStateStatus(nextAppState);
    this.notifyListeners(state);
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
    const currentAppState = AppState.currentState;
    return this.convertAppStateStatus(currentAppState);
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
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.lifecycleListeners = [];
  }
}

/**
 * Create a React Native platform adapter
 *
 * Factory function for convenience
 */
export function createReactNativeAdapter(): IPlatformAdapter {
  return new ReactNativeAdapter();
}
