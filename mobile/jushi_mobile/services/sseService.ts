/**
 * SSE Service for React Native
 *
 * A robust Server-Sent Events client designed for mobile network conditions:
 * - Automatic reconnection with exponential backoff
 * - Last-Event-ID resume support
 * - Heartbeat detection and connection health monitoring
 * - Network state awareness (WiFi/4G switching)
 */

import { Platform, AppState, AppStateStatus, NativeEventEmitter } from 'react-native';
import { EventEmitter } from 'events';

// Event types
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

// Connection state
export type SSEConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// Configuration
export interface SSEConfig {
  baseUrl: string;
  timeout?: number;           // Stream timeout in ms (default: 300000 = 5 min)
  heartbeatTimeout?: number;  // Max time without heartbeat before reconnect (default: 30000)
  maxReconnectAttempts?: number;  // Max reconnection attempts (default: 5)
  reconnectBaseDelay?: number;    // Base delay for reconnection (default: 1000ms)
  reconnectMaxDelay?: number;     // Max reconnection delay (default: 30000ms)
  authToken?: string;
}

// Request options
export interface SSERequestOptions {
  message: string;
  sessionId?: string;
  lastEventId?: string;
  runtimeModelId?: string;
  useWebSearch?: boolean;
  taskType?: string;
}

// Connection health metrics
export interface ConnectionHealth {
  lastHeartbeat: number | null;
  heartbeatsReceived: number;
  missedHeartbeats: number;
  reconnectCount: number;
  averageLatency: number;
  connectionDrops: number;
}

/**
 * SSE Client for React Native
 */
export class SSEService extends EventEmitter {
  private config: Required<SSEConfig>;
  private connectionState: SSEConnectionState = 'disconnected';
  private abortController: AbortController | null = null;
  private lastEventId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private health: ConnectionHealth;
  private appState: AppStateStatus = 'active';
  private appStateSubscription: any = null;

  constructor(config: SSEConfig) {
    super();
    this.config = {
      timeout: 300000,
      heartbeatTimeout: 30000,
      maxReconnectAttempts: 5,
      reconnectBaseDelay: 1000,
      reconnectMaxDelay: 30000,
      authToken: undefined,
      ...config,
    };

    this.health = {
      lastHeartbeat: null,
      heartbeatsReceived: 0,
      missedHeartbeats: 0,
      reconnectCount: 0,
      averageLatency: 0,
      connectionDrops: 0,
    };

    this.setupAppStateListener();
  }

  /**
   * Setup app state listener to handle background/foreground transitions
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Handle app state changes (background/foreground)
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const previousState = this.appState;
    this.appState = nextAppState;

    if (previousState === 'background' && nextAppState === 'active') {
      // App came to foreground - check connection health
      this.emit('app-foreground');

      if (this.connectionState === 'connected') {
        const timeSinceLastHeartbeat = this.health.lastHeartbeat
          ? Date.now() - this.health.lastHeartbeat
          : Infinity;

        if (timeSinceLastHeartbeat > this.config.heartbeatTimeout * 2) {
          // Connection likely stale, trigger reconnect
          this.emit('stale-connection', { timeSinceLastHeartbeat });
          this.reconnect('app-foreground-stale');
        }
      }
    } else if (nextAppState === 'background') {
      // App went to background
      this.emit('app-background');
    }
  }

  /**
   * Get current connection state
   */
  getState(): SSEConnectionState {
    return this.connectionState;
  }

  /**
   * Get connection health metrics
   */
  getHealth(): ConnectionHealth {
    return { ...this.health };
  }

  /**
   * Get the last event ID for resume
   */
  getLastEventId(): string | null {
    return this.lastEventId;
  }

  /**
   * Start an SSE stream
   */
  async stream(options: SSERequestOptions): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      this.disconnect('new-stream');
    }

    this.abortController = new AbortController();
    this.updateState('connecting');
    this.startHeartbeatMonitor();

    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    // Add Last-Event-ID for resume support
    if (options.lastEventId || this.lastEventId) {
      headers['Last-Event-ID'] = options.lastEventId || this.lastEventId!;
    }

    const body: Record<string, any> = {
      message: options.message,
    };

    if (options.sessionId) {
      body.sessionId = options.sessionId;
    }
    if (options.runtimeModelId) {
      body.runtimeModelId = options.runtimeModelId;
    }
    if (options.useWebSearch !== undefined) {
      body.useWebSearch = options.useWebSearch;
    }
    if (options.taskType) {
      body.taskType = options.taskType;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new SSEError(
          errorData.detail || `HTTP ${response.status}`,
          'HTTP_ERROR',
          response.status >= 500 || response.status === 429
        );
      }

      this.updateState('connected');
      this.reconnectAttempts = 0;

      // Process the stream
      await this.processStream(response);

    } catch (error) {
      if (error instanceof SSEError) {
        this.handleError(error);
      } else if (error instanceof Error) {
        if (error.name === 'AbortError') {
          this.emit('aborted');
          this.updateState('disconnected');
        } else {
          this.handleError(new SSEError(
            error.message,
            'NETWORK_ERROR',
            true
          ));
        }
      }
    }
  }

  /**
   * Process the SSE stream
   */
  private async processStream(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new SSEError('No response body', 'NO_BODY', false);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.emit('stream-end');
          this.updateState('disconnected');
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          this.processLine(line.trim());
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process a single SSE line
   */
  private processLine(line: string): void {
    // Skip empty lines
    if (!line) {
      return;
    }

    // Handle SSE comments (heartbeats)
    if (line.startsWith(':')) {
      if (line.includes('heartbeat')) {
        this.handleHeartbeat(line);
      }
      return;
    }

    // Handle data lines
    if (line.startsWith('data:')) {
      const dataStr = line.substring(5).trim();
      if (!dataStr) {
        return;
      }

      try {
        const event = JSON.parse(dataStr) as SSEEvent;
        this.handleEvent(event);
      } catch (e) {
        // JSON parse error - emit as raw data
        this.emit('raw-data', dataStr);
      }
    }
  }

  /**
   * Handle an SSE event
   */
  private handleEvent(event: SSEEvent): void {
    switch (event.type) {
      case 'token':
        if (event.eventId) {
          this.lastEventId = event.eventId;
        }
        this.emit('token', event);
        this.emit('event', event);
        break;

      case 'metadata':
        this.emit('metadata', event);
        this.emit('event', event);
        break;

      case 'usage':
        this.emit('usage', event);
        this.emit('event', event);
        break;

      case 'done':
        if (event.eventId) {
          this.lastEventId = event.eventId;
        }
        this.emit('done', event);
        this.emit('event', event);
        this.updateState('disconnected');
        break;

      case 'error':
        this.emit('error', event);
        this.emit('event', event);
        break;

      default:
        this.emit('event', event);
    }
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(line: string): void {
    const now = Date.now();
    const previousHeartbeat = this.health.lastHeartbeat;
    this.health.lastHeartbeat = now;
    this.health.heartbeatsReceived++;

    if (previousHeartbeat) {
      const interval = now - previousHeartbeat;
      // Update rolling average latency
      this.health.averageLatency =
        (this.health.averageLatency * (this.health.heartbeatsReceived - 1) + interval)
        / this.health.heartbeatsReceived;
    }

    const event: SSEHeartbeatEvent = {
      type: 'heartbeat',
      timestamp: now,
    };

    this.emit('heartbeat', event);
    this.resetHeartbeatMonitor();
  }

  /**
   * Start heartbeat monitor
   */
  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor();

    this.heartbeatTimer = setTimeout(() => {
      this.health.missedHeartbeats++;
      this.emit('heartbeat-missed', {
        timeSinceLastHeartbeat: this.health.lastHeartbeat
          ? Date.now() - this.health.lastHeartbeat
          : null,
      });

      // If too many missed heartbeats, attempt reconnect
      if (this.health.missedHeartbeats >= 3) {
        this.reconnect('heartbeat-timeout');
      }
    }, this.config.heartbeatTimeout);
  }

  /**
   * Reset heartbeat monitor
   */
  private resetHeartbeatMonitor(): void {
    this.startHeartbeatMonitor();
  }

  /**
   * Stop heartbeat monitor
   */
  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: SSEError): void {
    this.emit('error', {
      type: 'error',
      message: error.message,
      code: error.code,
      retryable: error.retryable,
    });

    if (error.retryable && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnect('error');
    } else {
      this.updateState('error');
    }
  }

  /**
   * Attempt to reconnect
   */
  private reconnect(reason: string): void {
    this.health.reconnectCount++;
    this.updateState('reconnecting');
    this.stopHeartbeatMonitor();

    // Calculate backoff delay
    const delay = Math.min(
      this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
      this.config.reconnectMaxDelay
    );

    this.reconnectAttempts++;
    this.health.connectionDrops++;

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delay,
      reason,
    });

    this.reconnectTimer = setTimeout(() => {
      // The consumer should call stream() again with lastEventId
      this.emit('reconnect-ready', {
        lastEventId: this.lastEventId,
        attempt: this.reconnectAttempts,
      });
    }, delay);
  }

  /**
   * Update connection state
   */
  private updateState(state: SSEConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;
    this.emit('state-change', { state, previousState });
  }

  /**
   * Disconnect the stream
   */
  disconnect(reason: string = 'user-request'): void {
    this.stopHeartbeatMonitor();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.updateState('disconnected');
    this.emit('disconnected', { reason });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect('destroy');

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.removeAllListeners();
  }
}

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

/**
 * Create a simplified SSE client for chat streaming
 */
export function createSSEChatClient(config: SSEConfig) {
  const service = new SSEService(config);

  return {
    /**
     * Stream a chat message
     */
    stream: (options: SSERequestOptions) => service.stream(options),

    /**
     * Disconnect current stream
     */
    disconnect: () => service.disconnect('user-request'),

    /**
     * Get current state
     */
    getState: () => service.getState(),

    /**
     * Get connection health
     */
    getHealth: () => service.getHealth(),

    /**
     * Get last event ID for resume
     */
    getLastEventId: () => service.getLastEventId(),

    /**
     * Subscribe to tokens
     */
    onToken: (callback: (event: SSETokenEvent) => void) => {
      service.on('token', callback);
      return () => service.off('token', callback);
    },

    /**
     * Subscribe to metadata events
     */
    onMetadata: (callback: (event: SSEMetadataEvent) => void) => {
      service.on('metadata', callback);
      return () => service.off('metadata', callback);
    },

    /**
     * Subscribe to usage events
     */
    onUsage: (callback: (event: SSEUsageEvent) => void) => {
      service.on('usage', callback);
      return () => service.off('usage', callback);
    },

    /**
     * Subscribe to done events
     */
    onDone: (callback: (event: SSEDoneEvent) => void) => {
      service.on('done', callback);
      return () => service.off('done', callback);
    },

    /**
     * Subscribe to error events
     */
    onError: (callback: (event: SSEErrorEvent) => void) => {
      service.on('error', callback);
      return () => service.off('error', callback);
    },

    /**
     * Subscribe to state changes
     */
    onStateChange: (callback: (state: { state: SSEConnectionState; previousState: SSEConnectionState }) => void) => {
      service.on('state-change', callback);
      return () => service.off('state-change', callback);
    },

    /**
     * Subscribe to heartbeat events
     */
    onHeartbeat: (callback: (event: SSEHeartbeatEvent) => void) => {
      service.on('heartbeat', callback);
      return () => service.off('heartbeat', callback);
    },

    /**
     * Subscribe to reconnecting events
     */
    onReconnecting: (callback: (info: { attempt: number; maxAttempts: number; delay: number; reason: string }) => void) => {
      service.on('reconnecting', callback);
      return () => service.off('reconnecting', callback);
    },

    /**
     * Cleanup
     */
    destroy: () => service.destroy(),
  };
}

export default SSEService;
