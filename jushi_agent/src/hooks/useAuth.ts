/**
 * 认证状态管理Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SafeUser, LoginData, RegisterData } from '@/types/auth'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

const TOKEN_VALIDATE_INTERVAL = 5 * 60 * 1000

export interface AuthState {
  user: SafeUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false
  })
  const validateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAuthState = useCallback(() => {
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false
    })
  }, [])

  const setAuthenticated = useCallback((user: SafeUser) => {
    setAuthState({
      user,
      isLoading: false,
      isAuthenticated: true
    })
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.ME, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.user) {
          setAuthenticated(data.data.user)
          return data.data.user
        }
      }

      if (response.status === 401) {
        const refreshResponse = await fetch(API_ENDPOINTS.AUTH.REFRESH, {
          method: 'POST',
          credentials: 'include'
        })

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          if (refreshData.success && refreshData.data?.user) {
            setAuthenticated(refreshData.data.user)
            return refreshData.data.user
          }
        }

        clearAuthState()
        return null
      }

      clearAuthState()
      return null

    } catch (error) {
      console.error('检查认证状态失败:', error)
      clearAuthState()
      return null
    }
  }, [setAuthenticated, clearAuthState])

  const validateTokenAlive = useCallback(async () => {
    if (!authState.isAuthenticated) return
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.ME, {
        credentials: 'include'
      })
      if (!response.ok) {
        const refreshResponse = await fetch(API_ENDPOINTS.AUTH.REFRESH, {
          method: 'POST',
          credentials: 'include'
        })
        if (!refreshResponse.ok) {
          clearAuthState()
        }
      }
    } catch {
      // network error, don't logout
    }
  }, [authState.isAuthenticated, clearAuthState])

  // 登录
  const login = useCallback(async (data: LoginData) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success && result.data) {
        setAuthState({
          user: result.data.user,
          isLoading: false,
          isAuthenticated: true
        })
        return { success: true, user: result.data.user }
      } else {
        return { success: false, error: result.message || result.error || '登录失败' }
      }

    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, error: '登录时发生错误' }
    }
  }, [])

  // 注册
  const register = useCallback(async (data: RegisterData) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success && result.data) {
        setAuthState({
          user: result.data.user,
          isLoading: false,
          isAuthenticated: true
        })
        return {
          success: true,
          user: result.data.user,
          needsVerification: result.data.user.needsVerification
        }
      } else {
        return { success: false, error: result.message || result.error || '注册失败' }
      }

    } catch (error) {
      console.error('注册失败:', error)
      return { success: false, error: '注册时发生错误' }
    }
  }, [])



  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch(API_ENDPOINTS.AUTH.LOGOUT, {
        method: 'POST',
        credentials: 'include'
      })

      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false
      })

      return { success: true }

    } catch (error) {
      console.error('登出失败:', error)
      return { success: false, error: '登出时发生错误' }
    }
  }, [])

  // 忘记密码
  const forgotPassword = useCallback(async (email: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email })
      })

      const result = await response.json()

      if (result.success) {
        return {
          success: true,
          message: result.message,
          resetLink: result.data?.resetUrl
        }
      } else {
        return { success: false, error: result.message || result.detail || '发送重置链接失败' }
      }
    } catch (error) {
      console.error('忘记密码请求失败:', error)
      return { success: false, error: '发送请求时发生错误' }
    }
  }, [])

  // 重置密码
  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ token, new_password: newPassword })
      })

      const result = await response.json()

      if (result.success) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: result.message || result.detail || '密码重置失败' }
      }
    } catch (error) {
      console.error('重置密码请求失败:', error)
      return { success: false, error: '重置密码时发生错误' }
    }
  }, [])

  // 更新用户信息
  const updateUser = useCallback((updatedUser: Partial<SafeUser>) => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updatedUser } : null
    }))
  }, [])

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    if (!authState.isAuthenticated) return null
    return await checkAuth()
  }, [authState.isAuthenticated, checkAuth])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (authState.isAuthenticated) {
      validateTimerRef.current = setInterval(validateTokenAlive, TOKEN_VALIDATE_INTERVAL)
    }
    return () => {
      if (validateTimerRef.current) {
        clearInterval(validateTimerRef.current)
        validateTimerRef.current = null
      }
    }
  }, [authState.isAuthenticated, validateTokenAlive])

  return {
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateUser,
    refreshUser,
    checkAuth
  }
}
