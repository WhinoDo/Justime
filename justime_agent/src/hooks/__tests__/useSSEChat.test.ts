import { renderHook, act } from '@testing-library/react'
import { TextEncoder, TextDecoder } from 'util'
import { useSSEChat } from '@/hooks/useSSEChat'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch
global.TextEncoder = TextEncoder as typeof global.TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

describe('useSSEChat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  it('initializes with default state', () => {
    const { result } = renderHook(() => useSSEChat({ endpoint: '/api/chat/stream' }))

    expect(result.current.connectionState).toBe('disconnected')
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.content).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('handles successful SSE connection', async () => {
    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"start","conversationId":"conv123","messageId":"msg123"}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"token","content":"Hello"}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"done","messageId":"msg123"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: { getReader: () => mockReader },
    })

    const onStart = jest.fn()
    const onDone = jest.fn()
    const { result } = renderHook(() => useSSEChat({ endpoint: '/api/chat/stream', onStart, onDone, maxRetries: 0 }))

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    expect(result.current.content).toBe('Hello')
    expect(result.current.messageId).toBe('msg123')
    expect(onStart).toHaveBeenCalledWith('conv123', 'msg123')
    expect(onDone).toHaveBeenCalledWith('msg123', 'Hello')
  })

  it('handles error events', async () => {
    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"error","message":"Something went wrong"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: { getReader: () => mockReader },
    })

    const { result } = renderHook(() => useSSEChat({ endpoint: '/api/chat/stream', maxRetries: 0 }))

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    expect(result.current.error).toBe('Something went wrong')
    expect(result.current.isStreaming).toBe(false)
  })

  it('handles HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const { result } = renderHook(() => useSSEChat({ endpoint: '/api/chat/stream', maxRetries: 0 }))

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    expect(result.current.error).toContain('HTTP 500')
  })

  it('stops ongoing stream', async () => {
    const abortSpy = jest.spyOn(AbortController.prototype, 'abort').mockImplementation(() => {})
    const mockReader = {
      read: jest.fn().mockImplementation(() => new Promise(() => {})),
      releaseLock: jest.fn(),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: { getReader: () => mockReader },
    })

    const { result } = renderHook(() => useSSEChat({ endpoint: '/api/chat/stream', maxRetries: 0 }))

    await act(async () => {
      void result.current.sendMessage('Test message')
      await Promise.resolve()
    })

    act(() => {
      result.current.stop()
    })

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })

  it('resets state correctly', () => {
    const { result } = renderHook(() => useSSEChat({ endpoint: '/api/chat/stream' }))

    act(() => {
      result.current.reset()
    })

    expect(result.current.content).toBe('')
    expect(result.current.error).toBeNull()
    expect(result.current.isStreaming).toBe(false)
  })
})
