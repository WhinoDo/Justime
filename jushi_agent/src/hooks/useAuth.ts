/**
 * 认证状态管理Hook
 */

import { useState, useEffect, useCallback } from 'react'
import { SafeUser, LoginData, RegisterData } from '@/types/auth'

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

  // 检查认证状态
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAuthState({
            user: data.data.user,
            isLoading: false,
            isAuthenticated: true
          })
          return data.data.user
        }
      }

      // 如果获取用户信息失败，尝试刷新令牌
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      })

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        if (refreshData.success) {
          setAuthState({
            user: refreshData.data.user,
            isLoading: false,
            isAuthenticated: true
          })
          return refreshData.data.user
        }
      }

      // 认证失败
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false
      })
      return null

    } catch (error) {
      console.error('检查认证状态失败:', error)
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false
      })
      return null
    }
  }, [])

  // 登录
  const login = useCallback(async (data: LoginData) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        setAuthState({
          user: result.data.user,
          isLoading: false,
          isAuthenticated: true
        })
        return { success: true, user: result.data.user }
      } else {
        return { success: false, error: result.error }
      }

    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, error: '登录时发生错误' }
    }
  }, [])

  // 注册
  const register = useCallback(async (data: RegisterData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
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
        return { success: false, error: result.error }
      }

    } catch (error) {
      console.error('注册失败:', error)
      return { success: false, error: '注册时发生错误' }
    }
  }, [])

  // 飞书登录
  const loginWithFeishu = useCallback(async (feishuUserInfo: {
    openId: string
    unionId?: string
    name: string
    avatar?: string
    email?: string
    mobile?: string
  }) => {
    try {
      const response = await fetch('/api/auth/feishu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(feishuUserInfo)
      })

      const result = await response.json()

      if (result.success) {
        setAuthState({
          user: result.data.user,
          isLoading: false,
          isAuthenticated: true
        })
        return { success: true, user: result.data.user }
      } else {
        return { success: false, error: result.error }
      }

    } catch (error) {
      console.error('飞书登录失败:', error)
      return { success: false, error: '飞书登录时发生错误' }
    }
  }, [])

  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
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

  // 初始化时检查认证状态
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return {
    // 状态
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    
    // 方法
    login,
    register,
    loginWithFeishu,
    logout,
    updateUser,
    refreshUser,
    checkAuth
  }
}
