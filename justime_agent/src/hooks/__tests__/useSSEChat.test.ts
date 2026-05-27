import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSSEChat } from '@/hooks/useSSEChat'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock AbortController
const mockAbort = vi.fn()
vi.spyOn(AbortController.prototype, 'abort').mockImplementation(mockAbort)

describe('useSSEChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with default state', () => {
    const { result } = renderHook(() => useSSEChat())

    expect(result.current.isConnected).toBe(false)
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.content).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('handles successful SSE connection', async () => {
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"start","conversation_id":"conv123"}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"token","content":"Hello"}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"done"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (key: string) => (key === 'content-type' ? 'text/event-stream' : null),
      },
      body: {
        getReader: () => mockReader,
      },
    })

    const { result } = renderHook(() => useSSEChat())

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    expect(result.current.content).toBe('Hello')
    expect(result.current.conversationId).toBe('conv123')
  })

  it('handles error events', async () => {
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"error","error":"Something went wrong"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (key: string) => (key === 'content-type' ? 'text/event-stream' : null),
      },
      body: {
        getReader: () => mockReader,
      },
    })

    const { result } = renderHook(() => useSSEChat())

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
      json: () => Promise.resolve({ detail: 'Internal Server Error' }),
    })

    const { result } = renderHook(() => useSSEChat())

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    expect(result.current.error).toBe('Internal Server Error')
  })

  it('cancels ongoing stream', async () => {
    const mockReader = {
      read: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      cancel: vi.fn(),
      releaseLock: vi.fn(),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (key: string) => (key === 'content-type' ? 'text/event-stream' : null),
      },
      body: {
        getReader: () => mockReader,
      },
    })

    const { result } = renderHook(() => useSSEChat())

    act(() => {
      result.current.sendMessage('Test message')
    })

    // Cancel the stream
    act(() => {
      result.current.cancel()
    })

    expect(mockAbort).toHaveBeenCalled()
    expect(result.current.isStreaming).toBe(false)
  })

  it('resets state correctly', async () => {
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"event":"token","content":"Test"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (key: string) => (key === 'content-type' ? 'text/event-stream' : null),
      },
      body: {
        getReader: () => mockReader,
      },
    })

    const { result } = renderHook(() => useSSEChat())

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    expect(result.current.content).toBe('Test')

    // Reset
    act(() => {
      result.current.reset()
    })

    expect(result.current.content).toBe('')
    expect(result.current.error).toBeNull()
    expect(result.current.isStreaming).toBe(false)
  })

  it('handles metadata events', async () => {
    const metadata = {
      ragReferences: [{
        referenceId: 'ref1',
        docPath: '/docs/test.md',
        fileName: 'test.md',
        score: 0.9,
        snippets: ['snippet'],
        queries: ['query'],
      }],
    }

    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`data: {"event":"metadata","metadata":${JSON.stringify(metadata)}}\n\n`),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (key: string) => (key === 'content-type' ? 'text/event-stream' : null),
      },
      body: {
        getReader: () => mockReader,
      },
    })

    const { result } = renderHook(() => useSSEChat())

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    expect(result.current.metadata).toEqual(metadata)
  })
})