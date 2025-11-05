'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertTriangle, Copy, ExternalLink } from 'lucide-react'

export default function ConfigCheckPage() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取当前配置信息
    const currentConfig = {
      clientId: 'cli_a5d611352af9d00b',
      clientSecret: 'h4tc71u9Ahho5ceNyjE7QdRNYvP1Hs3q',
      redirectUris: [
        'http://192.168.0.101:3001/feishu/bind-callback-test'
      ],
      recommendedUri: 'http://192.168.0.101:3001/feishu/bind-callback-test',
      currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'http://192.168.0.101:3001',
      environment: 'development'
    }
    setConfig(currentConfig)
    setLoading(false)
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const openFeishuConsole = () => {
    window.open('https://open.feishu.cn/app', '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>加载配置信息...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            飞书应用配置检查
          </h1>
          <p className="text-gray-600">
            检查当前飞书应用配置是否正确，并提供修复建议
          </p>
        </div>

        <div className="space-y-6">
          {/* 错误信息 */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>错误码 20029:</strong> redirect_uri 请求不合法
              <br />
              <strong>Logid:</strong> 20250802102736780AE041557AAFB19921
            </AlertDescription>
          </Alert>

          {/* 当前配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                当前应用配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">App ID</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                      {config.clientId}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(config.clientId)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">App Secret</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                      {config.clientSecret.substring(0, 8)}...
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(config.clientSecret)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 重定向URI配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
                重定向URI配置问题
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  需要在飞书开放平台中配置以下重定向URI
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <h4 className="font-medium">需要添加的重定向URI:</h4>
                {config.redirectUris.map((uri: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <code className="flex-1 text-sm">{uri}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(uri)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 配置步骤 */}
          <Card>
            <CardHeader>
              <CardTitle>配置步骤</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium">打开飞书开放平台</p>
                    <p className="text-sm text-gray-600 mt-1">
                      访问飞书开放平台控制台
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={openFeishuConsole}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      打开飞书开放平台
                    </Button>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium">找到你的应用</p>
                    <p className="text-sm text-gray-600 mt-1">
                      App ID: <code className="bg-gray-100 px-1 rounded">{config.clientId}</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium">配置重定向URL</p>
                    <p className="text-sm text-gray-600 mt-1">
                      在应用设置中找到"重定向URL"配置项，添加上面列出的URL
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-medium">保存配置</p>
                    <p className="text-sm text-gray-600 mt-1">
                      保存配置后，等待几分钟让配置生效
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 测试链接 */}
          <Card>
            <CardHeader>
              <CardTitle>测试登录</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                配置完成后，可以使用以下链接测试登录功能
              </p>
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href="/feishu/qr-login">
                    扫码登录测试
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href="/feishu/auth">
                    OAuth授权测试
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href="/test-qr">
                    综合测试页面
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
