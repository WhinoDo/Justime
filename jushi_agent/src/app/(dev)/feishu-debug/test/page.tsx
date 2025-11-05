'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Phone, Mail, User, CheckCircle, XCircle } from 'lucide-react'
import UserProfile from '@/components/feishu/UserProfile'

interface UserResult {
  user_id: string
  mobile?: string
  email?: string
}

export default function FeishuTestPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<UserResult[]>([])
  const [accessToken, setAccessToken] = useState('')
  const [mobile, setMobile] = useState('19857426673')
  const [email, setEmail] = useState('')

  // 组件挂载时尝试从sessionStorage获取访问令牌
  useEffect(() => {
    const savedToken = sessionStorage.getItem('feishu_access_token')
    if (savedToken) {
      setAccessToken(savedToken)
    }
  }, [])

  const testBatchGetId = async () => {
    if (!accessToken.trim()) {
      setError('请先输入访问令牌')
      return
    }

    if (!mobile.trim() && !email.trim()) {
      setError('请至少输入手机号或邮箱')
      return
    }

    setIsLoading(true)
    setError(null)
    setResults([])

    try {
      const requestBody = {
        access_token: accessToken,
        mobiles: mobile.trim() ? [mobile.trim()] : [],
        emails: email.trim() ? [email.trim()] : [],
        include_resigned: true
      }

      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口')
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '请求失败')
      }

      setResults(data.data.user_list || [])
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setIsLoading(false)
    }
  }

  const goToAuth = () => {
    // 保存当前页面URL，授权完成后返回
    sessionStorage.setItem('feishu_return_url', '/feishu/test')
    window.location.href = '/feishu/auth'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">飞书API测试</h1>
          <p className="mt-2 text-sm text-gray-600">
            测试通过手机号或邮箱获取飞书用户ID的功能
          </p>
        </div>

        {/* 用户信息展示 */}
        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">当前用户</h2>
            <UserProfile />
          </div>

          <div className="lg:col-span-3 space-y-8">

        {/* 授权卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              第一步：获取访问令牌
            </CardTitle>
            <CardDescription>
              首先需要通过飞书OAuth授权获取访问令牌
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  访问令牌 (Access Token)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="请输入访问令牌或点击授权获取"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button onClick={goToAuth} variant="outline">
                    去授权
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 测试卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Phone className="mr-2 h-5 w-5" />
              第二步：测试用户ID获取
            </CardTitle>
            <CardDescription>
              输入手机号或邮箱来获取对应的飞书用户ID
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  手机号
                </label>
                <div className="flex items-center">
                  <Phone className="mr-2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="请输入11位手机号"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱 (可选)
                </label>
                <div className="flex items-center">
                  <Mail className="mr-2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入邮箱地址"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={testBatchGetId} 
                disabled={isLoading || !accessToken.trim()}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    查询中...
                  </>
                ) : (
                  '获取用户ID'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 结果显示 */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                查询结果
              </CardTitle>
              <CardDescription>
                找到 {results.length} 个用户
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((user, index) => (
                  <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">用户ID:</span>
                        <span className="ml-2 font-mono text-blue-600">{user.user_id}</span>
                      </div>
                      {user.mobile && (
                        <div>
                          <span className="font-medium text-gray-700">手机号:</span>
                          <span className="ml-2">{user.mobile}</span>
                        </div>
                      )}
                      {user.email && (
                        <div>
                          <span className="font-medium text-gray-700">邮箱:</span>
                          <span className="ml-2">{user.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* API文档 */}
        <Card>
          <CardHeader>
            <CardTitle>API使用说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">1. 获取访问令牌</h4>
                <p>访问 <code className="bg-gray-100 px-1 rounded">/feishu/auth</code> 进行OAuth授权</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">2. 调用API</h4>
                <p>POST <code className="bg-gray-100 px-1 rounded">/api/feishu/users/batch-get-id</code></p>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
{`{
  "access_token": "your_access_token",
  "mobiles": ["19857426673"],
  "emails": ["user@example.com"],
  "include_resigned": true
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
