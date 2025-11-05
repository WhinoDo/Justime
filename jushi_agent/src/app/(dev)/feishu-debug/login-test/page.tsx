'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'
import { CheckCircle, XCircle, RefreshCw, LogIn, LogOut } from 'lucide-react'

export default function FeishuLoginTestPage() {
  const [loginStatus, setLoginStatus] = useState<{
    isLoggedIn: boolean
    userInfo: any
    tokenInfo: any
    error?: string
  }>({
    isLoggedIn: false,
    userInfo: null,
    tokenInfo: null
  })
  const [isChecking, setIsChecking] = useState(false)

  const checkLoginStatus = async () => {
    setIsChecking(true)
    try {
      const isLoggedIn = FeishuTokenManager.isLoggedIn()
      const session = FeishuTokenManager.getLoginSession()
      const tokenInfo = FeishuTokenManager.getTokenInfo()
      
      setLoginStatus({
        isLoggedIn,
        userInfo: session?.userInfo || null,
        tokenInfo,
        error: undefined
      })
      
      console.log('🔍 登录状态检查结果:', {
        isLoggedIn,
        hasUserInfo: !!session?.userInfo,
        hasToken: !!tokenInfo?.accessToken,
        tokenExpiry: tokenInfo?.expiresAt ? new Date(tokenInfo.expiresAt).toISOString() : 'unknown'
      })
    } catch (error) {
      console.error('检查登录状态失败:', error)
      setLoginStatus({
        isLoggedIn: false,
        userInfo: null,
        tokenInfo: null,
        error: error instanceof Error ? error.message : '检查失败'
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleLogin = () => {
    FeishuLoginRedirect.redirectToLogin(false)
  }

  const handleLogout = () => {
    FeishuTokenManager.clearTokens()
    setLoginStatus({
      isLoggedIn: false,
      userInfo: null,
      tokenInfo: null
    })
  }

  const clearProcessedCodes = () => {
    localStorage.removeItem('feishu_processed_codes')
    localStorage.removeItem('feishu_login_status')
    localStorage.removeItem('feishu_login_complete')
    alert('已清理授权码缓存')
  }

  useEffect(() => {
    checkLoginStatus()

    // 监听登录状态变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feishu_login_status' || e.key === 'feishu_login_complete') {
        console.log('🔄 检测到登录状态变化')
        checkLoginStatus()
      }
    }

    const handleLoginSuccess = () => {
      console.log('🎉 收到登录成功事件')
      checkLoginStatus()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('feishu-login-success', handleLoginSuccess)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('feishu-login-success', handleLoginSuccess)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              飞书登录状态测试
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button onClick={checkLoginStatus} disabled={isChecking}>
                {isChecking ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                刷新状态
              </Button>
              
              {loginStatus.isLoggedIn ? (
                <Button onClick={handleLogout} variant="outline">
                  <LogOut className="h-4 w-4 mr-2" />
                  退出登录
                </Button>
              ) : (
                <Button onClick={handleLogin}>
                  <LogIn className="h-4 w-4 mr-2" />
                  飞书登录
                </Button>
              )}

              <Button onClick={clearProcessedCodes} variant="outline" size="sm">
                清理缓存
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span>登录状态:</span>
              {loginStatus.isLoggedIn ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  已登录
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  未登录
                </Badge>
              )}
            </div>

            {loginStatus.error && (
              <Alert variant="destructive">
                <AlertDescription>{loginStatus.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {loginStatus.userInfo && (
          <Card>
            <CardHeader>
              <CardTitle>用户信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">用户名:</span> {loginStatus.userInfo.name || '未知'}
                </div>
                <div>
                  <span className="font-medium">Open ID:</span> {loginStatus.userInfo.open_id || loginStatus.userInfo.openId || '未知'}
                </div>
                <div>
                  <span className="font-medium">User ID:</span> {loginStatus.userInfo.user_id || loginStatus.userInfo.userId || '未知'}
                </div>
                <div>
                  <span className="font-medium">邮箱:</span> {loginStatus.userInfo.email || '未知'}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loginStatus.tokenInfo && (
          <Card>
            <CardHeader>
              <CardTitle>令牌信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">令牌类型:</span> {loginStatus.tokenInfo.tokenType || '未知'}
                </div>
                <div>
                  <span className="font-medium">有效期:</span> {loginStatus.tokenInfo.expiresIn ? `${loginStatus.tokenInfo.expiresIn} 秒` : '未知'}
                </div>
                <div>
                  <span className="font-medium">过期时间:</span> {
                    loginStatus.tokenInfo.expiresAt 
                      ? new Date(loginStatus.tokenInfo.expiresAt).toLocaleString('zh-CN')
                      : '未知'
                  }
                </div>
                <div>
                  <span className="font-medium">是否过期:</span> {
                    loginStatus.tokenInfo.expiresAt 
                      ? (Date.now() >= loginStatus.tokenInfo.expiresAt ? '是' : '否')
                      : '未知'
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>调试信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              <div>当前时间: {new Date().toLocaleString('zh-CN')}</div>
              <div>页面URL: {typeof window !== 'undefined' ? window.location.href : '服务端渲染'}</div>
              <div>localStorage可用: {typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? '是' : '否'}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
