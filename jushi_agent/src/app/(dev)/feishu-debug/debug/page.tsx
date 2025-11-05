'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Copy } from 'lucide-react'

export default function FeishuDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDebugInfo = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '获取调试信息失败')
      }
      
      setDebugInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取调试信息失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDebugInfo()
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getStatusIcon = (success: boolean) => {
    return success ? 
      <CheckCircle className="h-5 w-5 text-green-500" /> : 
      <XCircle className="h-5 w-5 text-red-500" />
  }

  const getStatusBadge = (success: boolean) => {
    return success ? 
      <Badge variant="default" className="bg-green-500">正常</Badge> : 
      <Badge variant="destructive">异常</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p>正在检查飞书配置...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            飞书配置调试
          </h1>
          <p className="text-gray-600">
            检查飞书应用配置和API连接状态
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* 环境变量检查 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
                环境变量检查
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debugInfo?.environment?.variables && (
                <div className="space-y-3">
                  {Object.entries(debugInfo.environment.variables).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(!!value && value !== 'undefined')}
                        <span className="font-medium">{key}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-white px-2 py-1 rounded">
                          {value || 'undefined'}
                        </code>
                        {getStatusBadge(!!value && value !== 'undefined')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 配置对象检查 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
                配置对象检查
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debugInfo?.environment?.config && (
                <div className="space-y-3">
                  {Object.entries(debugInfo.environment.config).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(!!value && value !== 'undefined')}
                        <span className="font-medium">{key}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-white px-2 py-1 rounded">
                          {value || 'undefined'}
                        </code>
                        {getStatusBadge(!!value && value !== 'undefined')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* API连接测试 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                {debugInfo?.tokenTest?.success ? 
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" /> :
                  <XCircle className="h-5 w-5 text-red-500 mr-2" />
                }
                飞书API连接测试
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debugInfo?.tokenTest && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">HTTP状态</label>
                      <div className="flex items-center space-x-2">
                        <code className="bg-gray-100 px-2 py-1 rounded">
                          {debugInfo.tokenTest.status}
                        </code>
                        {getStatusBadge(debugInfo.tokenTest.status === 200)}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API响应</label>
                      <div className="flex items-center space-x-2">
                        <code className="bg-gray-100 px-2 py-1 rounded">
                          {debugInfo.tokenTest.code || 'N/A'}
                        </code>
                        {getStatusBadge(debugInfo.tokenTest.success)}
                      </div>
                    </div>
                  </div>

                  {debugInfo.tokenTest.msg && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">错误信息</label>
                      <Alert variant={debugInfo.tokenTest.success ? "default" : "destructive"}>
                        <AlertDescription>{debugInfo.tokenTest.msg}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {debugInfo.tokenTest.error && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">连接错误</label>
                      <Alert variant="destructive">
                        <AlertDescription>{debugInfo.tokenTest.error}</AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 修复建议 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                修复建议
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debugInfo?.recommendations && (
                <div className="space-y-2">
                  {debugInfo.recommendations.map((recommendation: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2">
                      <span className="text-yellow-500 mt-1">•</span>
                      <span className="text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <h4 className="font-medium text-blue-800 mb-2">如果App Secret无效：</h4>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. 访问 <a href="https://open.feishu.cn/app" target="_blank" className="underline">飞书开放平台</a></li>
                  <li>2. 找到你的应用 (App ID: {debugInfo?.environment?.config?.CLIENT_ID})</li>
                  <li>3. 重新生成 App Secret</li>
                  <li>4. 更新 .env.local 文件中的 FEISHU_CLIENT_SECRET</li>
                  <li>5. 重启开发服务器</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex space-x-4">
            <Button onClick={fetchDebugInfo} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              重新检查
            </Button>
            
            <Button 
              onClick={() => window.open('https://open.feishu.cn/app', '_blank')}
              variant="outline"
            >
              打开飞书开放平台
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
