'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'

export default function TokenTestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testTokenStatus = () => {
    try {
      const isLoggedIn = FeishuTokenManager.isLoggedIn()
      const validToken = FeishuTokenManager.getValidAccessToken()
      const session = FeishuTokenManager.getLoginSession()
      
      setResult({
        isLoggedIn,
        hasValidToken: !!validToken,
        tokenPreview: validToken ? validToken.slice(0, 20) + '...' : null,
        userInfo: session?.userInfo,
        tokenInfo: session?.tokenInfo ? {
          hasAccessToken: !!session.tokenInfo.accessToken,
          hasRefreshToken: !!session.tokenInfo.refreshToken,
          tokenType: session.tokenInfo.tokenType,
          expiresAt: session.tokenInfo.expiresAt ? new Date(session.tokenInfo.expiresAt).toLocaleString() : null
        } : null
      })
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : '检查失败' })
    }
  }

  const testCalendarAPI = async () => {
    setLoading(true)
    try {
      const userToken = FeishuTokenManager.getValidAccessToken()
      if (!userToken) {
        throw new Error('没有有效的访问令牌')
      }

      const response = await fetch(`/api/feishu/calendar/list?user_token=${encodeURIComponent(userToken)}`)
      const result = await response.json()
      
      setResult({
        apiTest: true,
        success: result.success,
        data: result.data,
        error: result.error
      })
    } catch (error) {
      setResult({ 
        apiTest: true,
        error: error instanceof Error ? error.message : 'API 测试失败' 
      })
    } finally {
      setLoading(false)
    }
  }

  const testCreateEvent = async () => {
    setLoading(true)
    try {
      const userToken = FeishuTokenManager.getValidAccessToken()
      if (!userToken) {
        throw new Error('没有有效的访问令牌')
      }

      const now = new Date()
      const startTime = new Date(now.getTime() + 60 * 60 * 1000) // 1小时后
      const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2小时后

      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口').toLocaleTimeString(),
          description: '这是一个测试日程',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          user_token: userToken
        })
      })

      const result = await response.json()
      
      setResult({
        createTest: true,
        success: result.success,
        data: result.data,
        error: result.error
      })
    } catch (error) {
      setResult({ 
        createTest: true,
        error: error instanceof Error ? error.message : '创建测试失败' 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Token 状态测试</h1>
        <p className="text-gray-600 mt-2">测试飞书 Token 的状态和 API 调用</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>测试操作</CardTitle>
            <CardDescription>点击按钮进行各项测试</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={testTokenStatus}
              className="w-full"
            >
              检查 Token 状态
            </Button>
            
            <Button 
              onClick={testCalendarAPI}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? '测试中...' : '测试日历 API'}
            </Button>
            
            <Button 
              onClick={testCreateEvent}
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
            <CardDescription>查看详细的测试输出</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-3">
                {result.error ? (
                  <Alert>
                    <AlertDescription className="text-red-600">
                      错误: {result.error}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {result.isLoggedIn !== undefined && (
                      <div className="flex items-center gap-2">
                        <span>登录状态:</span>
                        <Badge variant={result.isLoggedIn ? "default" : "destructive"}>
                          {result.isLoggedIn ? "已登录" : "未登录"}
                        </Badge>
                      </div>
                    )}
                    
                    {result.success !== undefined && (
                      <div className="flex items-center gap-2">
                        <span>API 调用:</span>
                        <Badge variant={result.success ? "default" : "destructive"}>
                          {result.success ? "成功" : "失败"}
                        </Badge>
                      </div>
                    )}
                  </>
                )}
                
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
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
            <strong>使用说明：</strong>
          </div>
          <div className="mt-2 space-y-1">
            <div>1. 首先点击"检查 Token 状态"确认登录状态</div>
            <div>2. 然后点击"测试日历 API"验证 API 调用</div>
            <div>3. 最后点击"测试创建日程"验证创建功能</div>
            <div>4. 查看浏览器控制台获取详细日志信息</div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
