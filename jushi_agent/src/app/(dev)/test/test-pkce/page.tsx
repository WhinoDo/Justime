'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Info, ExternalLink } from 'lucide-react'
import { FeishuAuthOptimized } from '@/lib/feishu/feishu-auth-optimized'

export default function TestPKCEPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [codeVerifier, setCodeVerifier] = useState('')

  const generatePKCEAuthUrl = async () => {
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
      console.error('❌ 生成PKCE授权URL失败:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const redirectToFeishu = async () => {
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
              PKCE 流程测试工具
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">🔐 PKCE 安全流程说明</p>
                  <p className="text-sm">
                    PKCE (Proof Key for Code Exchange) 是OAuth 2.0的安全扩展，用于防止授权码拦截攻击。
                  </p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• 生成随机 <code className="bg-gray-100 px-1 rounded">code_verifier</code></li>
                    <li>• 计算 <code className="bg-gray-100 px-1 rounded">code_challenge</code> (SHA-256)</li>
                    <li>• 在授权URL中包含 <code className="bg-gray-100 px-1 rounded">code_challenge</code></li>
                    <li>• 在Token交换时使用 <code className="bg-gray-100 px-1 rounded">code_verifier</code></li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={generatePKCEAuthUrl} 
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  生成PKCE授权URL
                </Button>
                
                <Button 
                  onClick={redirectToFeishu}
                  variant="outline"
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  直接跳转授权
                </Button>
              </div>

              {authUrl && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">生成的授权URL:</h3>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm break-all">{authUrl}</code>
                    </div>
                    <Button 
                      onClick={() => window.open(authUrl, '_blank')}
                      className="mt-2"
                      variant="outline"
                      size="sm"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      在新窗口打开
                    </Button>
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
                      <li>点击"生成PKCE授权URL"或"直接跳转授权"</li>
                      <li>完成飞书授权后，会跳转到绑定回调页面</li>
                      <li>绑定回调页面会自动使用正确的<code className="bg-green-100 px-1 rounded">code_verifier</code></li>
                      <li>查看控制台日志确认PKCE流程正常工作</li>
                    </ol>
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
