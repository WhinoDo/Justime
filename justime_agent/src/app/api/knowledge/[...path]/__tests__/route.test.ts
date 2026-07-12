import type { NextRequest } from 'next/server'

const mockProxyToBackend = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn(),
  },
}))

jest.mock('@/lib/api/proxy', () => ({
  proxyToBackend: (...args: unknown[]) => mockProxyToBackend(...args),
}))

describe('/api/knowledge/[...path] JSON passthrough', () => {
  beforeEach(() => {
    mockProxyToBackend.mockReset()
  })

  it.each([
    ['GET', ['rebuild', 'status', 'task-1'], '/knowledge/rebuild/status/task-1'],
    ['POST', ['rebuild'], '/knowledge/rebuild'],
    ['DELETE', ['files', 'notes.md'], '/knowledge/files/notes.md'],
  ] as const)('passes the original %s request and response through unchanged', async (method, path, endpoint) => {
    const structuredBody = {
      availability: {
        mode: 'cloud',
        provider: 'notebooklm',
        status: 'unavailable',
        retryable: true,
        error_code: 'PROVIDER_UNAVAILABLE',
      },
    }
    const structuredResponse = {
      status: 503,
      body: structuredBody,
    }
    const request = { method } as unknown as NextRequest
    mockProxyToBackend.mockResolvedValue(structuredResponse)
    const route = await import('../route')

    const response = await route[method](request, { params: { path: [...path] } })

    expect(mockProxyToBackend).toHaveBeenCalledWith(request, endpoint)
    expect(response).toBe(structuredResponse)
    expect(structuredResponse.status).toBe(503)
    expect(structuredResponse.body.availability).toEqual({
      mode: 'cloud',
      provider: 'notebooklm',
      status: 'unavailable',
      retryable: true,
      error_code: 'PROVIDER_UNAVAILABLE',
    })
  })
})
