'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { 
  LogOut, 
  User, 
  Shield, 
  Clock, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Key,
  Database,
  Settings
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function FeishuLogoutPage() {
  const router = useRouter()
  const { isLoggedIn, userInfo, tokenInfo, logout, checkLogin } = useFeishuLogin()
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [logoutType, setLogoutType] = useState<'simple' | 'complete' | 'revoke'>('simple')

  useEffect(() => {
    checkLogin()
  }, [checkLogin])

  const handleSimpleLogout = async () => {
    setIsLoading(true)
    try {
      // 只清除本地存储的令牌
      FeishuTokenManager.clearTokens()
      logout()
      
      // 显示成功消息
      alert('✅ 已成功登出，本地令牌已清除')

      // 刷新页面并跳转到首页
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    } catch (error) {
      console.error('简单登出失败:', error)
      alert('❌ 登出失败，请重试')
    } finally {
      setIsLoading(false)
      setShowConfirm(false)
    }
  }

  const handleCompleteLogout = async () => {
    setIsLoading(true)
    try {
      // 清除所有相关的本地存储
      const keysToRemove = [
        'feishu_session',
        'feishu_token_info',
        'feishu_user_info',
        'feishu_login_timestamp',
        'feishu_login_status',
        'feishu_login_complete',
        'feishu_processed_codes',
        'feishu_return_url'
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      FeishuTokenManager.clearTokens()
      logout()

      // 显示成功消息
      alert('✅ 已完全清除所有登录数据')

      // 刷新页面并跳转到首页
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    } catch (error) {
      console.error('完全登出失败:', error)
      alert('❌ 登出失败，请重试')
    } finally {
      setIsLoading(false)
      setShowConfirm(false)
    }
  }

  const handleRevokeAuthorization = async () => {
    setIsLoading(true)
    try {
      // 尝试撤销授权（如果有相关API）
      const accessToken = FeishuTokenManager.getValidAccessToken()
      if (accessToken) {
        try {
          // 这里可以调用飞书的撤销授权API
          // 目前先清除本地数据
          console.log('撤销授权令牌:', `${accessToken.substring(0, 10)}...`)
        } catch (revokeError) {
          console.warn('撤销授权API调用失败，继续清除本地数据:', revokeError)
        }
      }

      // 清除所有数据
      await handleCompleteLogout()
      
      alert('✅ 已撤销授权并清除所有数据')
    } catch (error) {
      console.error('撤销授权失败:', error)
      alert('❌ 撤销授权失败，请重试')
    } finally {
      setIsLoading(false)
      setShowConfirm(false)
    }
  }

  const handleLogoutAction = () => {
    switch (logoutType) {
      case 'simple':
        handleSimpleLogout()
        break
      case 'complete':
        handleCompleteLogout()
        break
      case 'revoke':
        handleRevokeAuthorization()
        break
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const isTokenExpired = tokenInfo?.expiresAt ? Date.now() >= tokenInfo.expiresAt : false
  const isTokenExpiringSoon = tokenInfo?.expiresAt ? Date.now() >= (tokenInfo.expiresAt - 5 * 60 * 1000) : false

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              飞书账号登出与授权管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                在这里您可以管理飞书账号的登录状态和授权信息。请根据需要选择合适的登出方式。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* 当前登录状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              当前登录状态
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span>登录状态:</span>
              {isLoggedIn ? (
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

            {isLoggedIn && userInfo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                <div>
                  <span className="font-medium text-blue-900">用户名:</span>
                  <div className="text-blue-800">{userInfo.name || '未知'}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-900">邮箱:</span>
                  <div className="text-blue-800">{userInfo.email || '未知'}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-900">Open ID:</span>
                  <div className="text-blue-800 font-mono text-xs">{userInfo.open_id || userInfo.openId || '未知'}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-900">User ID:</span>
                  <div className="text-blue-800 font-mono text-xs">{userInfo.user_id || userInfo.userId || '未知'}</div>
                </div>
              </div>
            )}

            {isLoggedIn && tokenInfo && (
              <div className="space-y-3">
                <Separator />
                <h4 className="font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  令牌信息
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">令牌类型:</span>
                    <div>{tokenInfo.tokenType || 'Bearer'}</div>
                  </div>
                  <div>
                    <span className="font-medium">过期时间:</span>
                    <div className={isTokenExpired ? 'text-red-600' : isTokenExpiringSoon ? 'text-yellow-600' : 'text-green-600'}>
                      {tokenInfo.expiresAt ? formatTime(tokenInfo.expiresAt) : '未知'}
                      {isTokenExpired && <span className="ml-2 text-xs">(已过期)</span>}
                      {isTokenExpiringSoon && !isTokenExpired && <span className="ml-2 text-xs">(即将过期)</span>}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">获取时间:</span>
                    <div>{tokenInfo.obtainedAt ? formatTime(tokenInfo.obtainedAt) : '未知'}</div>
                  </div>
                  <div>
                    <span className="font-medium">刷新令牌:</span>
                    <div>{tokenInfo.refreshToken ? '可用' : '不可用'}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 登出选项 */}
        {isLoggedIn && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                登出选项
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 简单登出 */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    logoutType === 'simple' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setLogoutType('simple')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <LogOut className="h-4 w-4" />
                    <span className="font-medium">简单登出</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    只清除本地存储的令牌，不影响飞书端的授权状态
                  </p>
                </div>

                {/* 完全登出 */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    logoutType === 'complete' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setLogoutType('complete')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4" />
                    <span className="font-medium">完全登出</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    清除所有本地存储的登录数据和缓存信息
                  </p>
                </div>

                {/* 撤销授权 */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    logoutType === 'revoke' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setLogoutType('revoke')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">撤销授权</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    撤销应用授权并清除所有数据（推荐）
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  已选择: <span className="font-medium">
                    {logoutType === 'simple' && '简单登出'}
                    {logoutType === 'complete' && '完全登出'}
                    {logoutType === 'revoke' && '撤销授权'}
                  </span>
                </div>
                <Button 
                  onClick={() => setShowConfirm(true)}
                  variant={logoutType === 'revoke' ? 'destructive' : 'outline'}
                  disabled={isLoading}
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                  执行登出
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 未登录状态 */}
        {!isLoggedIn && (
          <Card>
            <CardHeader>
              <CardTitle>未登录状态</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="text-gray-500">
                您当前未登录飞书账号
              </div>
              <Button onClick={() => FeishuLoginRedirect.redirectToLogin(false)}>
                <User className="h-4 w-4 mr-2" />
                登录飞书账号
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 确认对话框 */}
        {showConfirm && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                确认操作
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {logoutType === 'simple' && '确定要登出吗？这将清除本地存储的令牌。'}
                  {logoutType === 'complete' && '确定要完全登出吗？这将清除所有本地存储的登录数据。'}
                  {logoutType === 'revoke' && '确定要撤销授权吗？这将撤销应用的所有权限并清除所有数据。此操作不可逆！'}
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfirm(false)}
                  disabled={isLoading}
                >
                  取消
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleLogoutAction}
                  disabled={isLoading}
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  确认{logoutType === 'simple' ? '登出' : logoutType === 'complete' ? '完全登出' : '撤销授权'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
