import { middleware } from '@/middleware'
import type { NextRequest } from 'next/server'
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util'

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder as any
  globalThis.TextDecoder = NodeTextDecoder as any
}

const mockCookiesDelete = jest.fn()
const mockRedirectResponse = {
  cookies: {
    delete: mockCookiesDelete,
  },
}

const mockRedirect = jest.fn().mockReturnValue(mockRedirectResponse)
const mockNext = jest.fn().mockReturnValue({})

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (...args: unknown[]) => mockRedirect(...args),
    next: (...args: unknown[]) => mockNext(...args),
  },
}))

const mockJwtVerify = jest.fn()
const mockDecodeJwt = jest.fn()

jest.mock('jose', () => ({
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
  decodeJwt: (...args: unknown[]) => mockDecodeJwt(...args),
}))

function createMockRequest(
  pathname: string,
  options: { token?: string; searchParams?: Record<string, string> } = {}
) {
  const url = `http://localhost:3000${pathname}`
  const searchParams = new URLSearchParams(options.searchParams || {})
  const fullUrl = searchParams.toString() ? `${url}?${searchParams.toString()}` : url

  return {
    url: fullUrl,
    nextUrl: {
      pathname,
      searchParams,
      search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    },
    cookies: {
      get: (name: string) => {
        if (name === 'access_token' && options.token != null) {
          return { value: options.token }
        }
        return undefined
      },
    },
  } as unknown as NextRequest
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600
}

function pastExp(): number {
  return Math.floor(Date.now() / 1000) - 3600
}

describe('middleware', () => {
  beforeEach(() => {
    mockRedirect.mockReset()
    mockNext.mockReset()
    mockCookiesDelete.mockReset()
    mockJwtVerify.mockReset()
    mockDecodeJwt.mockReset()
    mockRedirect.mockReturnValue(mockRedirectResponse)
    process.env.JWT_SECRET = 'test-secret'
  })

  afterEach(() => {
    delete process.env.JWT_SECRET
  })

  describe('public routes without auth', () => {
    it('allows access to /auth without token', async () => {
      const req = createMockRequest('/auth')
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('allows access to /auth/login without token', async () => {
      const req = createMockRequest('/auth/login')
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('allows access to /auth/register without token', async () => {
      const req = createMockRequest('/auth/register')
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('allows access to /auth/forgot-password without token', async () => {
      const req = createMockRequest('/auth/forgot-password')
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('allows access to unmatched routes without token', async () => {
      const req = createMockRequest('/about')
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('allows access to root path without token', async () => {
      const req = createMockRequest('/')
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })

  describe('protected routes without token', () => {
    it.each(['/dashboard', '/chat', '/admin', '/profile', '/knowledge', '/calendar', '/model-config'])(
      'redirects %s to login without token',
      async (pathname) => {
        const req = createMockRequest(pathname)
        await middleware(req)
        expect(mockRedirect).toHaveBeenCalledTimes(1)
        const redirectUrl = mockRedirect.mock.calls[0][0] as URL
        expect(redirectUrl.pathname).toBe('/auth')
        expect(redirectUrl.searchParams.get('mode')).toBe('login')
        expect(redirectUrl.searchParams.get('redirect')).toBe(pathname)
      }
    )

    it('includes query params in redirect path', async () => {
      const req = createMockRequest('/dashboard', { searchParams: { tab: 'settings' } })
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard?tab=settings')
    })

    it('handles sub-routes of protected routes', async () => {
      const req = createMockRequest('/dashboard/settings')
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard/settings')
    })

    it('handles deep sub-routes of /chat', async () => {
      const req = createMockRequest('/chat/session/123')
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.searchParams.get('redirect')).toBe('/chat/session/123')
    })

    it('does not delete cookies when redirecting without token', async () => {
      const req = createMockRequest('/dashboard')
      await middleware(req)
      expect(mockCookiesDelete).not.toHaveBeenCalled()
    })
  })

  describe('protected routes with valid token', () => {
    beforeEach(() => {
      mockDecodeJwt.mockReturnValue({ exp: futureExp() })
      mockJwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } })
    })

    it('allows access to /dashboard with valid token', async () => {
      const req = createMockRequest('/dashboard', { token: 'valid-token' })
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('allows access to all protected routes with valid token', async () => {
      const routes = ['/dashboard', '/chat', '/admin', '/profile', '/knowledge', '/calendar', '/model-config']
      for (const route of routes) {
        mockNext.mockClear()
        mockRedirect.mockClear()
        const req = createMockRequest(route, { token: 'valid-token' })
        await middleware(req)
        expect(mockNext).toHaveBeenCalled()
        expect(mockRedirect).not.toHaveBeenCalled()
      }
    })

    it('allows access to sub-routes with valid token', async () => {
      const req = createMockRequest('/dashboard/settings', { token: 'valid-token' })
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('expired tokens on protected routes', () => {
    beforeEach(() => {
      mockDecodeJwt.mockReturnValue({ exp: pastExp() })
    })

    it('redirects to login when token is expired', async () => {
      const req = createMockRequest('/dashboard', { token: 'expired-token' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalledTimes(1)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/auth')
      expect(redirectUrl.searchParams.get('mode')).toBe('login')
    })

    it('deletes access_token and refresh-token cookies on expired token', async () => {
      const req = createMockRequest('/dashboard', { token: 'expired-token' })
      await middleware(req)
      expect(mockCookiesDelete).toHaveBeenCalledWith('access_token')
      expect(mockCookiesDelete).toHaveBeenCalledWith('refresh-token')
    })

    it('does not include redirect param in expired token redirect', async () => {
      const req = createMockRequest('/dashboard', { token: 'expired-token' })
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.searchParams.get('redirect')).toBeNull()
    })

    it('skips jwtVerify when token is already expired', async () => {
      const req = createMockRequest('/dashboard', { token: 'expired-token' })
      await middleware(req)
      expect(mockJwtVerify).not.toHaveBeenCalled()
    })
  })

  describe('invalid tokens on protected routes (JWT verification fails)', () => {
    beforeEach(() => {
      mockDecodeJwt.mockReturnValue({ exp: futureExp() })
      mockJwtVerify.mockRejectedValue(new Error('Invalid signature'))
    })

    it('redirects to login when token fails verification', async () => {
      const req = createMockRequest('/dashboard', { token: 'invalid-token' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalledTimes(1)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/auth')
      expect(redirectUrl.searchParams.get('mode')).toBe('login')
    })

    it('deletes cookies when token fails verification', async () => {
      const req = createMockRequest('/dashboard', { token: 'invalid-token' })
      await middleware(req)
      expect(mockCookiesDelete).toHaveBeenCalledWith('access_token')
      expect(mockCookiesDelete).toHaveBeenCalledWith('refresh-token')
    })

    it('deletes cookies for all protected routes when token is invalid', async () => {
      const req = createMockRequest('/admin', { token: 'invalid-token' })
      await middleware(req)
      expect(mockCookiesDelete).toHaveBeenCalledWith('access_token')
      expect(mockCookiesDelete).toHaveBeenCalledWith('refresh-token')
    })
  })

  describe('public-only routes with valid token (redirect away)', () => {
    beforeEach(() => {
      mockDecodeJwt.mockReturnValue({ exp: futureExp() })
      mockJwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } })
    })

    it('redirects authenticated users away from /auth to /dashboard', async () => {
      const req = createMockRequest('/auth', { token: 'valid-token' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalledTimes(1)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/dashboard')
    })

    it('redirects to specified redirect path when valid', async () => {
      const req = createMockRequest('/auth', { token: 'valid-token', searchParams: { redirect: '/chat' } })
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/chat')
    })

    it('redirects to /dashboard when redirect path is //evil.com (open redirect prevention)', async () => {
      const req = createMockRequest('/auth', { token: 'valid-token', searchParams: { redirect: '//evil.com' } })
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/dashboard')
    })

    it('redirects to /dashboard when redirect path is a full URL (open redirect prevention)', async () => {
      const req = createMockRequest('/auth', { token: 'valid-token', searchParams: { redirect: 'https://evil.com' } })
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/dashboard')
    })

    it('redirects to /dashboard when redirect param is absent', async () => {
      const req = createMockRequest('/auth', { token: 'valid-token' })
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/dashboard')
    })

    it('redirects to /dashboard when redirect param is empty string', async () => {
      const req = createMockRequest('/auth', { token: 'valid-token', searchParams: { redirect: '' } })
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/dashboard')
    })

    it('allows redirect to /knowledge sub-route', async () => {
      const req = createMockRequest('/auth', { token: 'valid-token', searchParams: { redirect: '/knowledge/docs' } })
      await middleware(req)
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.pathname).toBe('/knowledge/docs')
    })
  })

  describe('public-only routes with invalid/expired token (stay on page)', () => {
    it('allows access to /auth with expired token', async () => {
      mockDecodeJwt.mockReturnValue({ exp: pastExp() })
      const req = createMockRequest('/auth', { token: 'expired-token' })
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('allows access to /auth with token that fails verification', async () => {
      mockDecodeJwt.mockReturnValue({ exp: futureExp() })
      mockJwtVerify.mockRejectedValue(new Error('Invalid'))
      const req = createMockRequest('/auth', { token: 'invalid-token' })
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })

  describe('malformed tokens', () => {
    it('treats token that cannot be decoded as expired and redirects', async () => {
      mockDecodeJwt.mockImplementation(() => {
        throw new Error('Invalid token')
      })
      const req = createMockRequest('/dashboard', { token: 'not-a-jwt' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
      expect(mockCookiesDelete).toHaveBeenCalledWith('access_token')
      expect(mockCookiesDelete).toHaveBeenCalledWith('refresh-token')
    })

    it('treats token with missing exp claim as expired', async () => {
      mockDecodeJwt.mockReturnValue({ sub: 'user1' })
      const req = createMockRequest('/dashboard', { token: 'token-without-exp' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
      expect(mockCookiesDelete).toHaveBeenCalledWith('access_token')
    })

    it('handles empty string token as no token', async () => {
      const req = createMockRequest('/dashboard', { token: '' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
      const redirectUrl = mockRedirect.mock.calls[0][0] as URL
      expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard')
      expect(mockCookiesDelete).not.toHaveBeenCalled()
    })
  })

  describe('missing JWT_SECRET', () => {
    it('rejects valid-looking token when JWT_SECRET is not configured', async () => {
      delete process.env.JWT_SECRET
      mockDecodeJwt.mockReturnValue({ exp: futureExp() })
      mockJwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } })
      const req = createMockRequest('/dashboard', { token: 'valid-token' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
      expect(mockCookiesDelete).toHaveBeenCalledWith('access_token')
    })
  })

  describe('route matching', () => {
    it('matches /dashboard exactly', async () => {
      const req = createMockRequest('/dashboard')
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
    })

    it('matches /dashboard/settings as sub-route', async () => {
      const req = createMockRequest('/dashboard/settings')
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
    })

    it('matches /auth exactly as public-only', async () => {
      mockDecodeJwt.mockReturnValue({ exp: futureExp() })
      mockJwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } })
      const req = createMockRequest('/auth', { token: 'valid-token' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
    })

    it('matches /auth/login as sub-route of public-only', async () => {
      mockDecodeJwt.mockReturnValue({ exp: futureExp() })
      mockJwtVerify.mockResolvedValue({ payload: { sub: 'user-1' } })
      const req = createMockRequest('/auth/login', { token: 'valid-token' })
      await middleware(req)
      expect(mockRedirect).toHaveBeenCalled()
    })

    it('does not match /dashboardx as /dashboard sub-route', async () => {
      const req = createMockRequest('/dashboardx')
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('does not match /authentication as /auth sub-route', async () => {
      const req = createMockRequest('/authentication')
      await middleware(req)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })
})
