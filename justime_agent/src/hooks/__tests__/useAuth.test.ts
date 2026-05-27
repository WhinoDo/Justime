import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'

const mockFetch = jest.fn()
global.fetch = mockFetch

jest.useFakeTimers()

const mockUser = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  profile: { name: 'Test User' },
  isEmailVerified: true,
  role: 'user' as const,
}

describe('useAuth', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('初始化', () => {
    it('应该以加载状态开始', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useAuth())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    it('认证成功时应该设置用户信息', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { user: mockUser }
        }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockUser)
    })

    it('认证失败时应该保持未认证状态', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    it('令牌刷新成功时应该设置用户信息', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ success: false }),
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { user: mockUser }
        }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockUser)
    })
  })

  describe('login', () => {
    it('登录成功时应该更新状态', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      let loginResult: any
      await act(async () => {
        loginResult = await result.current.login({
          identifier: 'testuser',
          password: 'password123',
        })
      })

      expect(loginResult.success).toBe(true)
      expect(loginResult.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('登录失败时应该返回错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, message: '密码错误' }),
      } as unknown as Response)

      let loginResult: any
      await act(async () => {
        loginResult = await result.current.login({
          identifier: 'testuser',
          password: 'wrongpassword',
        })
      })

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toBe('密码错误')
    })

    it('登录时应该发送正确的请求', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      await act(async () => {
        await result.current.login({
          identifier: 'testuser',
          password: 'password123',
          rememberMe: true,
        })
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            identifier: 'testuser',
            password: 'password123',
            rememberMe: true,
          }),
        })
      )
    })
  })

  describe('register', () => {
    it('注册成功时应该更新状态', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      let registerResult: any
      await act(async () => {
        registerResult = await result.current.register({
          email: 'test@example.com',
          password: 'password123',
          username: 'testuser',
        })
      })

      expect(registerResult.success).toBe(true)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('注册失败时应该返回错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, message: '邮箱已存在' }),
      } as unknown as Response)

      let registerResult: any
      await act(async () => {
        registerResult = await result.current.register({
          email: 'existing@example.com',
          password: 'password123',
        })
      })

      expect(registerResult.success).toBe(false)
      expect(registerResult.error).toBe('邮箱已存在')
    })
  })

  describe('logout', () => {
    it('登出成功时应该清除用户状态', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as unknown as Response)

      let logoutResult: any
      await act(async () => {
        logoutResult = await result.current.logout()
      })

      expect(logoutResult.success).toBe(true)
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })
  })

  describe('forgotPassword', () => {
    it('发送重置链接成功', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: '重置链接已发送',
          data: { resetUrl: 'https://example.com/reset?token=abc' }
        }),
      } as unknown as Response)

      let forgotResult: any
      await act(async () => {
        forgotResult = await result.current.forgotPassword('test@example.com')
      })

      expect(forgotResult.success).toBe(true)
      expect(forgotResult.message).toBe('重置链接已发送')
    })

    it('发送重置链接失败', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, message: '邮箱不存在' }),
      } as unknown as Response)

      let forgotResult: any
      await act(async () => {
        forgotResult = await result.current.forgotPassword('nonexistent@example.com')
      })

      expect(forgotResult.success).toBe(false)
      expect(forgotResult.error).toBe('邮箱不存在')
    })
  })

  describe('resetPassword', () => {
    it('重置密码成功', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, message: '密码重置成功' }),
      } as unknown as Response)

      let resetResult: any
      await act(async () => {
        resetResult = await result.current.resetPassword('reset-token', 'newpassword123')
      })

      expect(resetResult.success).toBe(true)
    })
  })

  describe('updateUser', () => {
    it('应该更新用户信息', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      act(() => {
        result.current.updateUser({ displayName: 'New Name' })
      })

      expect(result.current.user?.displayName).toBe('New Name')
    })
  })

  describe('checkAuth', () => {
    it('手动检查认证状态', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      let user: any
      await act(async () => {
        user = await result.current.checkAuth()
      })

      expect(user).toEqual(mockUser)
    })
  })

  describe('validateTokenAlive', () => {
    it('认证后应该启动 token 验证定时器', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      expect(jest.getTimerCount()).toBeGreaterThan(0)
    })

    it('token 验证失败时应该尝试刷新', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      await act(async () => {
        jest.advanceTimersByTime(5 * 60 * 1000)
      })

      expect(result.current.isAuthenticated).toBe(true)
    })

    it('token 验证和刷新都失败时应该清除认证状态', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as unknown as Response)

      await act(async () => {
        jest.advanceTimersByTime(5 * 60 * 1000)
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
      })
    })
  })

  describe('refreshUser', () => {
    it('未认证时应该返回 null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let refreshResult: any
      await act(async () => {
        refreshResult = await result.current.refreshUser()
      })

      expect(refreshResult).toBeNull()
    })

    it('已认证时应该返回用户信息', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      let refreshResult: any
      await act(async () => {
        refreshResult = await result.current.refreshUser()
      })

      expect(refreshResult).toEqual(mockUser)
    })
  })

  describe('错误处理', () => {
    it('checkAuth 网络错误时应该清除认证状态', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('login 网络错误时应该返回错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      let loginResult: any
      await act(async () => {
        loginResult = await result.current.login({
          identifier: 'testuser',
          password: 'password123',
        })
      })

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toBe('登录时发生错误')
    })

    it('register 网络错误时应该返回错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      let registerResult: any
      await act(async () => {
        registerResult = await result.current.register({
          email: 'test@example.com',
          password: 'password123',
        })
      })

      expect(registerResult.success).toBe(false)
      expect(registerResult.error).toBe('注册时发生错误')
    })

    it('logout 网络错误时应该返回错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      let logoutResult: any
      await act(async () => {
        logoutResult = await result.current.logout()
      })

      expect(logoutResult.success).toBe(false)
      expect(logoutResult.error).toBe('登出时发生错误')
    })

    it('forgotPassword 网络错误时应该返回错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      let forgotResult: any
      await act(async () => {
        forgotResult = await result.current.forgotPassword('test@example.com')
      })

      expect(forgotResult.success).toBe(false)
      expect(forgotResult.error).toBe('发送请求时发生错误')
    })

    it('resetPassword 网络错误时应该返回错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      let resetResult: any
      await act(async () => {
        resetResult = await result.current.resetPassword('token', 'newpassword')
      })

      expect(resetResult.success).toBe(false)
      expect(resetResult.error).toBe('重置密码时发生错误')
    })

    it('resetPassword 失败时应该返回错误消息', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { user: mockUser } }),
      } as unknown as Response)

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, message: 'Token 无效' }),
      } as unknown as Response)

      let resetResult: any
      await act(async () => {
        resetResult = await result.current.resetPassword('invalid-token', 'newpassword')
      })

      expect(resetResult.success).toBe(false)
      expect(resetResult.error).toBe('Token 无效')
    })
  })
})
