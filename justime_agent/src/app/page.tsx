'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Loader2, User, LogOut, Shield, ArrowRight } from 'lucide-react'
import { JustimeBackground } from '@/components/ui/JustimeBackground'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

// Register the useGSAP plugin
gsap.registerPlugin(useGSAP)

export default function HomePage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  // 处理登出
  const handleLogout = async () => {
    const result = await logout()
    if (result.success) {
      router.push('/')
    }
  }

  useGSAP(() => {
    if (isLoading) return

    // Stagger reveal animation for hero elements
    gsap.fromTo(".animate-reveal", 
      { y: 24, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.12, ease: "power3.out" }
    )
  }, { scope: containerRef, dependencies: [isLoading] })

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden">
        <JustimeBackground blur="xl" />
        <div className="relative z-10 w-full max-w-md space-y-8 text-center p-4">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              矩时
            </h1>
            <p className="text-lg text-white/80 font-light">
              Loading...
            </p>
          </div>
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden font-sans">
      <JustimeBackground blur="sm" opacity={0.3} />

      <div className="relative z-10 w-full max-w-lg">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-3xl p-8 space-y-8 text-center ring-1 ring-white/10">

          {/* Header */}
          <div className="space-y-4">
            <h1 className="animate-reveal text-5xl font-bold text-white tracking-tight drop-shadow-lg opacity-0">
              矩时
            </h1>
            <p className="animate-reveal text-xl text-white/90 font-medium tracking-wide opacity-0">
              智能情绪评估与任务规划助手
            </p>
            <p className="animate-reveal text-sm text-white/70 leading-relaxed max-w-xs mx-auto opacity-0">
              基于 AI 的情绪感知与自动化任务拆解，助你摆脱焦虑，高效行动。
            </p>
          </div>

          {/* User Status */}
          {isAuthenticated && user && (
            <div className="animate-reveal bg-black/20 rounded-2xl p-4 border border-white/10 backdrop-blur-sm opacity-0">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-white">已登录</span>
              </div>
              <p className="text-lg text-white font-semibold">
                Hi, {user.displayName || user.email}
              </p>
              {user.feishuBinding && (
                <div className="flex items-center justify-center space-x-1 mt-2 text-white/60">
                  <Shield className="h-3 w-3 text-blue-400" />
                  <span className="text-xs">已绑定飞书账号</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 pt-2">
            {/* Actions */}
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="animate-reveal block transform transition-transform hover:scale-[1.02] opacity-0">
                  <Button className="w-full h-12 text-lg bg-white text-gray-900 hover:bg-white/90 border-0 shadow-lg shadow-white/10 rounded-xl font-semibold">
                    进入工作台 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>

                <div className="animate-reveal grid grid-cols-2 gap-3 opacity-0">
                  <Link href="/profile" className="block">
                    <Button variant="outline" className="w-full h-11 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/40 hover:text-white rounded-xl">
                      个人信息
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    className="w-full h-11 bg-rose-500/20 text-rose-100 border border-rose-500/30 hover:bg-rose-500/30 rounded-xl"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    退出登录
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="animate-reveal block transform transition-transform hover:scale-[1.02] opacity-0">
                  <Button className="w-full h-12 text-lg bg-white text-gray-900 hover:bg-white/90 border-0 shadow-lg shadow-white/10 rounded-xl font-semibold">
                    立即登录
                  </Button>
                </Link>

                <Link href="/auth?mode=register" className="animate-reveal block transform transition-transform hover:scale-[1.02] opacity-0">
                  <Button variant="outline" className="w-full h-12 text-lg bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30 backdrop-blur-md rounded-xl">
                    注册账户
                  </Button>
                </Link>
              </>
            )}

            <div className="animate-reveal text-xs text-white/40 pt-4 font-mono tracking-widest uppercase opacity-0">
              {isAuthenticated ? 'Justime Agent System v1.0' : 'Emotion-Driven Task Agent'}
            </div>
          </div>

          {/* Features Footer */}
          <div className="animate-reveal grid grid-cols-2 gap-2 text-xs text-white/60 pt-2 border-t border-white/10 opacity-0">
            <p className="flex items-center justify-center gap-1">✨ 情绪评估</p>
            <p className="flex items-center justify-center gap-1">🎯 任务拆解</p>
            <p className="flex items-center justify-center gap-1">⏰ 专注训练</p>
            <p className="flex items-center justify-center gap-1">📊 数据分析</p>
          </div>
        </div>
      </div>
    </div>
  )
}