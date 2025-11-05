'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

export default function SDKTestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setIsLoggedIn(FeishuTokenManager.isLoggedIn())
    }
  }, [])

  const testSDKCalendarList = async () => {
    if (!isLoggedIn) {
      setResult({ error: '请先登录飞书账号' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const userToken = FeishuTokenManager.getValidAccessToken()
      if (!userToken) {
        throw new Error('用户访问令牌无效，请重新登录')
      }

      console.log('🧪 测试 SDK 日历列表 API...')

      const response = await fetch(`/api/feishu/calendar/list?user_token=${encodeURIComponent(userToken)}`)
      const result = await response.json()

      console.log('📊 SDK 测试结果:', result)

      setResult({
        type: 'calendar_list',
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.message
      })

    } catch (error) {
      console.error('❌ SDK 测试失败:', error)
      setResult({
        type: 'calendar_list',
        success: false,
        error: error instanceof Error ? error.message : 'SDK 测试失败'
      })
    } finally {
      setLoading(false)
    }
  }

  const testSDKCreateEvent = async () => {
    if (!isLoggedIn) {
      setResult({ error: '请先登录飞书账号' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const userToken = FeishuTokenManager.getValidAccessToken()
      if (!userToken) {
        throw new Error('用户访问令牌无效，请重新登录')
      }

      const now = new Date()
      const startTime = new Date(now.getTime() + 60 * 60 * 1000) // 1小时后
      const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2小时后

      console.log('🧪 测试 SDK 创建事件 API...')

      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口').toLocaleTimeString(),
          description: '这是一个 SDK 测试日程，验证修复后的功能',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          user_token: userToken
        })
      })

      const result = await response.json()

      console.log('📊 SDK 创建测试结果:', result)

      setResult({
        type: 'create_event',
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.message
      })

    } catch (error) {
      console.error('❌ SDK 创建测试失败:', error)
      setResult({
        type: 'create_event',
        success: false,
        error: error instanceof Error ? error.message : 'SDK 创建测试失败'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">飞书 SDK 功能测试</h1>
        <p className="text-gray-600 mt-2">测试修复后的飞书 Node.js SDK 功能</p>
      </div>

      {!mounted ? (
        <Card>
          <CardHeader>
            <CardTitle>正在加载...</CardTitle>
            <CardDescription>正在检查登录状态</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      ) : !isLoggedIn ? (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center">需要登录</CardTitle>
            <CardDescription className="text-center">
              请先登录飞书账号以测试 SDK 功能
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => FeishuLoginRedirect.redirectToLogin(true)}>
              前往登录
            </Button>
          </CardContent>
        </Card>
      ) : (

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>SDK 测试</CardTitle>
            <CardDescription>测试修复后的 withTenantToken 功能</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={testSDKCalendarList}
              disabled={loading}
              className="w-full"
            >
              {loading ? '测试中...' : '测试获取日历列表'}
            </Button>
            
            <Button 
              onClick={testSDKCreateEvent}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? '创建中...' : '测试创建日程'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>测试结果</CardTitle>
            <CardDescription>查看 SDK 测试的详细结果</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span>测试类型:</span>
                  <Badge variant="outline">
                    {result.type === 'calendar_list' ? '日历列表' : '创建事件'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span>结果:</span>
                  <Badge variant={result.success ? "default" : "destructive"}>
                    {result.success ? "成功" : "失败"}
                  </Badge>
                </div>

                {result.error && (
                  <Alert>
                    <AlertDescription className="text-red-600">
                      错误: {result.error}
                    </AlertDescription>
                  </Alert>
                )}

                {result.success && result.message && (
                  <Alert>
                    <AlertDescription className="text-green-600">
                      {result.message}
                    </AlertDescription>
                  </Alert>
                )}

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">查看详细数据</summary>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96 mt-2">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="text-gray-500">点击测试按钮查看结果</p>
            )}
          </CardContent>
        </Card>
      </div>

        <Alert>
          <AlertDescription>
            <div>
              <strong>修复说明：</strong>
            </div>
            <div className="mt-2 space-y-1">
              <div>1. 修复了 `this.client.withTenantToken` 不是函数的错误</div>
              <div>2. 现在使用 `lark.withTenantToken()` 正确传递用户访问令牌</div>
              <div>3. 所有 SDK 调用都使用官方推荐的方式</div>
              <div>4. 查看浏览器控制台获取详细的调试信息</div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
