'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, QrCode, RefreshCw, CheckCircle } from 'lucide-react'

interface TokenInfo {
  accessToken: string
  refreshToken: string
  tokenType: string
}

interface UserInfo {
  name: string
  openId: string
  userId: string
  tenantKey: string
  avatarUrl: string
}

interface DjangoStyleQRLoginProps {
  onLoginSuccess?: (tokenInfo: TokenInfo, userInfo: UserInfo) => void
  onLoginError?: (error: string) => void
}

export default function DjangoStyleQRLogin({ onLoginSuccess, onLoginError }: DjangoStyleQRLoginProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'scanning' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [authUrl, setAuthUrl] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const loginTimeRef = useRef<string>('')

  // 初始化登录
  const initLogin = async () => {
    try {
      setStatus('loading')
      setError(null)
      
      const loginTime = Date.now().toString()
      loginTimeRef.current = loginTime
      
      const redirectUri = `${window.location.origin}/feishu/bind-callback`

      const response = await fetch('/api/feishu/qr-login/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loginTime,
          redirect_uri: redirectUri,
          url: window.location.href,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '初始化失败')
      }

      setAuthUrl(data.gotoUrl)
      
      // 生成二维码URL
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(data.gotoUrl)}`
      setQrCodeUrl(qrUrl)
      
      setStatus('ready')
      
      // 开始轮询检查登录状态
      startPolling()

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '初始化失败'
      setError(errorMsg)
      setStatus('error')
      onLoginError?.(errorMsg)
    }
  }

  // 开始轮询检查登录状态
  const startPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    pollingRef.current = setInterval(async () => {
      await checkLoginStatus()
    }, 2000) // 每2秒检查一次
  }

  // 检查登录状态 - 改为检查localStorage中是否有登录信息
  const checkLoginStatus = async () => {
    try {
      // 检查localStorage中是否有新的登录信息
      const tokenInfoStr = localStorage.getItem('feishu_token_info')
      const userInfoStr = localStorage.getItem('feishu_user_info')

      if (tokenInfoStr && userInfoStr) {
        const tokenInfo = JSON.parse(tokenInfoStr)
        const userInfo = JSON.parse(userInfoStr)

        // 检查是否是新的登录（通过时间戳或其他标识）
        const loginTimestamp = localStorage.getItem('feishu_login_timestamp')
        if (loginTimestamp && parseInt(loginTimestamp) > parseInt(loginTimeRef.current)) {
          // 登录成功
          setStatus('success')
          setTokenInfo(tokenInfo)
          setUserInfo(userInfo)

          // 停止轮询
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }

          onLoginSuccess?.(tokenInfo, userInfo)
        }
      }
    } catch (error) {
      console.error('检查登录状态出错:', error)
    }
  }

  // 刷新二维码
  const handleRefresh = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setError(null)
    setAuthUrl('')
    setQrCodeUrl('')
    setTokenInfo(null)
    setUserInfo(null)
    initLogin()
  }

  // 组件挂载时初始化
  useEffect(() => {
    initLogin()
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      case 'ready':
        return <QrCode className="h-8 w-8 text-blue-600" />
      case 'scanning':
        return <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-600" />
      case 'error':
        return <RefreshCw className="h-8 w-8 text-red-600" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'loading':
        return '正在生成二维码...'
      case 'ready':
        return '请使用飞书APP扫描二维码'
      case 'scanning':
        return '检测到扫码，正在处理...'
      case 'success':
        return '登录成功！'
      case 'error':
        return '登录失败'
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 mb-4">
          {getStatusIcon()}
        </div>
        <CardTitle className="text-xl font-bold text-gray-900">
          飞书扫码登录 (Django风格)
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          {getStatusText()}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 二维码显示 */}
        <div className="flex justify-center">
          {status === 'loading' && (
            <div className="flex items-center justify-center w-[280px] h-[280px] border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">生成中...</p>
              </div>
            </div>
          )}
          
          {(status === 'ready' || status === 'scanning') && qrCodeUrl && (
            <div className="relative">
              <img 
                src={qrCodeUrl} 
                alt="飞书登录二维码" 
                className="w-[280px] h-[280px] border border-gray-300 rounded-lg"
                onError={() => {
                  setError('二维码加载失败')
                  setStatus('error')
                }}
              />
              {status === 'scanning' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                  <div className="text-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">处理中...</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {status === 'success' && userInfo && (
            <div className="w-[280px] h-[280px] border border-green-300 rounded-lg bg-green-50 flex items-center justify-center">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="font-medium text-green-800">{userInfo.name}</p>
                <p className="text-sm text-green-600">登录成功</p>
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <div className="flex items-center justify-center w-[280px] h-[280px] border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <div className="text-center">
                <QrCode className="h-8 w-8 mx-auto mb-2 text-red-400" />
                <p className="text-sm text-gray-500">生成失败</p>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          {(status === 'error' || status === 'ready') && (
            <Button 
              onClick={handleRefresh}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新二维码
            </Button>
          )}
        </div>

        {/* 使用说明 */}
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>1. 打开飞书手机APP</p>
          <p>2. 点击扫一扫功能</p>
          <p>3. 扫描上方二维码</p>
          <p>4. 确认登录授权</p>
          <p className="text-blue-500">* 自动检测登录状态，无需手动刷新</p>
        </div>
      </CardContent>
    </Card>
  )
}
