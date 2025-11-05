'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle } from 'lucide-react'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

export default function CalendarDebugPage() {
  const [debugResult, setDebugResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setIsLoggedIn(FeishuTokenManager.isLoggedIn())
    }
  }, [])

  const runCalendarDebug = async () => {
    if (!isLoggedIn) {
      setDebugResult({ error: '请先登录飞书账号' })
      return
    }

    setLoading(true)
    setDebugResult(null)

    try {
      const userToken = FeishuTokenManager.getValidAccessToken()
      if (!userToken) {
        throw new Error('用户访问令牌无效，请重新登录')
      }

      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口')
      })

      const result = await response.json()
      setDebugResult(result)

    } catch (error) {
      setDebugResult({
        success: false,
        error: error instanceof Error ? error.message : '调试失败'
      })
    } finally {
      setLoading(false)
    }
  }

  const runRawRequestTest = async () => {
    if (!isLoggedIn) {
      setDebugResult({ error: '请先登录飞书账号' })
      return
    }

    setLoading(true)
    setDebugResult(null)

    try {
      const userToken = FeishuTokenManager.getValidAccessToken()
      if (!userToken) {
        throw new Error('用户访问令牌无效，请重新登录')
      }

      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口')
      })

      const result = await response.json()
      setDebugResult(result)

    } catch (error) {
      setDebugResult({
        success: false,
        error: error instanceof Error ? error.message : '测试失败'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">飞书日历访问调试</h1>
        <p className="text-gray-600 mt-2">诊断为什么 API 返回空日程的问题</p>
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
              请先登录飞书账号以进行日历调试
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => FeishuLoginRedirect.redirectToLogin(true)}>
              前往登录
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>日历访问调试</CardTitle>
              <CardDescription>
                逐步检查日历权限、数据访问等问题
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <Button 
                  onClick={runCalendarDebug}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? '调试中...' : '开始日历调试 (SDK)'}
                </Button>
                
                <Button 
                  onClick={runRawRequestTest}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? '测试中...' : '原始 HTTP 请求测试'}
                </Button>
              </div>

              {debugResult && (
                <div className="space-y-4">
                  {debugResult.error ? (
                    <Alert>
                      <XCircle className="h-4 w-4" />
                      <AlertDescription className="text-red-600">
                        调试失败: {debugResult.error}
                      </AlertDescription>
                    </Alert>
                  ) : debugResult.success ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription className="text-green-600">
                        调试成功！请查看浏览器控制台获取详细信息。
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium mb-2">调试结果</h3>
                      <pre className="text-xs overflow-auto max-h-96">
                        {JSON.stringify(debugResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Alert>
            <AlertDescription>
              <div>
                <strong>调试说明：</strong>
              </div>
              <div className="mt-2 space-y-1">
                <div>1. 此工具会逐步检查日历访问权限和数据</div>
                <div>2. 如果步骤1失败，说明没有日历访问权限</div>
                <div>3. 如果步骤2失败，说明无法访问具体日历的事件</div>
                <div>4. 查看浏览器控制台获取更详细的调试信息</div>
                <div>5. 如果所有步骤都成功但事件为空，说明该时间段确实没有日程</div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
