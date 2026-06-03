'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState, useRef } from 'react'
import {
  Loader2,
  MessageSquare,
  Calendar,
  History,
  Settings,
  User,
  Database,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { JustimeBackground } from '@/components/ui/JustimeBackground'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

// Register useGSAP plugin
gsap.registerPlugin(useGSAP)

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const [greeting, setGreeting] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 5) setGreeting('夜深了')
    else if (hour < 11) setGreeting('早上好')
    else if (hour < 13) setGreeting('中午好')
    else if (hour < 18) setGreeting('下午好')
    else setGreeting('晚上好')
  }, [])

  useGSAP(() => {
    if (isLoading) return

    // Animate the header section in
    gsap.from(".animate-header", {
      y: 20,
      autoAlpha: 0,
      duration: 0.6,
      ease: "power3.out"
    })

    // Stagger animate all dashboard cards
    gsap.from(".animate-card", {
      y: 30,
      autoAlpha: 0,
      duration: 0.8,
      stagger: 0.08,
      ease: "power3.out",
      clearProps: "all"
    })
  }, { scope: containerRef, dependencies: [isLoading] })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <JustimeBackground blur="xl" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-white/50" />
          <p className="text-white/60 text-sm font-light tracking-widest uppercase">Loading Workbench</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null
  const role = (user?.role || '').toString().toLowerCase()
  const isAdmin = role === 'admin'

  // 仪表盘功能卡片配置
  // Updated Colors: Lighter, more pastel/glass-friendly
  const cards = [
    {
      title: "AI 助手对话",
      description: "与矩时 AI 畅聊，获取即时帮助与情感支持",
      icon: MessageSquare,
      href: "/chat",
      color: "text-blue-200",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-400/30"
    },
    {
      title: "日程管理",
      description: "查看日历视图，规划您的时间与任务",
      icon: Calendar,
      href: "/calendar",
      color: "text-orange-200",
      bgColor: "bg-orange-500/20",
      borderColor: "border-orange-400/30"
    },
    {
      title: "聊天记录",
      description: "回顾历史对话，查找过往的灵感与建议",
      icon: History,
      href: "/chat/history",
      color: "text-purple-200",
      bgColor: "bg-purple-500/20",
      borderColor: "border-purple-400/30"
    },
    {
      title: "考研学习",
      description: "制定学习计划、追踪进度、管理复习节奏",
      icon: GraduationCap,
      href: "/study",
      color: "text-cyan-200",
      bgColor: "bg-cyan-500/20",
      borderColor: "border-cyan-400/30"
    },
    {
      title: "知识库",
      description: "管理个人文档，构建专属的知识体系",
      icon: Database,
      href: "/knowledge",
      color: "text-indigo-200",
      bgColor: "bg-indigo-500/20",
      borderColor: "border-indigo-400/30"
    },

    {
      title: "模型配置",
      description: "自定义 AI 模型参数与 API 设置",
      icon: Settings,
      href: "/model-config?from=/dashboard",
      color: "text-emerald-200",
      bgColor: "bg-emerald-500/20",
      borderColor: "border-emerald-400/30"
    },
    {
      title: "个人中心",
      description: "管理账户信息与个人偏好设置",
      icon: User,
      href: "/profile",
      color: "text-rose-200",
      bgColor: "bg-rose-500/20",
      borderColor: "border-rose-400/30"
    },
    ...(isAdmin ? [{
      title: "后台管理",
      description: "查看系统概览并管理用户与模型配置",
      icon: ShieldCheck,
      href: "/admin",
      color: "text-amber-200",
      bgColor: "bg-amber-500/20",
      borderColor: "border-amber-400/30"
    }] : [])
  ]

  return (
    <div ref={containerRef} className="min-h-screen relative overflow-hidden font-sans">
      <JustimeBackground blur="lg" opacity={0.5} />

      <div className="relative z-10 container mx-auto px-6 py-12 max-w-6xl">

        {/* Header Section */}
        <div className="animate-header mb-12 space-y-2 opacity-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Sparkles className="h-6 w-6 text-yellow-200 animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
            {greeting}，{user?.username || '朋友'}
          </h1>
          <p className="text-lg text-white/70 font-light">
            准备好开始高效的一天了吗？
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <Link
              key={index}
              href={card.href}
              className="animate-card group block relative opacity-0"
            >
              <div className={cn(
                "h-full p-6 rounded-3xl border shadow-xl relative overflow-hidden",
                "bg-white/10 backdrop-blur-xl border-white/20",
                "transition-all duration-300 ease-out",
                "hover:scale-[1.02] hover:bg-white/20",
                "hover:shadow-2xl hover:border-white/30",
                "flex flex-col justify-between group"
              )}>
                {/* Glow Effect */}
                <div className={cn(
                  "absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-40 transition-opacity duration-500",
                  card.bgColor.replace('/20', '')
                )} />

                <div className="relative z-10">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl mb-5 flex items-center justify-center transition-transform group-hover:scale-110 duration-300 shadow-inner",
                    card.bgColor,
                    card.borderColor,
                    "border border-white/10"
                  )}>
                    <card.icon className={cn("w-6 h-6", card.color)} strokeWidth={2} />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 tracking-tight group-hover:text-white transition-colors">
                    {card.title}
                  </h3>

                  <p className="text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">
                    {card.description}
                  </p>
                </div>

                <div className="relative z-10 mt-8 flex items-center text-sm font-medium text-white/40 group-hover:text-white transition-colors">
                  <span>立即进入</span>
                  <ArrowRight className="w-4 h-4 ml-2 transform transition-transform group-hover:translate-x-1 opacity-50 group-hover:opacity-100" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center animate-card opacity-0">
          <p className="text-xs text-white/30 font-mono tracking-widest uppercase">
            JUSTIME WORKBENCH v0.5.0
          </p>
        </div>

      </div>
    </div>
  )
}
