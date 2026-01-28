'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Loader2,
  AlertCircle,
  MessageSquare,
  Calendar,
  History,
  Settings,
  User,
  Database,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 5) setGreeting('夜深了')
    else if (hour < 11) setGreeting('早上好')
    else if (hour < 13) setGreeting('中午好')
    else if (hour < 18) setGreeting('下午好')
    else setGreeting('晚上好')
  }, [])

  // 认证重定向逻辑
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth?mode=login&redirect=/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  // 仪表盘功能卡片配置
  const cards = [
    {
      title: "AI 助手对话",
      description: "与聚时 AI 畅聊，获取即时帮助与情感支持",
      icon: MessageSquare,
      href: "/chat",
      color: "text-blue-600",
      bgColor: "bg-blue-100/50",
      gradient: "from-blue-500/10 to-blue-600/10"
    },
    {
      title: "日程管理",
      description: "查看日历视图，规划您的时间与任务",
      icon: Calendar,
      href: "/calendar",
      color: "text-orange-600",
      bgColor: "bg-orange-100/50",
      gradient: "from-orange-500/10 to-orange-600/10"
    },
    {
      title: "聊天记录",
      description: "回顾历史对话，查找过往的灵感与建议",
      icon: History,
      href: "/chat/history",
      color: "text-purple-600",
      bgColor: "bg-purple-100/50",
      gradient: "from-purple-500/10 to-purple-600/10"
    },
    {
      title: "知识库",
      description: "管理个人文档，构建专属的知识体系",
      icon: Database,
      href: "/knowledge",
      color: "text-indigo-600",
      bgColor: "bg-indigo-100/50",
      gradient: "from-indigo-500/10 to-indigo-600/10"
    },
    {
      title: "模型配置",
      description: "自定义 AI 模型参数与 API 设置",
      icon: Settings,
      href: "/model-config?from=/dashboard",
      color: "text-green-600",
      bgColor: "bg-green-100/50",
      gradient: "from-green-500/10 to-green-600/10"
    },
    {
      title: "个人中心",
      description: "管理账户信息与个人偏好设置",
      icon: User,
      href: "/profile",
      color: "text-gray-600",
      bgColor: "bg-gray-100/50",
      gradient: "from-gray-500/10 to-gray-600/10"
    }
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50 dark:bg-gray-900 font-sans selection:bg-blue-100">

      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-400/20 blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-400/20 blur-[100px] animate-pulse-slow delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-12 max-w-6xl">

        {/* Header Section */}
        <div className="mb-12 space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {greeting}，{user?.username || '朋友'}
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 font-medium">
            准备好开始高效的一天了吗？
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <Link
              key={index}
              href={card.href}
              className="group block relative"
            >
              <div className={cn(
                "h-full p-6 rounded-2xl border border-white/20 shadow-xl",
                "bg-white/40 dark:bg-gray-800/40 backdrop-blur-md",
                "transition-all duration-300 ease-out",
                "hover:scale-[1.02] hover:bg-white/60 dark:hover:bg-gray-800/60",
                "hover:shadow-2xl hover:border-white/40",
                "flex flex-col justify-between"
              )}>
                {/* Subtle Gradient Overlay on Hover */}
                <div className={cn(
                  "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br",
                  card.gradient
                )} />

                <div className="relative z-10">
                  <div className={cn(
                    "w-12 h-12 rounded-xl mb-4 flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
                    card.bgColor,
                    card.color
                  )}>
                    <card.icon className="w-6 h-6" strokeWidth={2.5} />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                    {card.title}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="relative z-10 mt-6 flex items-center text-sm font-semibold text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  <span>立即进入</span>
                  <ArrowRight className="w-4 h-4 ml-1 transform transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-gray-400/60 font-mono">
            JUSHI AGENT WORKBENCH v0.5.0
          </p>
        </div>

      </div>
    </div>
  )
}