'use client'

import { useState } from 'react'
import QRLogin from '@/components/feishu/QRLogin'
import SimpleQRLogin from '@/components/feishu/SimpleQRLogin'
import DjangoStyleQRLogin from '@/components/feishu/DjangoStyleQRLogin'
import SimpleFeishuLogin from '@/components/feishu/SimpleFeishuLogin'
import ReactStyleQRLogin from '@/components/feishu/ReactStyleQRLogin'
import UltraSafeQRLogin from '@/components/feishu/UltraSafeQRLogin'
import OptimizedQRLogin from '@/components/feishu/OptimizedQRLogin'
import UltimateQRLogin from '@/components/feishu/UltimateQRLogin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface TokenInfo {
  accessToken: string
  refreshToken: string
  tokenType: string
}

interface UserInfo {
  name: string
  openId: string
  userId: string
  tenantKey: string
  avatarUrl: string
}

export default function TestQRPage() {
  const [loginResult, setLoginResult] = useState<{
    tokenInfo?: TokenInfo
    userInfo?: UserInfo
    error?: string
  } | null>(null)

  const handleLoginSuccess = (tokenInfo: TokenInfo, userInfo: UserInfo) => {
    console.log('登录成功:', { tokenInfo, userInfo })
    setLoginResult({ tokenInfo, userInfo })
  }

  const handleLoginError = (error: string) => {
    console.error('登录失败:', error)
    setLoginResult({ error })
  }

  const resetTest = () => {
    setLoginResult(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            二维码登录测试
          </h1>
          <p className="text-gray-600">
            测试修复后的飞书扫码登录组件
          </p>
        </div>

        <div className="space-y-8">
          {/* 终极版登录组件 - 100%避免DOM操作冲突 */}
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">🛡️ 终极版飞书登录</h2>
            <p className="text-center text-gray-600 mb-6">100%避免DOM操作冲突，绝对安全的版本</p>
            <UltimateQRLogin
              onLoginSuccess={handleLoginSuccess}
              onLoginError={handleLoginError}
            />
          </div>

          {/* 其他版本对比 */}
          <details className="border rounded-lg p-4">
            <summary className="cursor-pointer font-semibold text-lg mb-4">查看其他版本对比</summary>

            <div className="grid lg:grid-cols-2 gap-6 mt-4">
              {/* 优化版登录组件 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">优化版本 (基于Django+React)</h3>
                <OptimizedQRLogin
                  onLoginSuccess={handleLoginSuccess}
                  onLoginError={handleLoginError}
                />
              </div>

              {/* 超级安全登录组件 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">超级安全版本</h3>
                <UltraSafeQRLogin
                  onLoginSuccess={handleLoginSuccess}
                  onLoginError={handleLoginError}
                />
              </div>
            </div>
          </details>

          {/* 测试结果 */}
          <div>
            <h2 className="text-xl font-semibold mb-4">测试结果</h2>
            <Card>
              <CardHeader>
                <CardTitle>登录状态</CardTitle>
              </CardHeader>
              <CardContent>
                {!loginResult && (
                  <p className="text-gray-500">等待登录...</p>
                )}

                {loginResult?.error && (
                  <div className="text-red-600">
                    <p className="font-medium">登录失败:</p>
                    <p className="text-sm">{loginResult.error}</p>
                  </div>
                )}

                {loginResult?.userInfo && (
                  <div className="space-y-3">
                    <div className="text-green-600">
                      <p className="font-medium">登录成功!</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium">用户信息:</h4>
                      <div className="text-sm space-y-1 mt-2">
                        <p><span className="font-medium">姓名:</span> {loginResult.userInfo.name}</p>
                        <p><span className="font-medium">OpenID:</span> {loginResult.userInfo.openId}</p>
                        <p><span className="font-medium">租户:</span> {loginResult.userInfo.tenantKey}</p>
                      </div>
                    </div>

                    {loginResult.tokenInfo && (
                      <div>
                        <h4 className="font-medium">令牌信息:</h4>
                        <div className="text-sm space-y-1 mt-2">
                          <p><span className="font-medium">类型:</span> {loginResult.tokenInfo.tokenType}</p>
                          <p><span className="font-medium">访问令牌:</span> {loginResult.tokenInfo.accessToken.substring(0, 20)}...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {loginResult && (
                  <div className="mt-4">
                    <Button onClick={resetTest} variant="outline" size="sm">
                      重置测试
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 调试信息 */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>调试信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-2">
                  <p><span className="font-medium">SDK状态:</span> {typeof window !== 'undefined' && window.QRLogin ? '已加载' : '未加载'}</p>
                  <p><span className="font-medium">当前URL:</span> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
                  <p><span className="font-medium">时间戳:</span> {new Date().toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
