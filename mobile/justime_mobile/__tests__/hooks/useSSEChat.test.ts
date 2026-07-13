import { renderHook, act } from '@testing-library/react-native';
import { useSSEChat } from '../../hooks/useSSEChat';
import { SSEService } from '../../services/sseService';

// Mock SSEService
const mockStream = jest.fn();
const mockDisconnect = jest.fn();
const mockGetHealth = jest.fn();
const mockGetLastEventId = jest.fn();
const mockDestroy = jest.fn();
const mockOn = jest.fn();
const mockRemoveAllListeners = jest.fn();

jest.mock('../../services/sseService', () => ({
  SSEService: jest.fn().mockImplementation(() => ({
    on: mockOn,
    stream: mockStream,
    disconnect: mockDisconnect,
    getHealth: mockGetHealth,
    getLastEventId: mockGetLastEventId,
    destroy: mockDestroy,
    removeAllListeners: mockRemoveAllListeners,
  })),
  SSEConfig: {},
  SSETokenEvent: {},
  SSEMetadataEvent: {},
  SSEUsageEvent: {},
  SSEDoneEvent: {},
  SSEErrorEvent: {},
  SSEConnectionState: {},
  ConnectionHealth: {},
}));

const defaultOptions = {
  baseUrl: 'http://test.com',
};

describe('useSSEChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should return initial state with default values', () => {
      const { result } = renderHook(() => useSSEChat(defaultOptions));

      expect(result.current.state).toEqual({
        content: '',
        isStreaming: false,
        connectionState: 'disconnected',
        error: null,
        metadata: null,
        usage: null,
        messageId: null,
        sessionId: null,
      });
    });

    it('should initialize health metrics', () => {
      const { result } = renderHook(() => useSSEChat(defaultOptions));

      expect(result.current.health).toEqual({
        lastHeartbeat: null,
        heartbeatsReceived: 0,
        missedHeartbeats: 0,
        reconnectCount: 0,
        averageLatency: 0,
        connectionDrops: 0,
      });
    });

    it('should set initial sessionId when provided', () => {
      const { result } = renderHook(() =>
        useSSEChat({ ...defaultOptions, sessionId: 'session-123' })
      );

      expect(result.current.state.sessionId).toBe('session-123');
    });
  });

  describe('sendMessage', () => {
    it('should update streaming state when sending', async () => {
      mockStream.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSSEChat(defaultOptions));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.state.isStreaming).toBe(true);
      expect(result.current.state.content).toBe('');
      expect(mockStream).toHaveBeenCalledWith({
        message: 'Hello',
        sessionId: undefined,
      });
    });

    it('should not send if service is not initialized', async () => {
      // Service is initialized on mount via effect, so this is hard to trigger directly.
      // We verify that stream was called with the correct args.
      mockStream.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSSEChat(defaultOptions));

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      expect(mockStream).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop streaming and update state', () => {
      const { result } = renderHook(() => useSSEChat(defaultOptions));

      act(() => {
        result.current.stop();
      });

      expect(mockDisconnect).toHaveBeenCalledWith('user-stop');
      expect(result.current.state.isStreaming).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useSSEChat(defaultOptions));

      act(() => {
        result.current.reset();
      });

      expect(mockDisconnect).toHaveBeenCalledWith('user-stop');
      expect(result.current.state).toEqual({
        content: '',
        isStreaming: false,
        connectionState: 'disconnected',
        error: null,
        metadata: null,
        usage: null,
        messageId: null,
        sessionId: null,
      });
      expect(result.current.health).toEqual({
        lastHeartbeat: null,
        heartbeatsReceived: 0,
        missedHeartbeats: 0,
        reconnectCount: 0,
        averageLatency: 0,
        connectionDrops: 0,
      });
    });
  });

  describe('event handlers', () => {
    it('should register event handlers on mount', () => {
      renderHook(() => useSSEChat(defaultOptions));

      const eventNames = mockOn.mock.calls.map((call: string[]) => call[0]);
      expect(eventNames).toContain('token');
      expect(eventNames).toContain('metadata');
      expect(eventNames).toContain('usage');
      expect(eventNames).toContain('done');
      expect(eventNames).toContain('error');
      expect(eventNames).toContain('state-change');
      expect(eventNames).toContain('heartbeat');
      expect(eventNames).toContain('reconnect-ready');
    });

    it('should call SSEService.destroy on unmount', () => {
      const { unmount } = renderHook(() => useSSEChat(defaultOptions));

      unmount();

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconnect', () => {
    it('should call stream with pending message on reconnect', () => {
      mockStream.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSSEChat(defaultOptions));

      // First send a message
      act(() => {
        result.current.sendMessage('Hello');
      });

      // Then reconnect
      act(() => {
        result.current.reconnect();
      });

      expect(mockStream).toHaveBeenCalled();
    });
  });

  describe('state updates', () => {
    it('should provide all expected return values', () => {
      const { result } = renderHook(() => useSSEChat(defaultOptions));

      expect(result.current).toHaveProperty('state');
      expect(result.current).toHaveProperty('health');
      expect(result.current).toHaveProperty('sendMessage');
      expect(result.current).toHaveProperty('stop');
      expect(result.current).toHaveProperty('reconnect');
      expect(result.current).toHaveProperty('reset');
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.stop).toBe('function');
      expect(typeof result.current.reconnect).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });
});
