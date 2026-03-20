const mockJson = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => mockJson(...args),
  },
}))

jest.mock('@/lib/api/config', () => ({
  API_CONFIG: {
    BASE_URL: 'http://backend.local',
    getFullUrl: () => 'http://backend.local/api/v1/chat/',
  },
}))

jest.mock('@/lib/api/proxy', () => ({
  createErrorResponse: jest.fn(),
  createSuccessResponse: jest.fn(),
}))

describe('POST /api/chat route', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetModules()
    mockJson.mockReset()
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
    global.fetch = originalFetch
  })

  it('hides backend error details in production', async () => {
    process.env.NODE_ENV = 'production'
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ detail: 'database stacktrace leak' }),
    }) as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.details).not.toContain('database stacktrace leak')
  })

  it('does not log backend error details in production', async () => {
    process.env.NODE_ENV = 'production'
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ detail: 'database stacktrace leak' }),
    }) as unknown as typeof fetch

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const loggedPayload = consoleErrorSpy.mock.calls
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ')

    expect(loggedPayload).not.toContain('database stacktrace leak')
    consoleErrorSpy.mockRestore()
  })

  it('redacts message preview in production forwarding logs', async () => {
    process.env.NODE_ENV = 'production'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    }) as unknown as typeof fetch

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'my bank pin is 123456' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const loggedPayload = consoleLogSpy.mock.calls
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ')

    expect(loggedPayload).not.toContain('my bank pin is 123456')
    expect(loggedPayload).toContain('[REDACTED]')
    consoleLogSpy.mockRestore()
  })

  it('does not expose backend host in production logs', async () => {
    process.env.NODE_ENV = 'production'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    }) as unknown as typeof fetch

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const loggedPayload = consoleLogSpy.mock.calls
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ')

    expect(loggedPayload).not.toContain('http://backend.local')
    consoleLogSpy.mockRestore()
  })

  it('normalizes lowercase bearer authorization header before forwarding', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'bearer token-abc' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-abc')
  })

  it('does not forward authorization header when bearer uses plus separator', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer+token-from-header' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('normalizes lowercase bearer token from cookie before forwarding', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: 'bearer token-cookie' }) },
      headers: { get: () => null },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-cookie')
  })

  it('decodes url-encoded bearer token from cookie before forwarding', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: 'Bearer%20token-cookie%3D%3D' }) },
      headers: { get: () => null },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-cookie==')
  })

  it('decodes plus-encoded bearer token from cookie before forwarding', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: 'Bearer+token-plus' }) },
      headers: { get: () => null },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-plus')
  })

  it('preserves literal plus signs inside cookie bearer token payload', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: 'Bearer%20token+plus+payload' }) },
      headers: { get: () => null },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token+plus+payload')
  })

  it('does not forward malformed bare bearer header', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('falls back to authorization header when cookie token is placeholder text', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: 'undefined' }) },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-from-header' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-from-header')
  })

  it('falls back to authorization header when cookie token is bearer placeholder text', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: 'Bearer%20undefined' }) },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-from-header' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-from-header')
  })

  it('falls back to authorization header when cookie token is quoted bearer placeholder text', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: '"Bearer undefined"' }) },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-from-header' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-from-header')
  })

  it('falls back to authorization header when cookie token contains newline whitespace', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: 'Bearer%20token-cookie%0Awith-newline' }) },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-from-header' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-from-header')
  })

  it('falls back to authorization header when cookie token is too long', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const overlongToken = `Bearer ${'a'.repeat(4097)}`
    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: overlongToken }) },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-from-header' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-from-header')
  })

  it('falls back to authorization header when cookie token contains null-byte control char', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => ({ value: 'Bearer%20token-cookie%00injected' }) },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-from-header' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBe('Bearer token-from-header')
  })

  it('does not forward authorization header when bearer token contains null-byte control char', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-header%00injected' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not forward authorization header when bearer token contains double-encoded newline', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-header%250Ainjected' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not forward authorization header when bearer token contains triple-encoded newline', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-header%25250Ainjected' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not forward authorization header when bearer token contains quadruple-encoded newline', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-header%2525250Ainjected' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not forward authorization header when bearer token contains nonuple-encoded newline', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-header%25252525252525250Ainjected' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not forward authorization header when bearer token contains encoded unicode line separator', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-header%E2%80%A8injected' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not forward authorization header when bearer token contains encoded unicode next-line control char', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer token-header%C2%85injected' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('does not forward authorization header when bearer token is quoted placeholder text', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: (key: string) => (key === 'authorization' ? 'Bearer "undefined"' : null) },
    } as any

    await POST(request)

    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(fetchOptions.headers.Authorization).toBeUndefined()
  })

  it('returns 400 when message is blank after trim', async () => {
    process.env.NODE_ENV = 'test'
    global.fetch = jest.fn() as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: '   ' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('accepts message when trimmed length is exactly 1000', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const message = `  ${'a'.repeat(1000)}  `
    const request = {
      json: async () => ({ message }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const fetchOptions = fetchMock.mock.calls[0][1]
    expect(JSON.parse(fetchOptions.body).message.length).toBe(1000)
    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(true)
    expect(init).toBeUndefined()
  })

  it('accepts openclaw command when command payload length is exactly 1000', async () => {
    process.env.NODE_ENV = 'test'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { reply: 'ok' },
        timestamp: '2026-03-19T00:00:00.000Z',
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const message = `/openclaw ${'a'.repeat(1000)}`
    const request = {
      json: async () => ({ message }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const fetchOptions = fetchMock.mock.calls[0][1]
    const payload = JSON.parse(fetchOptions.body)
    expect(payload.message.length).toBe(1000)
    expect(payload.useOpenClaw).toBe(true)
    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(true)
    expect(init).toBeUndefined()
  })

  it('returns 400 when openclaw command has no payload', async () => {
    process.env.NODE_ENV = 'test'
    global.fetch = jest.fn() as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: '/openclaw' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('returns 400 when request json is invalid', async () => {
    process.env.NODE_ENV = 'test'
    global.fetch = jest.fn() as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('returns 400 when request json parsing throws type error', async () => {
    process.env.NODE_ENV = 'test'
    global.fetch = jest.fn() as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => {
        throw new TypeError('Body is unusable')
      },
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('returns 400 when request payload is null', async () => {
    process.env.NODE_ENV = 'test'
    global.fetch = jest.fn() as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => null,
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('returns 400 when runtimeModelId is not a string', async () => {
    process.env.NODE_ENV = 'test'
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', runtimeModelId: { id: 'gpt-5' } }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('returns 400 when runtimeModelId is blank after trim', async () => {
    process.env.NODE_ENV = 'test'
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', runtimeModelId: '   ' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('returns 400 when difficultyLevel is out of range', async () => {
    process.env.NODE_ENV = 'test'
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', difficultyLevel: 0 }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('returns 400 when sessionId is not a string', async () => {
    process.env.NODE_ENV = 'test'
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', sessionId: { id: 'session-1' } }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_BAD_REQUEST')
    expect(init?.status).toBe(400)
  })

  it('returns 500 when backend success response json is invalid', async () => {
    process.env.NODE_ENV = 'test'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token from backend')
      },
    }) as unknown as typeof fetch

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockJson).toHaveBeenCalledTimes(1)
    const [body, init] = mockJson.mock.calls[0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('CHAT_ERROR')
    expect(init?.status).toBe(500)
  })
})
