'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Eye, EyeOff, Trash2 } from 'lucide-react'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { StaticTime } from '@/components/ui/ClientTime'

export function TokenDebugger() {
  const [tokenInfo, setTokenInfo] = useState<any>(null)
  const [showTokens, setShowTokens] = useState(false)
  const [lastCheck, setLastCheck] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  const refreshTokenInfo = () => {
    if (typeof window === 'undefined' || !mounted) return

    try {
      const session = FeishuTokenManager.getLoginSession()
      const isLoggedIn = FeishuTokenManager.isLoggedIn()
      const validToken = FeishuTokenManager.getValidAccessToken()

      setTokenInfo({
        session,
        isLoggedIn,
        validToken: validToken ? validToken.slice(0, 20) + '...' : null,
        localStorage: {
          session: localStorage.getItem('feishu_login_session'),
          tokenInfo: localStorage.getItem('feishu_token_info'),
          userInfo: localStorage.getItem('feishu_user_info'),
          timestamp: localStorage.getItem('feishu_login_timestamp')
        }
      })

      setLastCheck(new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Token 调试失败:', error)
      setTokenInfo({ error: error instanceof Error ? error.message : '未知错误' })
    }
  }

  const clearTokens = () => {
    FeishuTokenManager.clearLoginSession()
    refreshTokenInfo()
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      refreshTokenInfo()

      // 定期刷新
      const interval = setInterval(refreshTokenInfo, 5000)

      return () => clearInterval(interval)
    }
  }, [mounted])

  const maskToken = (token: string) => {
    if (!token) return 'N/A'
    if (!showTokens) return token.slice(0, 10) + '...'
    return token
  }

  // 在组件挂载前显示加载状态
  if (!mounted) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>🔍 Token 调试器</CardTitle>
          <CardDescription>正在加载...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🔍 Token 调试器</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTokens(!showTokens)}
            >
              {showTokens ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshTokenInfo}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearTokens}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          最后检查: {lastCheck}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tokenInfo?.error ? (
          <div className="text-red-600 bg-red-50 p-3 rounded">
            错误: {tokenInfo.error}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span>登录状态:</span>
              <Badge variant={tokenInfo?.isLoggedIn ? "default" : "destructive"}>
                {tokenInfo?.isLoggedIn ? "已登录" : "未登录"}
              </Badge>
            </div>

            {tokenInfo?.session && (
              <div className="space-y-2">
                <h4 className="font-medium">用户信息:</h4>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p><strong>姓名:</strong> {tokenInfo.session.userInfo?.name || 'N/A'}</p>
                  <p><strong>Open ID:</strong> {maskToken(tokenInfo.session.userInfo?.openId || '')}</p>
                  <p><strong>登录时间:</strong> {new Date(tokenInfo.session.loginTimestamp).toLocaleString()}</p>
                </div>
              </div>
            )}

            {tokenInfo?.session?.tokenInfo && (
              <div className="space-y-2">
                <h4 className="font-medium">Token 信息:</h4>
                <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                  <p><strong>Access Token:</strong> {maskToken(tokenInfo.session.tokenInfo.accessToken || '')}</p>
                  <p><strong>Refresh Token:</strong> {maskToken(tokenInfo.session.tokenInfo.refreshToken || '')}</p>
                  <p><strong>Token Type:</strong> {tokenInfo.session.tokenInfo.tokenType || 'N/A'}</p>
                  <p><strong>过期时间:</strong> {
                    tokenInfo.session.tokenInfo.expiresAt 
                      ? new Date(tokenInfo.session.tokenInfo.expiresAt).toLocaleString()
                      : 'N/A'
                  }</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">localStorage 状态:</h4>
              <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                <p><strong>Session:</strong> {tokenInfo?.localStorage?.session ? '✅ 存在' : '❌ 不存在'}</p>
                <p><strong>Token Info:</strong> {tokenInfo?.localStorage?.tokenInfo ? '✅ 存在' : '❌ 不存在'}</p>
                <p><strong>User Info:</strong> {tokenInfo?.localStorage?.userInfo ? '✅ 存在' : '❌ 不存在'}</p>
                <p><strong>Timestamp:</strong> {tokenInfo?.localStorage?.timestamp || '❌ 不存在'}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
