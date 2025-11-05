'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Copy, ExternalLink, Wifi, Globe } from 'lucide-react'

export default function NetworkTestPage() {
  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [networkInfo, setNetworkInfo] = useState<any>({})

  useEffect(() => {
    // 获取网络信息
    setNetworkInfo({
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      protocol: window.location.protocol,
      host: window.location.host,
      origin: window.location.origin,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      timestamp: new Date().toLocaleString()
    })
  }, [])

  const runNetworkTests = async () => {
    setLoading(true)
    const testResults: any[] = []

    // 测试1: 本地服务器连接
    try {
      const response = await fetch('/api/health', { method: 'GET' })
      testResults.push({
        name: '本地服务器连接',
        status: response.ok ? 'success' : 'error',
        message: response.ok ? '连接正常' : `HTTP ${response.status}`,
        details: `状态码: ${response.status}`
      })
    } catch (error) {
      testResults.push({
        name: '本地服务器连接',
        status: 'error',
        message: '连接失败',
        details: error instanceof Error ? error.message : '未知错误'
      })
    }

    // 测试2: 飞书重定向页面
    try {
      const response = await fetch('/feishu/bind-callback-test', { method: 'GET' })
      testResults.push({
        name: '飞书重定向页面',
        status: response.ok ? 'success' : 'error',
        message: response.ok ? '页面可访问' : `HTTP ${response.status}`,
        details: `状态码: ${response.status}`
      })
    } catch (error) {
      testResults.push({
        name: '飞书重定向页面',
        status: 'error',
        message: '页面无法访问',
        details: error instanceof Error ? error.message : '未知错误'
      })
    }

    // 测试3: 飞书API连接
    try {
      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: 'test',
          app_secret: 'test'
        })
      })
      testResults.push({
        name: '飞书API连接',
        status: response.ok ? 'success' : 'warning',
        message: response.ok ? 'API可访问' : '需要有效凭证',
        details: `状态码: ${response.status}`
      })
    } catch (error) {
      testResults.push({
        name: '飞书API连接',
        status: 'error',
        message: 'API无法访问',
        details: error instanceof Error ? error.message : '网络错误'
      })
    }

    // 测试4: 外部网络连接
    try {
      const response = await fetch('https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=test')
      testResults.push({
        name: '外部网络连接',
        status: response.ok ? 'success' : 'error',
        message: response.ok ? '外网连接正常' : '外网连接异常',
        details: `二维码服务状态: ${response.status}`
      })
    } catch (error) {
      testResults.push({
        name: '外部网络连接',
        status: 'error',
        message: '外网连接失败',
        details: error instanceof Error ? error.message : '网络错误'
      })
    }

    setTests(testResults)
    setLoading(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <RefreshCw className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">正常</Badge>
      case 'warning':
        return <Badge className="bg-yellow-500">警告</Badge>
      case 'error':
        return <Badge variant="destructive">错误</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            网络连接诊断
          </h1>
          <p className="text-gray-600">
            诊断飞书扫码登录时的网络连接问题
          </p>
        </div>

        <div className="space-y-6">
          {/* 网络信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wifi className="h-5 w-5 text-blue-500 mr-2" />
                网络环境信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">网络状态</span>
                    <Badge className={networkInfo.online ? 'bg-green-500' : 'bg-red-500'}>
                      {networkInfo.online ? '在线' : '离线'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">协议</span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {networkInfo.protocol}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">主机</span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {networkInfo.host}
                    </code>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cookie支持</span>
                    <Badge className={networkInfo.cookieEnabled ? 'bg-green-500' : 'bg-red-500'}>
                      {networkInfo.cookieEnabled ? '支持' : '不支持'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">平台</span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {networkInfo.platform}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">检测时间</span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {networkInfo.timestamp}
                    </code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 测试按钮 */}
          <div className="flex justify-center">
            <Button 
              onClick={runNetworkTests}
              disabled={loading}
              size="lg"
              className="px-8"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  开始网络测试
                </>
              )}
            </Button>
          </div>

          {/* 测试结果 */}
          {tests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>测试结果</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tests.map((test, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(test.status)}
                        <div>
                          <h4 className="font-medium">{test.name}</h4>
                          <p className="text-sm text-gray-600">{test.message}</p>
                          {test.details && (
                            <p className="text-xs text-gray-500 mt-1">{test.details}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(test.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 解决方案建议 */}
          <Card>
            <CardHeader>
              <CardTitle>解决方案建议</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>如果出现"网页无法连接"错误：</strong>
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium">1. 检查重定向URI配置</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      确保飞书开放平台中配置的重定向URI为：
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                        http://192.168.0.101:3001/feishu/bind-callback-test
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard('http://192.168.0.101:3001/feishu/bind-callback-test')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-medium">2. 测试重定向页面</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      直接访问重定向页面确认可用性：
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => window.open('/feishu/bind-callback-test', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      测试重定向页面
                    </Button>
                  </div>

                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-medium">3. 检查防火墙设置</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      确保本地防火墙允许3001端口的访问
                    </p>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-medium">4. 使用公网地址</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      如果localhost无法访问，考虑使用ngrok等工具创建公网隧道
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <div className="grid md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              onClick={() => window.open('https://open.feishu.cn/app', '_blank')}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              飞书开放平台
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.open('/feishu/debug', '_blank')}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              调试工具
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.open('/feishu/qr-login', '_blank')}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              扫码登录
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
