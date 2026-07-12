import type { NextRequest } from 'next/server'

const mockProxyToBackend = jest.fn()

jest.mock('@/lib/api/proxy', () => ({
  proxyToBackend: (...args: unknown[]) => mockProxyToBackend(...args),
}))

describe('/api/task-processes route', () => {
  beforeEach(() => {
    mockProxyToBackend.mockReset()
    mockProxyToBackend.mockResolvedValue({ ok: true })
  })

  it('passes the original GET request to the task-process backend endpoint', async () => {
    const request = {
      method: 'GET',
      nextUrl: {
        searchParams: new URLSearchParams('phase=during&sort_by=progress&page=2'),
      },
    } as unknown as NextRequest
    const { GET } = await import('../route')

    await GET(request)

    expect(mockProxyToBackend).toHaveBeenCalledWith(request, '/task-processes')
    expect(request.nextUrl.searchParams.toString()).toBe('phase=during&sort_by=progress&page=2')
  })

  it('proxies task creation through the root endpoint', async () => {
    const body = { title: '新任务' }
    const request = {
      method: 'POST',
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest
    const { POST } = await import('../route')

    await POST(request)

    expect(mockProxyToBackend).toHaveBeenCalledWith(request, '/task-processes', {
      method: 'POST',
      body,
    })
  })
})
