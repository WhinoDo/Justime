/**
 * Platform-Agnostic SSE Service Types
 *
 * This module defines interfaces that abstract SSE functionality
 * from platform-specific implementations (React Native, Web, Node.js).
 *
 * The core SSE logic (reconnection, message parsing, heartbeat monitoring)
 * can be reused across platforms by injecting a platform adapter.
 */

import { EventEmitter } from 'events';

// ============================================================================
// SSE Event Types (Platform-Agnostic)
// ============================================================================

export interface SSETokenEvent {
  type: 'token';
  content: string;
  eventId?: string;
  sessionId?: string;
}

export interface SSEMetadataEvent {
  type: 'metadata';
  data: {
    ragReferences?: Array<{
      documentId: string;
      documentName: string;
      chunkId: string;
      relevanceScore: number;
    }>;
    emotionScore?: number;
    emotionTags?: string[];
  };
}

export interface SSEUsageEvent {
  type: 'usage';
  data: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SSEDoneEvent {
  type: 'done';
  eventId?: string;
  messageId?: string;
  sessionId?: string;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
  code?: string;
  retryable: boolean;
}

export interface SSEHeartbeatEvent {
  type: 'heartbeat';
  timestamp: number;
}

export type SSEEvent =
  | SSETokenEvent
  | SSEMetadataEvent
  | SSEUsageEvent
  | SSEDoneEvent
  | SSEErrorEvent
  | SSEHeartbeatEvent;

// ============================================================================
// Connection State (Platform-Agnostic)
// ============================================================================

export type SSEConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// ============================================================================
// Configuration (Platform-Agnostic)
// ============================================================================

export interface SSEConfig {
  baseUrl: string;
  timeout?: number;           // Stream timeout in ms (default: 300000 = 5 min)
  heartbeatTimeout?: number;  // Max time without heartbeat before reconnect (default: 30000)
  maxReconnectAttempts?: number;  // Max reconnection attempts (default: 5)
  reconnectBaseDelay?: number;    // Base delay for reconnection (default: 1000ms)
  reconnectMaxDelay?: number;     // Max reconnection delay (default: 30000ms)
  authToken?: string;
}

export interface SSERequestOptions {
  message: string;
  sessionId?: string;
  lastEventId?: string;
  runtimeModelId?: string;
  useWebSearch?: boolean;
  taskType?: string;
}

// ============================================================================
// Connection Health (Platform-Agnostic)
// ============================================================================

export interface ConnectionHealth {
  lastHeartbeat: number | null;
  heartbeatsReceived: number;
  missedHeartbeats: number;
  reconnectCount: number;
  averageLatency: number;
  connectionDrops: number;
}

// ============================================================================
// Platform Adapter Interface
// ============================================================================

/**
 * Platform-specific lifecycle state
 */
export type PlatformLifecycleState = 'active' | 'inactive' | 'background';

/**
 * Interface for platform-specific functionality
 *
 * This adapter provides platform-specific capabilities that the core SSE logic
 * needs but cannot implement itself (e.g., app background/foreground detection,
 * platform-specific fetch behavior).
 *
 * Different platforms provide different implementations:
 * - React Native: Uses AppState API for background detection
 * - Web: Uses Page Visibility API for background detection
 * - Node.js: No background detection (always active)
 */
export interface IPlatformAdapter {
  /**
   * Unique identifier for the platform
   */
  readonly platformName: string;

  /**
   * Get current lifecycle state
   */
  getLifecycleState(): PlatformLifecycleState;

  /**
   * Subscribe to lifecycle state changes
   * @param callback Called when lifecycle state changes
   * @returns Unsubscribe function
   */
  onLifecycleChange(callback: (state: PlatformLifecycleState) => void): () => void;

  /**
   * Platform-specific fetch if needed
   * Some platforms (React Native) may need custom fetch implementations
   * @returns fetch function or null to use global fetch
   */
  getFetch?(): typeof fetch | null;

  /**
   * Platform-specific AbortController if needed
   * @returns AbortController class or null to use global AbortController
   */
  getAbortController?(): typeof AbortController | null;

  /**
   * Clean up platform resources
   */
  destroy(): void;
}

// ============================================================================
// SSE Service Interface
// ============================================================================

/**
 * Interface for SSE Service
 *
 * This is the main interface that consumers use to interact with SSE.
 * It provides methods for streaming, connection management, and event subscription.
 */
export interface ISSEService {
  /**
   * Get current connection state
   */
  getState(): SSEConnectionState;

  /**
   * Get connection health metrics
   */
  getHealth(): ConnectionHealth;

  /**
   * Get the last event ID for resume
   */
  getLastEventId(): string | null;

  /**
   * Start an SSE stream
   */
  stream(options: SSERequestOptions): Promise<void>;

  /**
   * Disconnect the stream
   */
  disconnect(reason?: string): void;

  /**
   * Subscribe to SSE events
   */
  on(event: 'token', listener: (event: SSETokenEvent) => void): this;
  on(event: 'metadata', listener: (event: SSEMetadataEvent) => void): this;
  on(event: 'usage', listener: (event: SSEUsageEvent) => void): this;
  on(event: 'done', listener: (event: SSEDoneEvent) => void): this;
  on(event: 'error', listener: (event: SSEErrorEvent) => void): this;
  on(event: 'heartbeat', listener: (event: SSEHeartbeatEvent) => void): this;
  on(event: 'state-change', listener: (data: { state: SSEConnectionState; previousState: SSEConnectionState }) => void): this;
  on(event: 'reconnecting', listener: (data: { attempt: number; maxAttempts: number; delay: number; reason: string }) => void): this;
  on(event: 'reconnect-ready', listener: (data: { lastEventId: string | null; attempt: number }) => void): this;
  on(event: 'disconnected', listener: (data: { reason: string }) => void): this;
  on(event: 'stream-end', listener: () => void): this;
  on(event: 'aborted', listener: () => void): this;
  on(event: 'raw-data', listener: (data: string) => void): this;
  on(event: 'event', listener: (event: SSEEvent) => void): this;
  on(event: 'app-foreground' | 'app-background' | 'stale-connection', listener: (data?: any) => void): this;
  on(event: 'heartbeat-missed', listener: (data: { timeSinceLastHeartbeat: number | null }) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;

  /**
   * Unsubscribe from events
   */
  off(event: string, listener?: (...args: any[]) => void): this;

  /**
   * Emit an event (internal use)
   */
  emit(event: string, ...args: any[]): boolean;

  /**
   * Remove all listeners
   */
  removeAllListeners(): this;

  /**
   * Cleanup resources
   */
  destroy(): void;
}

// ============================================================================
// SSE Error Class
// ============================================================================

/**
 * Custom SSE Error
 */
export class SSEError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = 'SSEError';
  }
}

// ============================================================================
// SSE Chat Client Interface (Simplified API)
// ============================================================================

export interface ISSEChatClient {
  /**
   * Stream a chat message
   */
  stream(options: SSERequestOptions): Promise<void>;

  /**
   * Disconnect current stream
   */
  disconnect(): void;

  /**
   * Get current state
   */
  getState(): SSEConnectionState;

  /**
   * Get connection health
   */
  getHealth(): ConnectionHealth;

  /**
   * Get last event ID for resume
   */
  getLastEventId(): string | null;

  /**
   * Subscribe to tokens
   */
  onToken(callback: (event: SSETokenEvent) => void): () => void;

  /**
   * Subscribe to metadata events
   */
  onMetadata(callback: (event: SSEMetadataEvent) => void): () => void;

  /**
   * Subscribe to usage events
   */
  onUsage(callback: (event: SSEUsageEvent) => void): () => void;

  /**
   * Subscribe to done events
   */
  onDone(callback: (event: SSEDoneEvent) => void): () => void;

  /**
   * Subscribe to error events
   */
  onError(callback: (event: SSEErrorEvent) => void): () => void;

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: { state: SSEConnectionState; previousState: SSEConnectionState }) => void): () => void;

  /**
   * Subscribe to heartbeat events
   */
  onHeartbeat(callback: (event: SSEHeartbeatEvent) => void): () => void;

  /**
   * Subscribe to reconnecting events
   */
  onReconnecting(callback: (info: { attempt: number; maxAttempts: number; delay: number; reason: string }) => void): () => void;

  /**
   * Cleanup
   */
  destroy(): void;
}
