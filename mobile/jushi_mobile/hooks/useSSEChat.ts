/**
 * React Hook for SSE Chat Streaming
 *
 * Provides a simple interface for components to:
 * - Stream chat messages with typing effect
 * - Handle reconnection automatically
 * - Track connection state and health
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  SSEService,
  SSEConfig,
  SSETokenEvent,
  SSEMetadataEvent,
  SSEUsageEvent,
  SSEDoneEvent,
  SSEErrorEvent,
  SSEConnectionState,
  ConnectionHealth,
} from '../services/sseService';

// Chat state
export interface SSEChatState {
  content: string;
  isStreaming: boolean;
  connectionState: SSEConnectionState;
  error: string | null;
  metadata: SSEMetadataEvent['data'] | null;
  usage: SSEUsageEvent['data'] | null;
  messageId: string | null;
  sessionId: string | null;
}

// Hook options
export interface UseSSEChatOptions {
  baseUrl: string;
  authToken?: string;
  sessionId?: string;
  autoReconnect?: boolean;
  onToken?: (token: string, fullContent: string) => void;
  onDone?: (messageId: string, content: string) => void;
  onError?: (error: string) => void;
  onReconnect?: (attempt: number, lastEventId: string | null) => void;
}

// Hook return type
export interface UseSSEChatReturn {
  state: SSEChatState;
  health: ConnectionHealth;
  sendMessage: (message: string, options?: {
    runtimeModelId?: string;
    useWebSearch?: boolean;
    taskType?: string;
  }) => Promise<void>;
  stop: () => void;
  reconnect: () => void;
  reset: () => void;
}

/**
 * Hook for SSE chat streaming
 */
export function useSSEChat(options: UseSSEChatOptions): UseSSEChatReturn {
  const {
    baseUrl,
    authToken,
    sessionId: initialSessionId,
    autoReconnect = true,
    onToken,
    onDone,
    onError,
    onReconnect,
  } = options;

  // State
  const [state, setState] = useState<SSEChatState>({
    content: '',
    isStreaming: false,
    connectionState: 'disconnected',
    error: null,
    metadata: null,
    usage: null,
    messageId: null,
    sessionId: initialSessionId || null,
  });

  const [health, setHealth] = useState<ConnectionHealth>({
    lastHeartbeat: null,
    heartbeatsReceived: 0,
    missedHeartbeats: 0,
    reconnectCount: 0,
    averageLatency: 0,
    connectionDrops: 0,
  });

  // Refs
  const serviceRef = useRef<SSEService | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const pendingOptionsRef = useRef<{
    runtimeModelId?: string;
    useWebSearch?: boolean;
    taskType?: string;
  } | null>(null);

  // Initialize service
  useEffect(() => {
    const config: SSEConfig = {
      baseUrl,
      authToken,
      timeout: 300000,
      heartbeatTimeout: 30000,
      maxReconnectAttempts: 5,
      reconnectBaseDelay: 1000,
      reconnectMaxDelay: 30000,
    };

    serviceRef.current = new SSEService(config);

    // Setup event handlers
    const service = serviceRef.current;

    service.on('token', (event: SSETokenEvent) => {
      setState(prev => ({
        ...prev,
        content: prev.content + event.content,
      }));

      if (onToken) {
        onToken(event.content, state.content + event.content);
      }

      // Update session ID if provided
      if (event.sessionId) {
        setState(prev => ({ ...prev, sessionId: event.sessionId }));
      }
    });

    service.on('metadata', (event: SSEMetadataEvent) => {
      setState(prev => ({
        ...prev,
        metadata: event.data,
      }));
    });

    service.on('usage', (event: SSEUsageEvent) => {
      setState(prev => ({
        ...prev,
        usage: event.data,
      }));
    });

    service.on('done', (event: SSEDoneEvent) => {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        messageId: event.messageId || null,
        sessionId: event.sessionId || prev.sessionId,
      }));

      if (onDone && event.messageId) {
        onDone(event.messageId, state.content);
      }
    });

    service.on('error', (event: SSEErrorEvent) => {
      setState(prev => ({
        ...prev,
        error: event.message,
        isStreaming: false,
      }));

      if (onError) {
        onError(event.message);
      }
    });

    service.on('state-change', ({ state: newState }) => {
      setState(prev => ({
        ...prev,
        connectionState: newState,
      }));
    });

    service.on('heartbeat', () => {
      setHealth(service.getHealth());
    });

    service.on('reconnect-ready', ({ lastEventId }) => {
      if (autoReconnect && pendingMessageRef.current) {
        if (onReconnect) {
          onReconnect(service.getHealth().reconnectCount, lastEventId);
        }

        // Resume streaming with pending message
        service.stream({
          message: pendingMessageRef.current,
          sessionId: state.sessionId || undefined,
          lastEventId: lastEventId || undefined,
          ...pendingOptionsRef.current,
        });
      }
    });

    return () => {
      service.destroy();
      serviceRef.current = null;
    };
  }, [baseUrl, authToken]);

  // Update health periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (serviceRef.current) {
        setHealth(serviceRef.current.getHealth());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Send a message and start streaming
   */
  const sendMessage = useCallback(async (
    message: string,
    streamOptions?: {
      runtimeModelId?: string;
      useWebSearch?: boolean;
      taskType?: string;
    }
  ) => {
    if (!serviceRef.current) {
      console.error('SSE service not initialized');
      return;
    }

    // Reset state for new message
    setState(prev => ({
      ...prev,
      content: '',
      isStreaming: true,
      error: null,
      metadata: null,
      usage: null,
      messageId: null,
    }));

    // Store for potential reconnect
    pendingMessageRef.current = message;
    pendingOptionsRef.current = streamOptions || null;

    try {
      await serviceRef.current.stream({
        message,
        sessionId: state.sessionId || undefined,
        ...streamOptions,
      });
    } catch (error) {
      console.error('Stream error:', error);
    }
  }, [state.sessionId]);

  /**
   * Stop current stream
   */
  const stop = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect('user-stop');
      pendingMessageRef.current = null;
      pendingOptionsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  /**
   * Manually trigger reconnect
   */
  const reconnect = useCallback(() => {
    if (serviceRef.current && pendingMessageRef.current) {
      serviceRef.current.stream({
        message: pendingMessageRef.current,
        sessionId: state.sessionId || undefined,
        lastEventId: serviceRef.current.getLastEventId() || undefined,
        ...pendingOptionsRef.current,
      });
    }
  }, [state.sessionId]);

  /**
   * Reset state completely
   */
  const reset = useCallback(() => {
    stop();
    setState({
      content: '',
      isStreaming: false,
      connectionState: 'disconnected',
      error: null,
      metadata: null,
      usage: null,
      messageId: null,
      sessionId: null,
    });
    setHealth({
      lastHeartbeat: null,
      heartbeatsReceived: 0,
      missedHeartbeats: 0,
      reconnectCount: 0,
      averageLatency: 0,
      connectionDrops: 0,
    });
  }, [stop]);

  return {
    state,
    health,
    sendMessage,
    stop,
    reconnect,
    reset,
  };
}

export default useSSEChat;
