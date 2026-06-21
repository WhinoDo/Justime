/**
 * @jest-environment node
 */
import { POST } from '@/app/api/chat/stream/route'
import { NextRequest } from 'next/server'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

describe('SSE Streaming Route Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  it('returns 500 for invalid request body', async () => {
    const request = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      body: 'invalid json',
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })

  it('forwards request to backend SSE endpoint', async () => {
    const mockReader = {
      read: jest.fn().mockResolvedValueOnce({ done: true, value: undefined }),
      cancel: jest.fn(),
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
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({ detail: 'Internal Server Error' })),
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

  it('forwards auth and reconnection headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'text/event-stream',
      },
      body: {
        getReader: () => ({
          read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          cancel: jest.fn(),
        }),
      },
    })

    const request = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'Last-Event-ID': 'event123',
        'Cookie': 'access_token=test-token',
      },
      body: JSON.stringify({ message: 'Test message' }),
    })

    await POST(request)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Last-Event-ID': 'event123',
          Cookie: 'access_token=test-token',
        }),
      }),
    )
  })
})
