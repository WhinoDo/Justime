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
  Sparkles,
  ShieldCheck,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm font-light tracking-widest uppercase">Loading Workbench</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null
  const role = (user?.role || '').toString().toLowerCase()
  const isAdmin = role === 'admin'

  // macOS 偏好设置风格功能卡片
  const cards = [
    {
      title: "AI 助手对话",
      description: "与矩时 AI 畅聊，获取即时帮助与情感支持",
      icon: MessageSquare,
      href: "/chat",
    },
    {
      title: "日程管理",
      description: "查看日历视图，规划您的时间与任务",
      icon: Calendar,
      href: "/calendar",
    },
    {
      title: "聊天记录",
      description: "回顾历史对话，查找过往的灵感与建议",
      icon: History,
      href: "/chat/history",
    },
    {
      title: "考研学习",
      description: "制定学习计划、追踪进度、管理复习节奏",
      icon: GraduationCap,
      href: "/study",
    },
    {
      title: "知识库",
      description: "管理个人文档，构建专属的知识体系",
      icon: Database,
      href: "/knowledge",
    },
    {
      title: "模型配置",
      description: "自定义 AI 模型参数与 API 设置",
      icon: Settings,
      href: "/model-config?from=/dashboard",
    },
    {
      title: "个人中心",
      description: "管理账户信息与个人偏好设置",
      icon: User,
      href: "/profile",
    },
    ...(isAdmin ? [{
      title: "后台管理",
      description: "查看系统概览并管理用户与模型配置",
      icon: ShieldCheck,
      href: "/admin",
    }] : [])
  ]

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-8 py-10 animate-in fade-in duration-500">

        {/* macOS 风格问候语 */}
        <div className="animate-header mb-10 opacity-0">
          <h1 className="font-semibold text-2xl text-[var(--foreground)]">
            {greeting}，{user?.username || '朋友'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            准备好开始高效的一天了吗？
          </p>
        </div>

        {/* macOS 偏好设置风格网格 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cards.map((card, index) => (
            <Link
              key={index}
              href={card.href}
              className="animate-card block opacity-0"
            >
              <div className={cn(
                "flex flex-col items-center justify-center gap-3 p-5 rounded-xl bg-card border border-border",
                "transition-all duration-200 ease-mac",
                "hover:scale-[1.02] hover:shadow-mac hover:border-accent/50",
                "active:scale-[0.98]",
                "animate-in fade-in slide-in-from-bottom-2 duration-300"
              )}>
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent">
                  <card.icon className="h-8 w-8 text-accent-foreground" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <h3 className="text-sm font-medium text-foreground">
                    {card.title}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center animate-card opacity-0">
          <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">
            JUSTIME WORKBENCH v0.5.0
          </p>
        </div>

      </div>
    </div>
  )
}
