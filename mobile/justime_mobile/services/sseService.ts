/**
 * SSE Service for React Native
 *
 * This file re-exports the SSE service from the new modular architecture.
 * The implementation has been refactored into platform-agnostic components:
 *
 * - `./sse/types.ts` - Platform-agnostic interfaces and types
 * - `./sse/SSECore.ts` - Core SSE logic (platform-independent)
 * - `./sse/ReactNativeAdapter.ts` - React Native platform adapter
 *
 * ## Migration Note
 *
 * The exports remain compatible with the original API.
 * Existing code using this module will continue to work without changes.
 *
 * ## New Features
 *
 * The refactored architecture now supports:
 * - Platform-agnostic SSE core logic
 * - Custom platform adapters (Web, Node.js, etc.)
 * - Improved testability with dependency injection
 *
 * For new code, consider importing from `./sse/index.ts` directly.
 */

// Re-export everything from the new modular architecture
export {
  // Main classes
  SSEService,
  SSECore,
  SSEError,

  // Platform adapters
  ReactNativeAdapter,
  createReactNativeAdapter,
  WebAdapter,
  createWebAdapter,
  DefaultPlatformAdapter,

  // Factory functions
  createSSEChatClient,

  // Event types
  SSETokenEvent,
  SSEMetadataEvent,
  SSEUsageEvent,
  SSEDoneEvent,
  SSEErrorEvent,
  SSEHeartbeatEvent,
  SSEEvent,

  // State types
  SSEConnectionState,
  SSEConfig,
  SSERequestOptions,
  ConnectionHealth,

  // Platform types
  PlatformLifecycleState,
  IPlatformAdapter,
  ISSEService,
  ISSEChatClient,
} from './sse/index';

// Default export for backward compatibility
export { SSEService as default } from './sse/index';
