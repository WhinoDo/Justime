'use client'

import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function DebugBindingPage() {
  const { user: authUser, isAuthenticated, isLoading, refreshUser } = useAuth()

  const handleRefresh = () => {
    refreshUser()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !authUser) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-600">请先登录</p>
              <Link href="/auth">
                <Button className="mt-4">登录</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              飞书绑定状态调试
            </h1>
            <p className="text-gray-600 mt-1">
              查看当前用户的飞书绑定状态
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Link href="/profile">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回个人信息
              </Button>
            </Link>
          </div>
        </div>

        {/* 用户基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>用户基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">用户ID</label>
                <p className="text-lg font-semibold">{authUser.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">用户名</label>
                <p className="text-lg font-semibold">{authUser.username}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">邮箱</label>
                <p className="text-lg font-semibold">{authUser.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">显示名称</label>
                <p className="text-lg font-semibold">{authUser.displayName || '未设置'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 飞书绑定状态 */}
        <Card>
          <CardHeader>
            <CardTitle>飞书绑定状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">hasFeishuBinding</label>
                  <p className={`text-lg font-semibold ${authUser.hasFeishuBinding ? 'text-green-600' : 'text-red-600'}`}>
                    {String(authUser.hasFeishuBinding)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">feishuBinding 对象存在</label>
                  <p className={`text-lg font-semibold ${authUser.feishuBinding ? 'text-green-600' : 'text-red-600'}`}>
                    {String(!!authUser.feishuBinding)}
                  </p>
                </div>
              </div>

              {authUser.feishuBinding && (
                <div>
                  <h4 className="font-medium mb-2">飞书绑定详情</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-gray-500">OpenID</label>
                      <p className="font-mono break-all">{authUser.feishuBinding.openId || '未设置'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">UnionID</label>
                      <p className="font-mono break-all">{authUser.feishuBinding.unionId || '未设置'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">姓名</label>
                      <p>{authUser.feishuBinding.name || '未设置'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">邮箱</label>
                      <p>{authUser.feishuBinding.email || '未设置'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">手机号</label>
                      <p>{authUser.feishuBinding.mobile || '未设置'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">是否激活</label>
                      <p className={`font-semibold ${authUser.feishuBinding.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {String(authUser.feishuBinding.isActive)}
                      </p>
                    </div>
                    <div>
                      <label className="text-gray-500">绑定时间</label>
                      <p>{authUser.feishuBinding.bindTime ? new Date(authUser.feishuBinding.bindTime).toLocaleString('zh-CN') : '未设置'}</p>
                    </div>
                    <div>
                      <label className="text-gray-500">最后同步</label>
                      <p>{authUser.feishuBinding.lastSyncTime ? new Date(authUser.feishuBinding.lastSyncTime).toLocaleString('zh-CN') : '未设置'}</p>
                    </div>
                  </div>

                  {authUser.feishuBinding.avatar && (
                    <div className="mt-4">
                      <label className="text-gray-500 block mb-2">头像</label>
                      <img
                        src={authUser.feishuBinding.avatar}
                        alt="飞书头像"
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 完整用户对象 */}
        <Card>
          <CardHeader>
            <CardTitle>完整用户对象 (JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-xs">
              {JSON.stringify(authUser, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* 显示条件测试 */}
        <Card>
          <CardHeader>
            <CardTitle>显示条件测试</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gray-300"></span>
                <span>原条件 (authUser.hasFeishuBinding && authUser.feishuBinding):</span>
                <span className={`font-semibold ${(authUser.hasFeishuBinding && authUser.feishuBinding) ? 'text-green-600' : 'text-red-600'}`}>
                  {String(authUser.hasFeishuBinding && authUser.feishuBinding)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                <span>新条件 (authUser.feishuBinding && authUser.feishuBinding.openId):</span>
                <span className={`font-semibold ${(authUser.feishuBinding && authUser.feishuBinding.openId) ? 'text-green-600' : 'text-red-600'}`}>
                  {String(authUser.feishuBinding && authUser.feishuBinding.openId)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-green-500"></span>
                <span>推荐条件 (authUser.feishuBinding?.isActive):</span>
                <span className={`font-semibold ${authUser.feishuBinding?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {String(authUser.feishuBinding?.isActive)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
