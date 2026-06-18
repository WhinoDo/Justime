/**
 * SSE Service Module
 *
 * This module provides a platform-agnostic SSE (Server-Sent Events) client
 * with platform-specific adapters for different environments.
 *
 * ## Architecture
 *
 * The SSE service is split into three layers:
 *
 * 1. **Types** (`types.ts`): Platform-agnostic interfaces and types
 *    - ISSEService: Main SSE service interface
 *    - IPlatformAdapter: Platform-specific adapter interface
 *    - SSE event types, configuration, health metrics
 *
 * 2. **Core** (`SSECore.ts`): Platform-independent SSE logic
 *    - Connection management
 *    - Reconnection with exponential backoff
 *    - Message parsing
 *    - Heartbeat monitoring
 *    - Last-Event-ID resume support
 *
 * 3. **Platform Adapters**: Platform-specific implementations
 *    - `ReactNativeAdapter.ts`: React Native (AppState API)
 *    - `DefaultPlatformAdapter` (in SSECore.ts): Generic fallback
 *
 * ## Usage
 *
 * ### Basic Usage (React Native)
 *
 * ```typescript
 * import { SSEService, createSSEChatClient } from './services/sse';
 *
 * // Using SSEService class
 * const service = new SSEService({ baseUrl: 'https://api.example.com' });
 * service.on('token', (event) => console.log(event.content));
 * await service.stream({ message: 'Hello' });
 *
 * // Using simplified client
 * const client = createSSEChatClient({ baseUrl: 'https://api.example.com' });
 * client.onToken((event) => console.log(event.content));
 * await client.stream({ message: 'Hello' });
 * ```
 *
 * ### With Custom Platform Adapter
 *
 * ```typescript
 * import { SSECore, IPlatformAdapter } from './services/sse';
 *
 * class CustomAdapter implements IPlatformAdapter {
 *   // ... implementation
 * }
 *
 * const service = new SSECore(config, new CustomAdapter());
 * ```
 *
 * ## Platform Support
 *
 * - **React Native**: Full support via ReactNativeAdapter (background/foreground detection)
 * - **Web Browser**: Use DefaultPlatformAdapter or create custom adapter with Page Visibility API
 * - **Node.js**: Use DefaultPlatformAdapter (no background detection)
 */

// Re-export types
export {
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

  // Error class
  SSEError,
} from './types';

// Re-export core implementation
export {
  SSECore,
  DefaultPlatformAdapter,
  createSSEChatClient,
} from './SSECore';

// Re-export React Native adapter
export {
  ReactNativeAdapter,
  createReactNativeAdapter,
} from './ReactNativeAdapter';

// Re-export Web adapter (for future use)
export {
  WebAdapter,
  createWebAdapter,
} from './WebAdapter';

// Import for SSEService class
import { SSECore } from './SSECore';
import { ReactNativeAdapter } from './ReactNativeAdapter';
import {
  SSEConfig,
  SSERequestOptions,
  SSEConnectionState,
  ConnectionHealth,
  SSETokenEvent,
  SSEMetadataEvent,
  SSEUsageEvent,
  SSEDoneEvent,
  SSEErrorEvent,
  SSEHeartbeatEvent,
  SSEError,
} from './types';

/**
 * SSE Service for React Native
 *
 * This is the main SSE service class for React Native.
 * It extends SSECore with React Native-specific platform adapter.
 *
 * This class is provided for backward compatibility with existing code.
 * New code can use SSECore directly with a custom platform adapter.
 *
 * @example
 * ```typescript
 * import { SSEService } from './services/sse';
 *
 * const service = new SSEService({
 *   baseUrl: 'https://api.example.com',
 *   authToken: 'your-token',
 * });
 *
 * service.on('token', (event) => {
 *   console.log('Token:', event.content);
 * });
 *
 * service.on('done', (event) => {
 *   console.log('Done:', event.messageId);
 * });
 *
 * await service.stream({
 *   message: 'Hello, AI!',
 *   sessionId: 'session-123',
 * });
 * ```
 */
export class SSEService extends SSECore {
  constructor(config: SSEConfig) {
    // Use React Native adapter by default
    super(config, new ReactNativeAdapter());
  }
}

// Default export for backward compatibility
export default SSEService;
