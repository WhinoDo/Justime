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

          {/* 日历管理卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                📅
              </div>
              <h2 className="text-lg font-semibold">日历管理</h2>
            </div>
            <p className="text-gray-600 mb-4">
              管理您的日程安排，查看今日任务和创建新事件
            </p>
            <Link href="/calendar">
              <Button className="w-full bg-orange-600 hover:bg-orange-700">
                进入日历
              </Button>
            </Link>
          </div>

          {/* 数据统计卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                📊
              </div>
              <h2 className="text-lg font-semibold">数据统计</h2>
            </div>
            <p className="text-gray-600 mb-4">
              查看您的对话数据、情绪分析和学习统计
            </p>
            <Link href="/database/dashboard">
              <Button variant="outline" className="w-full">
                查看数据
              </Button>
            </Link>
          </div>

          {/* 聊天记录卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                📝
              </div>
              <h2 className="text-lg font-semibold">聊天记录</h2>
            </div>
            <p className="text-gray-600 mb-4">
              查看历史对话记录和消息
            </p>
            <Link href="/chat/history">
              <Button variant="outline" className="w-full">
                查看记录
              </Button>
            </Link>
          </div>

          {/* 模型配置卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                🤖
              </div>
              <h2 className="text-lg font-semibold">模型配置</h2>
            </div>
            <p className="text-gray-600 mb-4">
              配置AI模型参数和API设置
            </p>
            <Link href="/model-config">
              <Button variant="outline" className="w-full">
                配置模型
              </Button>
            </Link>
          </div>

          {/* 个人资料卡片 */}
          <div className="task-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                👤
              </div>
              <h2 className="text-lg font-semibold">个人资料</h2>
            </div>
            <p className="text-gray-600 mb-4">
              管理您的个人信息和账户设置
            </p>
            <Link href="/profile">
              <Button variant="outline" className="w-full">
                查看资料
              </Button>
            </Link>
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