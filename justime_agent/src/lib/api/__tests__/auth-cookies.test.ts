import { setAuthCookies, clearAuthCookies } from '../auth-cookies'
import { NextResponse } from 'next/server'

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn(() => ({
      cookies: {
        set: jest.fn(),
      },
    })),
  },
}))

describe('auth-cookies', () => {
  describe('setAuthCookies', () => {
    it('应该设置访问令牌', () => {
      const mockResponse = {
        cookies: {
          set: jest.fn(),
        },
      } as unknown as NextResponse

      setAuthCookies(mockResponse, {
        accessToken: 'test-access-token',
      })

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'access_token',
        'test-access-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      )
    })

    it('应该设置刷新令牌', () => {
      const mockResponse = {
        cookies: {
          set: jest.fn(),
        },
      } as unknown as NextResponse

      setAuthCookies(mockResponse, {
        refreshToken: 'test-refresh-token',
      })

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'refresh-token',
        'test-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      )
    })

    it('rememberMe 为 true 时应该设置更长的过期时间', () => {
      const mockResponse = {
        cookies: {
          set: jest.fn(),
        },
      } as unknown as NextResponse

      setAuthCookies(mockResponse, {
        accessToken: 'test-token',
        rememberMe: true,
      })

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'access_token',
        'test-token',
        expect.objectContaining({
          maxAge: 30 * 24 * 60 * 60,
        })
      )
    })

    it('没有 rememberMe 时应该使用默认过期时间', () => {
      const mockResponse = {
        cookies: {
          set: jest.fn(),
        },
      } as unknown as NextResponse

      setAuthCookies(mockResponse, {
        accessToken: 'test-token',
      })

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'access_token',
        'test-token',
        expect.objectContaining({
          maxAge: 7 * 24 * 60 * 60,
        })
      )
    })

    it('没有令牌时应该返回原响应', () => {
      const mockResponse = {
        cookies: {
          set: jest.fn(),
        },
      } as unknown as NextResponse

      const result = setAuthCookies(mockResponse, {})

      expect(result).toBe(mockResponse)
    })
  })

  describe('clearAuthCookies', () => {
    it('应该清除访问令牌', () => {
      const mockResponse = {
        cookies: {
          set: jest.fn(),
        },
      } as unknown as NextResponse

      clearAuthCookies(mockResponse)

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'access_token',
        '',
        expect.objectContaining({
          maxAge: 0,
        })
      )
    })

    it('应该清除刷新令牌', () => {
      const mockResponse = {
        cookies: {
          set: jest.fn(),
        },
      } as unknown as NextResponse

      clearAuthCookies(mockResponse)

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'refresh-token',
        '',
        expect.objectContaining({
          maxAge: 0,
        })
      )
    })
  })
})
