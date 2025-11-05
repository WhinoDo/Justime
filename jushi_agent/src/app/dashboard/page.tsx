'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500">正在检查登录状态...</p>
        </div>
      </div>
    )
  }

  // 如果未登录，重定向到登录页面
  if (!isAuthenticated) {
    useEffect(() => {
      router.push('/auth?mode=login&redirect=/dashboard')
    }, [router])
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
          <p className="text-gray-600">正在重定向到登录页面...</p>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            聚时工作台
          </h1>
          <p className="text-gray-600">
            欢迎使用聚时，您的智能学习助手
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* AI对话卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                💬
              </div>
              <h2 className="text-lg font-semibold">AI助手对话</h2>
            </div>
            <p className="text-gray-600 mb-4">
              与聚时AI助手聊天，获得情绪支持和任务指导
            </p>
            <Link href="/chat">
              <Button className="w-full">开始对话</Button>
            </Link>
          </div>

          {/* 飞书日程管理卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                📅
              </div>
              <h2 className="text-lg font-semibold">飞书日程管理</h2>
            </div>
            <p className="text-gray-600 mb-4">
              管理您的飞书日程，查看今日安排和创建新事件
            </p>
            <Link href="/feishu/calendar">
              <Button variant="outline" className="w-full">
                进入日程管理
              </Button>
            </Link>
          </div>

          {/* 任务管理卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                ✅
              </div>
              <h2 className="text-lg font-semibold">任务管理</h2>
            </div>
            <p className="text-gray-600 mb-4">
              管理您的任务和子任务，跟踪完成进度
            </p>
            <Button variant="outline" className="w-full" disabled>
              即将推出
            </Button>
          </div>

          {/* 情绪追踪卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                📊
              </div>
              <h2 className="text-lg font-semibold">情绪分析</h2>
            </div>
            <p className="text-gray-600 mb-4">
              查看您的情绪趋势和成长数据
            </p>
            <Button variant="outline" className="w-full" disabled>
              即将推出
            </Button>
          </div>

          {/* 番茄钟卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                ⏰
              </div>
              <h2 className="text-lg font-semibold">专注计时</h2>
            </div>
            <p className="text-gray-600 mb-4">
              使用番茄钟技术提升专注力
            </p>
            <Button variant="outline" className="w-full" disabled>
              即将推出
            </Button>
          </div>

          {/* 成长笔记卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                📝
              </div>
              <h2 className="text-lg font-semibold">成长笔记</h2>
            </div>
            <p className="text-gray-600 mb-4">
              记录学习心得和成长感悟
            </p>
            <Button variant="outline" className="w-full" disabled>
              即将推出
            </Button>
          </div>

          {/* 设置卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                ⚙️
              </div>
              <h2 className="text-lg font-semibold">个人设置</h2>
            </div>
            <p className="text-gray-600 mb-4">
              配置您的偏好和高效时段
            </p>
            <Button variant="outline" className="w-full" disabled>
              即将推出
            </Button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            🚀 这是聚时MVP版本，更多功能正在开发中...
          </p>
        </div>
      </div>
    </div>
  )
} 