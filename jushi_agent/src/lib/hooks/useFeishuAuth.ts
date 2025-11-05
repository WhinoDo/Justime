'use client'

import { useState, useEffect } from 'react'

interface TokenInfo {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

interface UserInfo {
  name: string
  openId: string
  userId: string
  tenantKey: string
  avatarUrl: string
  email?: string
  mobile?: string
}

interface FeishuAuthState {
  isAuthenticated: boolean
  isLoading: boolean
  tokenInfo: TokenInfo | null
  userInfo: UserInfo | null
  error: string | null
}

export function useFeishuAuth() {
  const [authState, setAuthState] = useState<FeishuAuthState>({
    isAuthenticated: false,
    isLoading: true,
    tokenInfo: null,
    userInfo: null,
    error: null
  })

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = () => {
    try {
      const tokenInfoStr = localStorage.getItem('feishu_token_info')
      const userInfoStr = localStorage.getItem('feishu_user_info')

      if (tokenInfoStr && userInfoStr) {
        const tokenInfo = JSON.parse(tokenInfoStr) as TokenInfo
        const userInfo = JSON.parse(userInfoStr) as UserInfo

        // 检查token是否过期（简单检查，实际应该验证服务端）
        const isTokenValid = tokenInfo.accessToken && tokenInfo.expiresIn > 0

        setAuthState({
          isAuthenticated: isTokenValid,
          isLoading: false,
          tokenInfo: isTokenValid ? tokenInfo : null,
          userInfo: isTokenValid ? userInfo : null,
          error: null
        })
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          tokenInfo: null,
          userInfo: null,
          error: null
        })
      }
    } catch (error) {
      console.error('检查认证状态失败:', error)
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        tokenInfo: null,
        userInfo: null,
        error: '认证状态检查失败'
      })
    }
  }

  const login = (tokenInfo: TokenInfo, userInfo: UserInfo) => {
    try {
      localStorage.setItem('feishu_token_info', JSON.stringify(tokenInfo))
      localStorage.setItem('feishu_user_info', JSON.stringify(userInfo))
      
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        tokenInfo,
        userInfo,
        error: null
      })
    } catch (error) {
      console.error('登录失败:', error)
      setAuthState(prev => ({
        ...prev,
        error: '登录失败'
      }))
    }
  }

  const logout = () => {
    try {
      localStorage.removeItem('feishu_token_info')
      localStorage.removeItem('feishu_user_info')
      localStorage.removeItem('feishu_return_url')
      
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        tokenInfo: null,
        userInfo: null,
        error: null
      })
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  const refreshAuth = async () => {
    if (!authState.tokenInfo?.refreshToken) {
      logout()
      return false
    }

    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))

      const response = await fetch('/api/feishu/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: authState.tokenInfo.refreshToken
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '刷新token失败')
      }

      const newTokenInfo = data.data.tokenInfo
      const newUserInfo = data.data.userInfo || authState.userInfo

      login(newTokenInfo, newUserInfo!)
      return true

    } catch (error) {
      console.error('刷新认证失败:', error)
      logout()
      return false
    }
  }

  const setReturnUrl = (url: string) => {
    localStorage.setItem('feishu_return_url', url)
  }

  const getReturnUrl = () => {
    return localStorage.getItem('feishu_return_url') || '/dashboard'
  }

  return {
    ...authState,
    login,
    logout,
    refreshAuth,
    checkAuthStatus,
    setReturnUrl,
    getReturnUrl
  }
}
