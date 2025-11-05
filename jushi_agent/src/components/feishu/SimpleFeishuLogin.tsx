'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ExternalLink, QrCode, CheckCircle } from 'lucide-react'

interface SimpleFeishuLoginProps {
  onLoginSuccess?: (tokenInfo: any, userInfo: any) => void
  onLoginError?: (error: string) => void
}

export default function SimpleFeishuLogin({ onLoginSuccess, onLoginError }: SimpleFeishuLoginProps) {
  const [authUrl, setAuthUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 生成登录URL
  const generateLoginUrl = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const loginTime = Date.now().toString()
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
        throw new Error(data.error || '生成登录URL失败')
      }

      setAuthUrl(data.gotoUrl)
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '生成登录URL失败'
      setError(errorMsg)
      onLoginError?.(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // 打开登录页面
  const openLoginPage = () => {
    if (authUrl) {
      // 保存返回URL
      localStorage.setItem('feishu_return_url', window.location.href)
      window.open(authUrl, '_blank')
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 mb-4">
          <QrCode className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle className="text-xl font-bold text-gray-900">
          飞书登录
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          点击按钮打开飞书授权页面
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {!authUrl ? (
            <Button 
              onClick={generateLoginUrl}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? '生成中...' : '生成登录链接'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">登录链接已生成</span>
                </div>
                <p className="text-sm text-green-700">
                  点击下方按钮打开飞书授权页面，完成登录后会自动跳转回来
                </p>
              </div>
              
              <Button 
                onClick={openLoginPage}
                className="w-full"
                size="lg"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                打开飞书登录页面
              </Button>
              
              <Button 
                onClick={generateLoginUrl}
                variant="outline"
                className="w-full"
                size="sm"
              >
                重新生成链接
              </Button>
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>1. 点击"生成登录链接"</p>
          <p>2. 点击"打开飞书登录页面"</p>
          <p>3. 在新页面中完成飞书授权</p>
          <p>4. 授权完成后会自动跳转回来</p>
        </div>

        {/* 调试信息 */}
        {authUrl && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500">查看登录URL</summary>
            <div className="mt-2 p-2 bg-gray-100 rounded text-gray-700 break-all">
              {authUrl}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
