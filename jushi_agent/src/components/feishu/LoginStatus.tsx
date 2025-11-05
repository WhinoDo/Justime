'use client'

import React, { useState, useEffect } from 'react'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'
import { Button } from '@/components/ui/button'

interface LoginStatusProps {
  onLoginChange?: (isLoggedIn: boolean) => void
}

export const LoginStatus: React.FC<LoginStatusProps> = ({ onLoginChange }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [tokenInfo, setTokenInfo] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkLoginStatus = async () => {
    setIsChecking(true)
    try {
      const loggedIn = FeishuTokenManager.isLoggedIn()
      const session = FeishuTokenManager.getLoginSession()
      const token = FeishuTokenManager.getTokenInfo()
      
      setIsLoggedIn(loggedIn)
      setUserInfo(session?.userInfo || null)
      setTokenInfo(token)
      
      onLoginChange?.(loggedIn)
      
      console.log('🔍 登录状态检查:', {
        isLoggedIn: loggedIn,
        hasUserInfo: !!session?.userInfo,
        hasToken: !!token?.accessToken,
        tokenExpiry: token?.expiresAt ? new Date(token.expiresAt).toISOString() : 'unknown'
      })
    } catch (error) {
      console.error('检查登录状态失败:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleRefreshToken = async () => {
    setIsChecking(true)
    try {
      console.log('🔄 手动刷新令牌...')
      const success = await FeishuTokenManager.refreshAccessToken()
      if (success) {
        console.log('✅ 令牌刷新成功')
        await checkLoginStatus()
      } else {
        console.log('❌ 令牌刷新失败')
        alert('令牌刷新失败，请重新登录')
      }
    } catch (error) {
      console.error('刷新令牌失败:', error)
      alert('刷新令牌失败，请重新登录')
    } finally {
      setIsChecking(false)
    }
  }

  const handleLogout = () => {
    FeishuTokenManager.clearTokens()
    setIsLoggedIn(false)
    setUserInfo(null)
    setTokenInfo(null)
    onLoginChange?.(false)
    console.log('🚪 用户已登出')

    // 刷新页面以确保状态完全更新
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const handleLogin = () => {
    FeishuLoginRedirect.redirectToLogin(false) // 不保存当前路径，因为这是状态组件
  }

  useEffect(() => {
    checkLoginStatus()
    
    // 每分钟检查一次登录状态
    const interval = setInterval(checkLoginStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const isTokenExpired = tokenInfo?.expiresAt && Date.now() >= tokenInfo.expiresAt
  const isTokenExpiringSoon = tokenInfo?.expiresAt && Date.now() >= (tokenInfo.expiresAt - 5 * 60 * 1000)

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">飞书登录状态</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkLoginStatus}
          disabled={isChecking}
          className="text-xs"
        >
          {isChecking ? '检查中...' : '刷新状态'}
        </Button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isLoggedIn ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className={isLoggedIn ? 'text-green-700' : 'text-red-700'}>
            {isLoggedIn ? '已登录' : '未登录'}
          </span>
        </div>

        {userInfo && (
          <div className="text-gray-600">
            <div>用户: {userInfo.name || userInfo.open_id}</div>
            {userInfo.avatar_url && (
              <img 
                src={userInfo.avatar_url} 
                alt="头像" 
                className="w-6 h-6 rounded-full mt-1"
              />
            )}
          </div>
        )}

        {tokenInfo && (
          <div className="text-xs text-gray-500 space-y-1">
            <div>令牌类型: {tokenInfo.tokenType || 'Bearer'}</div>
            <div>
              过期时间: {tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toLocaleString() : '未知'}
            </div>
            {isTokenExpired && (
              <div className="text-red-600 font-medium">⚠️ 令牌已过期</div>
            )}
            {isTokenExpiringSoon && !isTokenExpired && (
              <div className="text-yellow-600 font-medium">⚠️ 令牌即将过期</div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        {isLoggedIn ? (
          <>
            {(isTokenExpired || isTokenExpiringSoon) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshToken}
                disabled={isChecking}
                className="text-xs"
              >
                刷新令牌
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-red-600 hover:text-red-700"
            >
              登出
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleLogin}
            className="text-xs"
          >
            登录飞书
          </Button>
        )}
      </div>
    </div>
  )
}

export default LoginStatus
