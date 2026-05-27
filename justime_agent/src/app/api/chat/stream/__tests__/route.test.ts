/**
 * @jest-environment node
 */
import { POST } from '@/app/api/chat/stream/route'
import { NextRequest } from 'next/server'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SSE Streaming Route Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('returns 400 for invalid request body', async () => {
    const request = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      body: 'invalid json',
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 for missing message', async () => {
    const request = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toContain('消息内容无效')
  })

  it('forwards request to backend SSE endpoint', async () => {
    // Mock backend SSE response
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

    const request = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Test message',
        sessionId: 'session123',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
  })

  it('handles backend errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Internal Server Error' }),
    })

    const request = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Test message',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data.error).toContain('Internal Server Error')
  })

  it('includes auth token in backend request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'text/event-stream',
      },
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true }),
        }),
      },
    })

    const request = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'access_token=test-token',
      },
      body: JSON.stringify({
        message: 'Test message',
      }),
    })

    await POST(request)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )
  })

  it('forwards Last-Event-ID header for reconnection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'text/event-stream',
      },
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true }),
        }),
      },
    })

    const request = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Last-Event-ID': 'event123',
      },
      body: JSON.stringify({
        message: 'Test message',
      }),
    })

    await POST(request)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Last-Event-ID': 'event123',
        }),
      })
    )
  })
})