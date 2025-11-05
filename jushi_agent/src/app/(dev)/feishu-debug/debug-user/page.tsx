'use client'

import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function FeishuDebugUserPage() {
  const { isLoggedIn, userInfo, tokenInfo, isLoading } = useFeishuLogin()

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              飞书用户信息调试
            </h1>
            <p className="text-gray-600 mt-1">
              查看当前飞书登录状态和用户信息
            </p>
          </div>
          <Link href="/profile">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回个人信息
            </Button>
          </Link>
        </div>

        {/* 登录状态 */}
        <Card>
          <CardHeader>
            <CardTitle>登录状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">是否加载中</label>
                <p className="text-lg font-semibold">{isLoading ? '是' : '否'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">是否已登录</label>
                <p className="text-lg font-semibold">{isLoggedIn ? '是' : '否'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">有用户信息</label>
                <p className="text-lg font-semibold">{userInfo ? '是' : '否'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用户信息 */}
        <Card>
          <CardHeader>
            <CardTitle>用户信息 (userInfo)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(userInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* Token信息 */}
        <Card>
          <CardHeader>
            <CardTitle>Token信息 (tokenInfo)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(tokenInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* 绑定测试 */}
        {userInfo && (
          <Card>
            <CardHeader>
              <CardTitle>绑定数据预览</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                这是将要发送给绑定API的数据：
              </p>
              <pre className="bg-blue-50 p-4 rounded-lg overflow-auto text-sm border border-blue-200">
                {JSON.stringify({
                  openId: userInfo.openId,
                  unionId: userInfo.unionId,
                  name: userInfo.name,
                  avatar: userInfo.avatar,
                  email: userInfo.email,
                  mobile: userInfo.mobile
                }, null, 2)}
              </pre>
              
              <div className="mt-4 space-y-2">
                <h4 className="font-medium">字段验证：</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`p-2 rounded ${userInfo.openId ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    openId: {userInfo.openId ? '✓ 存在' : '✗ 缺失'}
                  </div>
                  <div className={`p-2 rounded ${userInfo.name ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    name: {userInfo.name ? '✓ 存在' : '✗ 缺失'}
                  </div>
                  <div className={`p-2 rounded ${userInfo.unionId ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    unionId: {userInfo.unionId ? '✓ 存在' : '- 可选'}
                  </div>
                  <div className={`p-2 rounded ${userInfo.email ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    email: {userInfo.email ? '✓ 存在' : '- 可选'}
                  </div>
                  <div className={`p-2 rounded ${userInfo.avatar ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    avatar: {userInfo.avatar ? '✓ 存在' : '- 可选'}
                  </div>
                  <div className={`p-2 rounded ${userInfo.mobile ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    mobile: {userInfo.mobile ? '✓ 存在' : '- 可选'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 本地存储信息 */}
        <Card>
          <CardHeader>
            <CardTitle>本地存储信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">feishu_session</label>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {typeof window !== 'undefined' ? localStorage.getItem('feishu_session') || 'null' : 'N/A (SSR)'}
                </pre>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">feishu_token</label>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {typeof window !== 'undefined' ? localStorage.getItem('feishu_token') || 'null' : 'N/A (SSR)'}
                </pre>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">feishu_login_status</label>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {typeof window !== 'undefined' ? localStorage.getItem('feishu_login_status') || 'null' : 'N/A (SSR)'}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
