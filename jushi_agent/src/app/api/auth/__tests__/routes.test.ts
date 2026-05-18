import { setNodeEnv } from '@/test-utils/env'

const mockJson = jest.fn()
const mockCookiesSet = jest.fn()

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (...args: unknown[]) => {
      mockJson(...args)
      return {
        cookies: { set: mockCookiesSet },
        headers: new Map(),
      }
    },
  },
}))

jest.mock('@/lib/api/config', () => ({
  API_CONFIG: {
    BASE_URL: 'http://backend.local',
    getFullUrl: (endpoint: string) => `http://backend.local/api/v1${endpoint}`,
  },
}))

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    json: async () => ({}),
    cookies: { get: () => undefined },
    headers: { get: () => null },
    nextUrl: { searchParams: { toString: () => '' } },
    ...overrides,
  } as any
}

describe('Auth API Routes', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetModules()
    mockJson.mockReset()
    mockCookiesSet.mockReset()
    setNodeEnv('test')
  })

  afterAll(() => {
    setNodeEnv(originalNodeEnv ?? 'test')
    global.fetch = originalFetch
  })

  describe('POST /api/auth/login', () => {
    it('returns 400 when identifier is missing', async () => {
      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({ json: async () => ({ password: 'pass123' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('identifier')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when password is missing', async () => {
      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({ json: async () => ({ identifier: 'user@test.com' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('password')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when both identifier and password are missing', async () => {
      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({ json: async () => ({}) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('identifier')
      expect(body.error).toContain('password')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when identifier is empty string', async () => {
      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({ json: async () => ({ identifier: '   ', password: 'pass123' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('identifier')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when password is empty string', async () => {
      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({ json: async () => ({ identifier: 'user@test.com', password: '   ' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('password')
      expect(init?.status).toBe(400)
    })

    it('forwards login request to backend with valid fields', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'access-tok', refreshToken: 'refresh-tok' },
          message: '登录成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => ({ identifier: 'user@test.com', password: 'pass123', rememberMe: true }),
      }))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('http://backend.local/api/v1/auth/login')
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body)
      expect(body.identifier).toBe('user@test.com')
      expect(body.password).toBe('pass123')
      expect(body.rememberMe).toBe(true)
    })

    it('defaults rememberMe to false when not provided', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'access-tok', refreshToken: 'refresh-tok' },
          message: '登录成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => ({ identifier: 'user@test.com', password: 'pass123' }),
      }))

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.rememberMe).toBe(false)
    })

    it('sets auth cookies on successful login', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'access-tok', refreshToken: 'refresh-tok' },
          message: '登录成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => ({ identifier: 'user@test.com', password: 'pass123', rememberMe: true }),
      }))

      const cookieCalls = mockCookiesSet.mock.calls.filter(
        (call: any[]) => call[0] === 'access_token' || call[0] === 'refresh-token'
      )
      expect(cookieCalls.length).toBe(2)
      const accessCookie = cookieCalls.find((c: any[]) => c[0] === 'access_token')
      const refreshCookie = cookieCalls.find((c: any[]) => c[0] === 'refresh-token')
      expect(accessCookie[1]).toBe('access-tok')
      expect(refreshCookie[1]).toBe('refresh-tok')
    })

    it('returns success response from backend', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'access-tok', user: { id: 1 } },
          message: '欢迎回来',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => ({ identifier: 'user@test.com', password: 'pass123' }),
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.success).toBe(true)
      expect(body.data.token).toBe('access-tok')
      expect(body.message).toBe('欢迎回来')
    })

    it('returns 401 when backend responds with invalid credentials', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: '用户名或密码错误' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => ({ identifier: 'user@test.com', password: 'wrong' }),
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('用户名或密码错误')
      expect(body.code).toBe('LOGIN_ERROR')
      expect(init?.status).toBe(401)
    })

    it('returns error with fallback message when backend provides no detail', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => ({ identifier: 'user@test.com', password: 'pass123' }),
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('登录失败')
      expect(body.code).toBe('LOGIN_ERROR')
      expect(init?.status).toBe(500)
    })

    it('returns error using backend error field when detail is absent', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Account locked' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => ({ identifier: 'user@test.com', password: 'pass123' }),
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.error).toBe('Account locked')
      expect(body.code).toBe('LOGIN_ERROR')
    })

    it('does not set auth cookies when backend response is not successful', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid credentials' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => ({ identifier: 'user@test.com', password: 'wrong' }),
      }))

      const cookieCalls = mockCookiesSet.mock.calls.filter(
        (call: any[]) => call[0] === 'access_token' || call[0] === 'refresh-token'
      )
      expect(cookieCalls.length).toBe(0)
    })

    it('returns 500 when request json is invalid', async () => {
      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => { throw new SyntaxError('Unexpected token') },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.code).toBe('INTERNAL_ERROR')
      expect(init?.status).toBe(500)
    })

    it('returns 500 with fallback message on non-Error throw', async () => {
      const { POST } = await import('@/app/api/auth/login/route')

      await POST(makeRequest({
        json: async () => { throw 'string error' },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('服务器内部错误')
      expect(body.code).toBe('INTERNAL_ERROR')
      expect(init?.status).toBe(500)
    })
  })

  describe('POST /api/auth/register', () => {
    it('forwards registration request to backend', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'access-tok', refreshToken: 'refresh-tok', user: { id: 1 } },
          message: '注册成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/register/route')

      await POST(makeRequest({
        json: async () => ({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        }),
      }))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('http://backend.local/api/v1/auth/register')
      const body = JSON.parse(options.body)
      expect(body.username).toBe('testuser')
      expect(body.email).toBe('test@example.com')
      expect(body.password).toBe('password123')
    })

    it('sets auth cookies on successful registration', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'access-tok', refreshToken: 'refresh-tok' },
          message: '注册成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/register/route')

      await POST(makeRequest({
        json: async () => ({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        }),
      }))

      const cookieCalls = mockCookiesSet.mock.calls.filter(
        (call: any[]) => call[0] === 'access_token' || call[0] === 'refresh-token'
      )
      expect(cookieCalls.length).toBe(2)
      const accessCookie = cookieCalls.find((c: any[]) => c[0] === 'access_token')
      const refreshCookie = cookieCalls.find((c: any[]) => c[0] === 'refresh-token')
      expect(accessCookie[1]).toBe('access-tok')
      expect(refreshCookie[1]).toBe('refresh-tok')
    })

    it('sets rememberMe to false in auth cookies on registration', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'access-tok', refreshToken: 'refresh-tok' },
          message: '注册成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/register/route')

      await POST(makeRequest({
        json: async () => ({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        }),
      }))

      const accessCookie = mockCookiesSet.mock.calls.find((c: any[]) => c[0] === 'access_token')
      expect(accessCookie).toBeDefined()
      expect(accessCookie[2].maxAge).toBe(7 * 24 * 60 * 60)
    })

    it('returns 409 when backend responds with duplicate user', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ detail: '用户名已存在' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/register/route')

      await POST(makeRequest({
        json: async () => ({
          username: 'existing',
          email: 'existing@example.com',
          password: 'password123',
        }),
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('用户名已存在')
      expect(body.code).toBe('REGISTER_ERROR')
      expect(init?.status).toBe(409)
    })

    it('returns error with fallback message when backend provides no detail', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/register/route')

      await POST(makeRequest({
        json: async () => ({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        }),
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('注册失败')
      expect(body.code).toBe('REGISTER_ERROR')
      expect(init?.status).toBe(400)
    })

    it('returns error using backend error field when detail is absent', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Validation failed' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/register/route')

      await POST(makeRequest({
        json: async () => ({
          username: 'testuser',
          email: 'bad-email',
          password: 'short',
        }),
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.error).toBe('Validation failed')
      expect(body.code).toBe('REGISTER_ERROR')
    })

    it('does not set auth cookies when backend response is not successful', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ detail: '用户名已存在' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/register/route')

      await POST(makeRequest({
        json: async () => ({
          username: 'existing',
          email: 'existing@example.com',
          password: 'password123',
        }),
      }))

      const cookieCalls = mockCookiesSet.mock.calls.filter(
        (call: any[]) => call[0] === 'access_token' || call[0] === 'refresh-token'
      )
      expect(cookieCalls.length).toBe(0)
    })

    it('returns 500 on internal error', async () => {
      const { POST } = await import('@/app/api/auth/register/route')

      await POST(makeRequest({
        json: async () => { throw new Error('Network failure') },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('Network failure')
      expect(body.code).toBe('INTERNAL_ERROR')
      expect(init?.status).toBe(500)
    })
  })

  describe('POST /api/auth/forgot-password', () => {
    it('returns 400 when email is missing', async () => {
      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({ json: async () => ({}) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('email')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when email is empty string', async () => {
      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({ json: async () => ({ email: '   ' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('email')
      expect(init?.status).toBe(400)
    })

    it('forwards forgot-password request to backend with valid email', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: '如果该邮箱已注册，您将收到密码重置邮件',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({ json: async () => ({ email: 'user@test.com' }) }))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('http://backend.local/api/v1/auth/forgot-password')
      const body = JSON.parse(options.body)
      expect(body.email).toBe('user@test.com')
    })

    it('returns success message from backend', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Reset email sent',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({ json: async () => ({ email: 'user@test.com' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.success).toBe(true)
      expect(body.message).toBe('Reset email sent')
    })

    it('returns default success message when backend omits message', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({ json: async () => ({ email: 'user@test.com' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.success).toBe(true)
      expect(body.message).toBe('如果该邮箱已注册，您将收到密码重置邮件')
    })

    it('returns error when backend responds with failure', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ detail: '请求过于频繁' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({ json: async () => ({ email: 'user@test.com' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('请求过于频繁')
      expect(body.code).toBe('FORGOT_PASSWORD_ERROR')
      expect(init?.status).toBe(429)
    })

    it('returns error with fallback message when backend provides no detail', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({ json: async () => ({ email: 'user@test.com' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('发送重置邮件失败')
      expect(body.code).toBe('FORGOT_PASSWORD_ERROR')
      expect(init?.status).toBe(500)
    })

    it('returns 500 on internal error', async () => {
      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({
        json: async () => { throw new Error('Parse failure') },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('Parse failure')
      expect(body.code).toBe('INTERNAL_ERROR')
      expect(init?.status).toBe(500)
    })

    it('does not forward to backend when email is missing', async () => {
      const fetchMock = jest.fn()
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/forgot-password/route')

      await POST(makeRequest({ json: async () => ({}) }))

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/auth/reset-password', () => {
    it('returns 400 when required fields are missing', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({}) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('token')
      expect(body.error).toContain('new_password')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when token is missing', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ new_password: 'newpassword123' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('token')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when new_password is missing', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'reset-token' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toContain('new_password')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when new_password is shorter than 8 characters', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'reset-token', new_password: 'short' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('密码至少需要8个字符')
      expect(body.code).toBe('VALIDATION_ERROR')
      expect(init?.status).toBe(400)
    })

    it('returns 400 when new_password is exactly 7 characters', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'reset-token', new_password: '1234567' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('密码至少需要8个字符')
      expect(init?.status).toBe(400)
    })

    it('does not forward to backend when password is too short', async () => {
      const fetchMock = jest.fn()
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'valid-token', new_password: 'abc' }) }))

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('forwards reset-password request with valid token and 8-char password', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: '密码重置成功，请使用新密码登录',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'valid-token', new_password: '12345678' }) }))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('http://backend.local/api/v1/auth/reset-password')
      const body = JSON.parse(options.body)
      expect(body.token).toBe('valid-token')
      expect(body.new_password).toBe('12345678')
    })

    it('returns success message from backend', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Password reset complete',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'valid-token', new_password: 'newpassword123' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.success).toBe(true)
      expect(body.message).toBe('Password reset complete')
    })

    it('returns default success message when backend omits message', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'valid-token', new_password: 'newpassword123' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.success).toBe(true)
      expect(body.message).toBe('密码重置成功，请使用新密码登录')
    })

    it('returns error when backend responds with invalid token', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: '重置令牌无效或已过期' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'bad-token', new_password: 'newpassword123' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('重置令牌无效或已过期')
      expect(body.code).toBe('RESET_PASSWORD_ERROR')
      expect(init?.status).toBe(400)
    })

    it('returns error with fallback message when backend provides no detail', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({ json: async () => ({ token: 'some-token', new_password: 'newpassword123' }) }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('重置密码失败')
      expect(body.code).toBe('RESET_PASSWORD_ERROR')
      expect(init?.status).toBe(500)
    })

    it('returns 500 on internal error', async () => {
      const { POST } = await import('@/app/api/auth/reset-password/route')

      await POST(makeRequest({
        json: async () => { throw new Error('Unexpected') },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('Unexpected')
      expect(body.code).toBe('INTERNAL_ERROR')
      expect(init?.status).toBe(500)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('forwards refresh token from cookie to backend', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'new-access-tok', refreshToken: 'new-refresh-tok' },
          message: '刷新成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => ({ value: 'stored-refresh-token' }) },
      }))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('http://backend.local/api/v1/auth/refresh')
      expect(options.headers.Cookie).toBe('refresh-token=stored-refresh-token')
      const body = JSON.parse(options.body)
      expect(body.refreshToken).toBe('stored-refresh-token')
    })

    it('sends empty cookie header when refresh token is missing', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'new-access-tok' },
          message: '刷新成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => undefined },
      }))

      const options = fetchMock.mock.calls[0][1]
      expect(options.headers.Cookie).toBe('')
      const body = JSON.parse(options.body)
      expect(body.refreshToken).toBeUndefined()
    })

    it('sets auth cookies on successful refresh', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'new-access-tok', refreshToken: 'new-refresh-tok' },
          message: '刷新成功',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => ({ value: 'stored-refresh-token' }) },
      }))

      const cookieCalls = mockCookiesSet.mock.calls.filter(
        (call: any[]) => call[0] === 'access_token' || call[0] === 'refresh-token'
      )
      expect(cookieCalls.length).toBe(2)
      const accessCookie = cookieCalls.find((c: any[]) => c[0] === 'access_token')
      const refreshCookie = cookieCalls.find((c: any[]) => c[0] === 'refresh-token')
      expect(accessCookie[1]).toBe('new-access-tok')
      expect(refreshCookie[1]).toBe('new-refresh-tok')
    })

    it('returns success response from backend', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'new-access-tok' },
          message: '令牌已刷新',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => ({ value: 'stored-refresh-token' }) },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.success).toBe(true)
      expect(body.data.token).toBe('new-access-tok')
      expect(body.message).toBe('令牌已刷新')
    })

    it('returns error when backend responds with expired token', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: '刷新令牌已过期' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => ({ value: 'expired-token' }) },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('刷新令牌已过期')
      expect(body.code).toBe('REFRESH_ERROR')
      expect(init?.status).toBe(401)
    })

    it('returns error with fallback message when backend provides no detail', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => ({ value: 'some-token' }) },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('刷新令牌失败')
      expect(body.code).toBe('REFRESH_ERROR')
      expect(init?.status).toBe(401)
    })

    it('returns error using backend error field when detail is absent', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Token revoked' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => ({ value: 'some-token' }) },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.error).toBe('Token revoked')
      expect(body.code).toBe('REFRESH_ERROR')
    })

    it('does not set auth cookies when backend response is not successful', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Token expired' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => ({ value: 'expired-token' }) },
      }))

      const cookieCalls = mockCookiesSet.mock.calls.filter(
        (call: any[]) => call[0] === 'access_token' || call[0] === 'refresh-token'
      )
      expect(cookieCalls.length).toBe(0)
    })

    it('returns 500 on internal error', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        throw new Error('Network down')
      }) as unknown as typeof fetch

      const { POST } = await import('@/app/api/auth/refresh/route')

      await POST(makeRequest({
        cookies: { get: () => undefined },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('Network down')
      expect(body.code).toBe('INTERNAL_ERROR')
      expect(init?.status).toBe(500)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('returns success response', async () => {
      const { POST } = await import('@/app/api/auth/logout/route')

      await POST(makeRequest())

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.success).toBe(true)
      expect(body.message).toBe('登出成功')
    })

    it('clears access_token and refresh-token cookies', async () => {
      const { POST } = await import('@/app/api/auth/logout/route')

      await POST(makeRequest())

      const cookieCalls = mockCookiesSet.mock.calls.filter(
        (call: any[]) => call[0] === 'access_token' || call[0] === 'refresh-token'
      )
      expect(cookieCalls.length).toBe(2)
      const accessCookie = cookieCalls.find((c: any[]) => c[0] === 'access_token')
      const refreshCookie = cookieCalls.find((c: any[]) => c[0] === 'refresh-token')
      expect(accessCookie[1]).toBe('')
      expect(accessCookie[2].maxAge).toBe(0)
      expect(refreshCookie[1]).toBe('')
      expect(refreshCookie[2].maxAge).toBe(0)
    })

    it('sets httpOnly and secure flags on cleared cookies', async () => {
      const { POST } = await import('@/app/api/auth/logout/route')

      await POST(makeRequest())

      const cookieCalls = mockCookiesSet.mock.calls.filter(
        (call: any[]) => call[0] === 'access_token' || call[0] === 'refresh-token'
      )
      for (const call of cookieCalls) {
        expect(call[2].httpOnly).toBe(true)
        expect(call[2].sameSite).toBe('lax')
        expect(call[2].path).toBe('/')
      }
    })

    it('returns 500 when clearAuthCookies throws', async () => {
      mockCookiesSet.mockImplementation(() => {
        throw new Error('Cookie failure')
      })

      const { POST } = await import('@/app/api/auth/logout/route')

      await POST(makeRequest())

      const lastCall = mockJson.mock.calls[mockJson.mock.calls.length - 1]
      const [body, init] = lastCall
      expect(body.success).toBe(false)
      expect(body.error).toBe('服务器内部错误')
      expect(init?.status).toBe(500)
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns 401 when no authorization header or cookie token', async () => {
      const { GET } = await import('@/app/api/auth/me/route')

      await GET(makeRequest({
        headers: { get: () => null },
        cookies: { get: () => undefined },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('请先登录')
      expect(body.code).toBe('AUTHENTICATION_ERROR')
      expect(init?.status).toBe(401)
    })

    it('forwards request to backend with authorization header', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { GET } = await import('@/app/api/auth/me/route')

      await GET(makeRequest({
        headers: { get: (key: string) => key === 'authorization' ? 'Bearer valid-token' : null },
        cookies: { get: () => undefined },
      }))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('http://backend.local/api/v1/auth/me')
      expect(options.method).toBe('GET')
      expect(options.headers.Authorization).toBe('Bearer valid-token')
    })

    it('returns user data from backend', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { GET } = await import('@/app/api/auth/me/route')

      await GET(makeRequest({
        headers: { get: (key: string) => key === 'authorization' ? 'Bearer valid-token' : null },
        cookies: { get: () => undefined },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body] = mockJson.mock.calls[0]
      expect(body.success).toBe(true)
      expect(body.message).toBe('获取用户信息成功')
    })

    it('uses access_token cookie when authorization header is absent', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 1, username: 'testuser' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { GET } = await import('@/app/api/auth/me/route')

      await GET(makeRequest({
        headers: { get: () => null },
        cookies: { get: (key: string) => key === 'access_token' ? { value: 'cookie-token' } : undefined },
      }))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const options = fetchMock.mock.calls[0][1]
      expect(options.headers.Authorization).toBe('Bearer cookie-token')
    })

    it('prefers authorization header over cookie token', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 1 }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { GET } = await import('@/app/api/auth/me/route')

      await GET(makeRequest({
        headers: { get: (key: string) => key === 'authorization' ? 'Bearer header-token' : null },
        cookies: { get: (key: string) => key === 'access_token' ? { value: 'cookie-token' } : undefined },
      }))

      const options = fetchMock.mock.calls[0][1]
      expect(options.headers.Authorization).toBe('Bearer header-token')
    })

    it('returns error when backend responds with failure', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ detail: 'Account suspended' }),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      const { GET } = await import('@/app/api/auth/me/route')

      await GET(makeRequest({
        headers: { get: (key: string) => key === 'authorization' ? 'Bearer valid-token' : null },
        cookies: { get: () => undefined },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('Account suspended')
      expect(body.code).toBe('FETCH_USER_ERROR')
      expect(init?.status).toBe(403)
    })

    it('returns 500 on internal error from proxyWithAuth', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        throw new Error('Connection refused')
      }) as unknown as typeof fetch

      const { GET } = await import('@/app/api/auth/me/route')

      await GET(makeRequest({
        headers: { get: (key: string) => key === 'authorization' ? 'Bearer valid-token' : null },
        cookies: { get: () => undefined },
      }))

      expect(mockJson).toHaveBeenCalledTimes(1)
      const [body, init] = mockJson.mock.calls[0]
      expect(body.success).toBe(false)
      expect(body.error).toBe('Connection refused')
      expect(body.code).toBe('INTERNAL_ERROR')
      expect(init?.status).toBe(500)
    })
  })
})
