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
  GraduationCap,
  Sparkles,
  ShieldCheck,
  FolderKanban
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

// Register useGSAP plugin
gsap.registerPlugin(useGSAP)

function getDesktopCardColor(title: string) {
  switch (title) {
    case 'AI 助手对话': return { bg: 'bg-blue-100', text: 'text-blue-700' }
    case '日程管理': return { bg: 'bg-orange-100', text: 'text-orange-700' }
    case '聊天记录': return { bg: 'bg-purple-100', text: 'text-purple-700' }
    case '任务驾驶舱': return { bg: 'bg-indigo-100', text: 'text-indigo-700' }
    case '知识库': return { bg: 'bg-emerald-100', text: 'text-emerald-700' }
    case '模型配置': return { bg: 'bg-sky-100', text: 'text-sky-700' }
    case '个人中心': return { bg: 'bg-rose-100', text: 'text-rose-700' }
    case '后台管理': return { bg: 'bg-amber-100', text: 'text-amber-700' }
    default: return { bg: 'bg-violet-100', text: 'text-violet-700' }
  }
}

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const [greeting, setGreeting] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const { isDesktop } = useDesktopRuntime()

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
    gsap.fromTo(".animate-header", 
      { y: 20, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" }
    )

    // Stagger animate all dashboard cards
    gsap.fromTo(".animate-card", 
      { y: 30, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08, ease: "power3.out" }
    )
  }, { scope: containerRef, dependencies: [isLoading] })

  if (isLoading && isDesktop) {
    return (
      <JustimePageShell fullHeight variant="desktop" blur="none" opacity={0} contentClassName="flex items-center justify-center">
        <div className="rounded-2xl border border-violet-200/[0.45] bg-white/[0.68] px-6 py-5 text-center shadow-[0_24px_80px_rgba(112,77,171,0.14)] backdrop-blur-2xl">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-violet-500" />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Loading Workbench</p>
        </div>
      </JustimePageShell>
    )
  }

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
      description: "与 Justime AI 畅聊，获取即时帮助与情感支持",
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

  if (isDesktop) {
    return (
      <JustimePageShell fullHeight variant="desktop" blur="none" opacity={0} contentClassName="flex flex-col px-6 py-8 desktop-scrollbar">
        <div ref={containerRef} className="mx-auto flex w-full max-w-6xl flex-1 flex-col min-h-0">
          <div className="mb-8 shrink-0 rounded-3xl border border-violet-200/[0.45] bg-white/[0.66] p-7 shadow-[0_24px_80px_rgba(112,77,171,0.12)] backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-200/50 bg-white/70 text-violet-600 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-[#171421]">
                  {greeting}，{user?.username || '朋友'}
                </h1>
                <p className="mt-1 text-sm text-[#6d6680]">今天的任务、日程和知识入口都在这里。</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
              {cards.map((card, index) => {
                const desktopColors = getDesktopCardColor(card.title)
                return (
                  <Link key={index} href={card.href} className="group block">
                    <div className="h-full rounded-2xl border border-violet-200/[0.45] bg-white/[0.64] p-5 shadow-[0_18px_60px_rgba(112,77,171,0.10)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-violet-300/70 hover:bg-white/[0.82]">
                      <div className="flex items-start justify-between gap-4">
                        <div className={cn('rounded-xl p-2.5', desktopColors.bg)}>
                          <card.icon className={cn('h-5 w-5', desktopColors.text)} />
                        </div>
                        <ArrowRight className="h-4 w-4 text-[#8b7aa8] transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
                      </div>
                      <h2 className="mt-4 text-base font-semibold text-[#171421]">{card.title}</h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6d6680]">{card.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="shrink-0 pt-4 text-center">
            <p className="text-xs text-[#8b7aa8] font-mono tracking-widest uppercase">
              JUSTIME WORKBENCH v0.5.0
            </p>
          </div>
        </div>
      </JustimePageShell>
    )
  }

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
