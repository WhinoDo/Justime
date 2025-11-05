'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, User, LogOut, Shield, AlertCircle } from 'lucide-react'

export default function HomePage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const router = useRouter()

  // 处理登出
  const handleLogout = async () => {
    const result = await logout()
    if (result.success) {
      router.push('/')
    }
  }

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900">
              聚时
            </h1>
            <p className="text-lg text-gray-600">
              焦虑缓解与任务规划助手
            </p>
          </div>
          
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">正在检查登录状态...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            聚时
          </h1>
          <p className="text-lg text-gray-600">
            焦虑缓解与任务规划助手
          </p>
          <p className="text-sm text-gray-500">
            专为大学生设计的情绪-任务双驱动智能助手
          </p>
        </div>

        {/* 用户状态显示 */}
        {isAuthenticated && user ? (
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <User className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-600">已登录</span>
            </div>
            <p className="text-sm text-gray-600">
              欢迎回来，{user.name || user.email}
            </p>
            {user.feishu_binding && (
              <div className="flex items-center justify-center space-x-1 mt-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-blue-600">已绑定飞书账号</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-600">未登录</span>
            </div>
            <p className="text-sm text-yellow-700">
              请先登录以获得完整功能体验
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* 主要功能按钮 - 根据登录状态显示不同内容 */}
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="block">
                <Button className="w-full" size="lg">
                  进入工作台
                </Button>
              </Link>
              
              <Link href="/chat" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  直接开始对话
                </Button>
              </Link>

              <Link href="/feishu/calendar-management" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  📅 飞书日程管理
                </Button>
              </Link>

              <Link href="/profile" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  👤 个人信息
                </Button>
              </Link>

              <Link href="/chat/history" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  💬 聊天记录
                </Button>
              </Link>

              <Link href="/feishu/app-config" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  ⚙️ 飞书应用配置
                </Button>
              </Link>

              <Link href="/database/dashboard" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  📊 数据库仪表板
                </Button>
              </Link>

              <Button 
                variant="destructive" 
                className="w-full" 
                size="lg"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="block">
                <Button className="w-full" size="lg">
                  🔐 登录账户
                </Button>
              </Link>

              <Link href="/auth?mode=register" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  📝 注册账户
                </Button>
              </Link>

              <Link href="/feishu/qr-login" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  📱 飞书扫码登录
                </Button>
              </Link>

              {/* 未登录用户也可以体验的功能 */}
              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 mb-3">体验功能（无需登录）</p>
                <Link href="/chat" className="block">
                  <Button variant="ghost" className="w-full" size="sm">
                    直接开始对话
                  </Button>
                </Link>
              </div>
            </>
          )}

          <div className="text-xs text-gray-400">
            {isAuthenticated ? '已登录用户 - 享受完整功能' : 'MVP版本 - 部分功能无需注册'}
          </div>
        </div>

        <div className="space-y-2 text-xs text-gray-500">
          <p>✨ 智能情绪评估</p>
          <p>🎯 个性化任务拆解</p>
          <p>⏰ 番茄钟专注训练</p>
          <p>📊 成长数据分析</p>
        </div>
      </div>
    </div>
  )
} 