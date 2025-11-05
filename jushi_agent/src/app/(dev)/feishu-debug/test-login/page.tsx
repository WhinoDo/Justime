'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Info, ExternalLink, ArrowRight } from 'lucide-react'
import { FeishuAuthOptimized } from '@/lib/feishu/feishu-auth-optimized'

export default function TestLoginPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [codeVerifier, setCodeVerifier] = useState('')

  const generateAuthUrl = async () => {
    setIsGenerating(true)
    try {
      const { authUrl, codeVerifier } = await FeishuAuthOptimized.generateAuthUrl()
      setAuthUrl(authUrl)
      setCodeVerifier(codeVerifier)
      console.log('🔑 生成的PKCE参数:', {
        authUrl,
        codeVerifier: `${codeVerifier.substring(0, 10)}...`,
        length: codeVerifier.length
      })
    } catch (error) {
      console.error('❌ 生成授权URL失败:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const redirectToLogin = async () => {
    try {
      await FeishuAuthOptimized.redirectToLogin(true)
    } catch (error) {
      console.error('❌ 跳转到飞书授权失败:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-6 w-6 text-blue-600" />
              飞书登录测试工具
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">🔐 正确的PKCE流程</p>
                  <p className="text-sm">
                    此工具演示正确的飞书OAuth PKCE流程，确保<code className="bg-gray-100 px-1 rounded">code_verifier</code>和<code className="bg-gray-100 px-1 rounded">code_challenge</code>匹配。
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={generateAuthUrl} 
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  生成授权URL
                </Button>
                
                <Button 
                  onClick={redirectToLogin}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  直接登录
                </Button>
              </div>

              {authUrl && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium text-green-800">✅ 授权URL已生成</p>
                        <p className="text-sm">
                          现在可以点击下面的按钮进行飞书授权，或者复制URL在新窗口中打开。
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div>
                    <h3 className="font-medium mb-2">授权URL:</h3>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm break-all">{authUrl}</code>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        onClick={() => window.open(authUrl, '_blank')}
                        variant="outline"
                        size="sm"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        在新窗口打开
                      </Button>
                      <Button 
                        onClick={() => navigator.clipboard.writeText(authUrl)}
                        variant="outline"
                        size="sm"
                      >
                        复制URL
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Code Verifier:</h3>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm font-mono">{codeVerifier}</code>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      长度: {codeVerifier.length} 字符 (符合RFC 7636规范)
                    </p>
                  </div>
                </div>
              )}

              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-green-800">✅ 使用说明</p>
                    <ol className="text-sm space-y-1 ml-4 list-decimal">
                      <li>点击"生成授权URL"或"直接登录"</li>
                      <li>完成飞书授权后，会跳转到绑定回调页面</li>
                      <li>绑定回调页面会自动使用正确的<code className="bg-green-100 px-1 rounded">code_verifier</code></li>
                      <li>查看控制台日志确认PKCE流程正常工作</li>
                    </ol>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert>
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-red-800">❌ 常见错误</p>
                    <ul className="text-sm space-y-1 ml-4 list-disc">
                      <li>不要手动复制授权URL进行测试</li>
                      <li>不要使用调试工具页面生成的URL（除非它使用PKCE）</li>
                      <li>确保通过<code className="bg-red-100 px-1 rounded">FeishuAuthOptimized</code>进行授权</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
