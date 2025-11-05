'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, CheckCircle, XCircle, Info } from 'lucide-react'

export default function DebugAuthCodePage() {
  const [authCode, setAuthCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showFullCode, setShowFullCode] = useState(false)

  // 生成符合RFC 7636标准的PKCE code_verifier
  const generateCodeVerifier = (): string => {
    // RFC 7636标准字符集：[A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    // 长度：43-128字符（随机选择）
    const length = 43 + Math.floor(Math.random() * (128 - 43 + 1))
    
    let result = ''
    const array = new Uint8Array(length)
    
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array)
    } else {
      // 服务端环境fallback
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }
    
    // 从标准字符集中随机选择字符
    for (let i = 0; i < length; i++) {
      result += charset[array[i] % charset.length]
    }
    
    return result
  }

  // 生成PKCE code_challenge
  const generateCodeChallenge = async (verifier: string): Promise<string> => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 浏览器环境：使用Web Crypto API
      const encoder = new TextEncoder()
      const data = encoder.encode(verifier)
      const digest = await window.crypto.subtle.digest('SHA-256', data)
      return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    } else {
      // 服务端环境：使用Node.js crypto（需要安装crypto模块）
      const crypto = require('crypto')
      const hash = crypto.createHash('sha256').update(verifier).digest()
      return Buffer.from(hash).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    }
  }

  const testAuthCode = async () => {
    if (!authCode.trim()) {
      alert('请输入授权码')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      console.log('🔑 准备测试授权码')

      // 使用调试API获取详细的响应信息
      const response = await fetch('/api/feishu/debug-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: authCode,
          state: 'debug-test',
          redirect_uri: 'http://192.168.1.4:3000/feishu/bind-callback'
        })
      })

      const data = await response.json()
      setResult({
        status: response.status,
        success: data.success,
        data: data,
        requestDetails: data.requestDetails,
        responseDetails: data.responseDetails
      })
    } catch (error) {
      setResult({
        status: 'error',
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      })
    } finally {
      setLoading(false)
    }
  }

  const getAuthUrl = async () => {
    // 生成参数
    const codeVerifier = generateCodeVerifier()
    
    // 保存code_verifier到localStorage（用于后续Token交换）
    if (typeof window !== 'undefined') {
      localStorage.setItem('feishu_code_verifier', codeVerifier)
      localStorage.setItem('feishu_auth_state', 'debug-test')
      localStorage.setItem('feishu_auth_timestamp', Date.now().toString())
    }
    
    const params = new URLSearchParams({
      client_id: 'cli_a8e96281e53b500c',
      redirect_uri: 'http://192.168.1.4:3000/feishu/bind-callback',
      response_type: 'code',
      scope: 'auth:user.id:read offline_access'
    })
    
    return `https://accounts.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-6 w-6 text-blue-600" />
              飞书授权码调试工具
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="authCode">授权码 (Authorization Code)</Label>
              <Input
                id="authCode"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="请输入从飞书授权页面获取的授权码"
                className="font-mono"
              />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showFullCode"
                  checked={showFullCode}
                  onCheckedChange={(checked) => setShowFullCode(checked as boolean)}
                />
                <Label htmlFor="showFullCode" className="text-sm">
                  显示完整授权码（调试用）
                </Label>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">🔐 Token交换流程</h4>
              <p className="text-sm text-blue-700">
                此工具会自动生成 <code className="bg-blue-100 px-1 rounded">code_verifier</code> 用于Token交换时的安全验证。
                每次测试都会生成新的随机字符串，符合RFC 7636规范。
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={testAuthCode} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                测试授权码
              </Button>
              <Button 
                variant="outline" 
                onClick={async () => {
                  const url = await getAuthUrl()
                  window.open(url, '_blank')
                }}
              >
                获取新授权码
              </Button>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>使用说明：</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>点击"获取新授权码"按钮跳转到飞书授权页面</li>
                    <li>完成授权后，从回调URL中复制授权码</li>
                    <li>将授权码粘贴到输入框中并点击"测试授权码"</li>
                    <li>授权码有效期为5分钟，且只能使用一次</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                测试结果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>HTTP状态码</Label>
                    <div className="font-mono text-sm p-2 bg-gray-100 rounded">
                      {result.status}
                    </div>
                  </div>
                  <div>
                    <Label>请求成功</Label>
                    <div className="font-mono text-sm p-2 bg-gray-100 rounded">
                      {result.success ? '是' : '否'}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>响应数据</Label>
                    <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
                      {JSON.stringify(result.data || result, (key, value) => {
                        // 如果启用了显示完整授权码，则显示完整内容
                        if (key === 'code' && typeof value === 'string' && !showFullCode) {
                          return `${value.substring(0, 10)}...`
                        }
                        return value
                      }, 2)}
                    </pre>
                  </div>

                  {result.requestDetails && (
                    <div>
                      <Label>请求详情</Label>
                      <pre className="text-xs bg-blue-50 p-4 rounded overflow-auto max-h-96">
                        {JSON.stringify(result.requestDetails, null, 2)}
                      </pre>
                    </div>
                  )}

                  {result.responseDetails && (
                    <div>
                      <Label>飞书API响应详情</Label>
                      <pre className="text-xs bg-green-50 p-4 rounded overflow-auto max-h-96">
                        {JSON.stringify(result.responseDetails, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {result.data?.suggestion && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>建议：</strong> {result.data.suggestion}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>常见问题解决</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-medium text-red-600">❌ 授权码无效或已使用 (20003)</h4>
              <p className="text-sm text-gray-600">
                原因：授权码已过期（5分钟）或已被使用过。解决方案：重新获取授权码。
              </p>
            </div>
            <div>
              <h4 className="font-medium text-red-600">❌ 应用配置错误 (20002)</h4>
              <p className="text-sm text-gray-600">
                原因：client_id或client_secret不正确。解决方案：检查飞书开放平台配置。
              </p>
            </div>
            <div>
              <h4 className="font-medium text-red-600">❌ 授权码与应用不匹配 (20024)</h4>
              <p className="text-sm text-gray-600">
                原因：授权码不是由当前应用生成的。解决方案：确保使用正确的应用进行授权。
              </p>
            </div>
            <div>
              <h4 className="font-medium text-red-600">❌ 授权码已过期 (20004)</h4>
              <p className="text-sm text-gray-600">
                原因：授权码超过5分钟有效期。解决方案：重新进行授权获取新授权码。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
