'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

interface FeishuLoginContextType {
  isLoggedIn: boolean
  isLoading: boolean
  userInfo: any | null
  tokenInfo: any | null
  login: (saveCurrentPath?: boolean) => void
  logout: () => void
  requireLogin: (message?: string) => boolean
  checkLogin: () => Promise<void>
}

const FeishuLoginContext = createContext<FeishuLoginContextType | undefined>(undefined)

export const useFeishuLoginContext = () => {
  const context = useContext(FeishuLoginContext)
  if (context === undefined) {
    throw new Error('useFeishuLoginContext must be used within a FeishuLoginProvider')
  }
  return context
}

interface FeishuLoginProviderProps {
  children: React.ReactNode
}

export const FeishuLoginProvider: React.FC<FeishuLoginProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [tokenInfo, setTokenInfo] = useState<any>(null)

  const checkLogin = async () => {
    setIsLoading(true)
    try {
      const loggedIn = FeishuTokenManager.isLoggedIn()
      const session = FeishuTokenManager.getLoginSession()
      const token = FeishuTokenManager.getTokenInfo()
      
      setIsLoggedIn(loggedIn)
      setUserInfo(session?.userInfo || null)
      setTokenInfo(token)
      
      console.log('🔍 全局登录状态检查:', {
        isLoggedIn: loggedIn,
        hasUserInfo: !!session?.userInfo,
        hasToken: !!token?.accessToken,
        tokenExpiry: token?.expiresAt ? new Date(token.expiresAt).toISOString() : 'unknown'
      })
    } catch (error) {
      console.error('检查登录状态失败:', error)
      setIsLoggedIn(false)
      setUserInfo(null)
      setTokenInfo(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = (saveCurrentPath: boolean = true) => {
    FeishuLoginRedirect.redirectToLogin(saveCurrentPath)
  }

  const logout = () => {
    FeishuTokenManager.clearTokens()
    setIsLoggedIn(false)
    setUserInfo(null)
    setTokenInfo(null)
    console.log('🚪 全局用户已登出')

    // 延迟刷新页面，给状态更新一些时间
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const requireLogin = (message: string = '请先登录飞书账号'): boolean => {
    if (!isLoggedIn) {
      FeishuLoginRedirect.showLoginPrompt(message)
      return false
    }
    return true
  }

  useEffect(() => {
    checkLogin()

    // 监听存储变化事件，实时更新登录状态
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feishu_login_status' || e.key === 'feishu_login_complete') {
        console.log('🔄 全局Provider检测到登录状态变化，重新检查登录状态')
        checkLogin()
      }
    }

    // 监听自定义登录成功事件
    const handleLoginSuccess = (e: CustomEvent) => {
      console.log('🎉 全局Provider收到登录成功事件，更新状态')
      checkLogin()
    }

    // 添加事件监听器
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('feishu-login-success', handleLoginSuccess as EventListener)

    // 每分钟检查一次登录状态
    const interval = setInterval(checkLogin, 60000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('feishu-login-success', handleLoginSuccess as EventListener)
    }
  }, [])

  // 监听 storage 事件，当其他标签页登录/登出时同步状态
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feishu_session' || e.key === 'feishu_token') {
        console.log('🔄 检测到其他标签页的登录状态变化，重新检查全局登录状态')
        checkLogin()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      return () => window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // 监听页面可见性变化，当页面重新可见时检查登录状态
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 页面重新可见，检查登录状态')
        checkLogin()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const value: FeishuLoginContextType = {
    isLoggedIn,
    isLoading,
    userInfo,
    tokenInfo,
    login,
    logout,
    requireLogin,
    checkLogin
  }

  return (
    <FeishuLoginContext.Provider value={value}>
      {children}
    </FeishuLoginContext.Provider>
  )
}

// 导出 hook 以便在组件中使用
export { useFeishuLogin } from '@/hooks/useFeishuLogin'
