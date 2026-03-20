const mockNextResponseJson = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => mockNextResponseJson(...args),
  },
}))

jest.mock('@/lib/api/config', () => ({
  API_CONFIG: {
    getFullUrl: (endpoint: string) => `http://backend.local${endpoint}`,
  },
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  },
}))

describe('proxyToBackend', () => {
  const originalFetch = global.fetch
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.resetModules()
    mockNextResponseJson.mockReset()
    process.env.NODE_ENV = originalNodeEnv
  })

  afterAll(() => {
    global.fetch = originalFetch
    process.env.NODE_ENV = originalNodeEnv
  })

  it('keeps full cookie token when token contains "="', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'cookie') return 'access_token=abc=def==; foo=bar'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer abc=def==')
  })

  it('decodes url-encoded bearer token from cookie', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'cookie') return 'access_token=Bearer%20abc%3D%3D; foo=bar'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer abc==')
  })

  it('decodes plus-encoded bearer token from cookie', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'cookie') return 'access_token=Bearer+abc-plus; foo=bar'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer abc-plus')
  })

  it('does not set Authorization when cookie token is empty after normalization', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'cookie') return 'access_token=Bearer%20; foo=bar'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not set Authorization when cookie token is placeholder text', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'cookie') return 'access_token=undefined; foo=bar'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not set Authorization when bearer payload is placeholder text', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'cookie') return 'access_token=Bearer%20undefined; foo=bar'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('falls back to cookie token when authorization header is bearer placeholder text', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return 'Bearer undefined'
          if (key === 'cookie') return 'access_token=Bearer%20cookie-valid; foo=bar'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer cookie-valid')
  })

  it('falls back to cookie token when authorization header is quoted bearer placeholder text', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return '"Bearer undefined"'
          if (key === 'cookie') return 'access_token=Bearer%20cookie-valid; foo=bar'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer cookie-valid')
  })

  it('does not forward malformed bare bearer header', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return 'Bearer'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not strip bearer-like token without whitespace separator', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'GET',
      headers: {
        get: (key: string) => {
          if (key === 'authorization') return 'BearerToken-abc'
          return null
        },
      },
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer BearerToken-abc')
  })

  it('does not expose _debugUrl in production 422 responses', async () => {
    process.env.NODE_ENV = 'production'
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 422,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: false, error: 'invalid' }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'POST',
      headers: {
        get: () => null,
      },
      clone: () => ({
        text: async () => JSON.stringify({ message: 'hello' }),
      }),
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const responseBody = mockNextResponseJson.mock.calls[0][0]
    expect(responseBody._debugUrl).toBeUndefined()
  })

  it('preserves explicit boolean false request body', async () => {
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'POST',
      headers: {
        get: () => null,
      },
      clone: () => ({
        text: async () => JSON.stringify({ fallback: true }),
      }),
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions', {
      method: 'POST',
      body: false,
      requireAuth: false,
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(fetchOptions.body).toBe('false')
  })

  it('does not log backend response body in production', async () => {
    process.env.NODE_ENV = 'production'
    const backendHeaders = new Headers({ 'content-type': 'application/json' })
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: backendHeaders,
      text: async () => JSON.stringify({ answer: 'secret-response-content' }),
    }) as unknown as typeof fetch

    mockNextResponseJson.mockImplementation((_body: unknown, _init: unknown) => ({
      headers: { set: jest.fn() },
    }))

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { proxyToBackend } = await import('@/lib/api/proxy')

    const request = {
      method: 'POST',
      headers: {
        get: () => null,
      },
      clone: () => ({
        text: async () => JSON.stringify({ message: 'hello' }),
      }),
      nextUrl: {
        searchParams: new URLSearchParams(),
      },
    } as any

    await proxyToBackend(request, '/api/v1/chat/sessions')

    const loggedPayload = consoleLogSpy.mock.calls
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ')

    expect(loggedPayload).not.toContain('secret-response-content')
    consoleLogSpy.mockRestore()
  })
})

describe('validateRequiredFields', () => {
  it('treats 0 and false as valid values', async () => {
    const { validateRequiredFields } = await import('@/lib/api/proxy')

    const result = validateRequiredFields(
      {
        retries: 0,
        enabled: false,
      },
      ['retries', 'enabled']
    )

    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })
})
