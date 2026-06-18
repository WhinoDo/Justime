'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Loader2, User, LogOut, Shield, ArrowRight, LogIn } from 'lucide-react'

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div className="text-center animate-fade-in">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600 bg-clip-text text-transparent">
            Justime
          </h1>
          <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-purple-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 overflow-hidden">
      {isAuthenticated ? (
        /* 已登录状态 - 白紫主题面板 */
        <div className="relative z-10 w-full max-w-lg animate-fade-in">
          <div className="bg-white border border-purple-100 shadow-lg shadow-purple-100/50 rounded-3xl p-8 space-y-8 text-center">

            {/* Header */}
            <div className="space-y-4">
              <h1 className="text-5xl font-bold text-purple-900 tracking-tight">
                聚时
              </h1>
              <p className="text-xl text-purple-700 font-medium tracking-wide">
                智能情绪评估与任务规划助手
              </p>
              <p className="text-sm text-purple-400 leading-relaxed max-w-xs mx-auto">
                基于 AI 的情绪感知与自动化任务拆解，助你摆脱焦虑，高效行动。
              </p>
            </div>

            {/* User Status */}
            {user && (
              <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-sm font-medium text-purple-700">已登录</span>
                </div>
                <p className="text-lg text-purple-900 font-semibold">
                  Hi, {user.displayName || user.email}
                </p>
                {user.feishuBinding && (
                  <div className="flex items-center justify-center space-x-1 mt-2 text-purple-400">
                    <Shield className="h-3 w-3 text-blue-400" />
                    <span className="text-xs">已绑定飞书账号</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4 pt-2">
              <Link href="/dashboard" className="block transform transition-transform hover:scale-[1.02]">
                <Button className="w-full h-12 text-lg bg-purple-600 text-white hover:bg-purple-700 border-0 shadow-lg shadow-purple-200 rounded-xl font-semibold">
                  进入工作台 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <div className="grid grid-cols-2 gap-3">
                <Link href="/profile" className="block">
                  <Button variant="outline" className="w-full h-11 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 rounded-xl">
                    个人信息
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  className="w-full h-11 bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200 rounded-xl"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出登录
                </Button>
              </div>

              <div className="text-xs text-purple-300 pt-4 font-mono tracking-widest uppercase">
                Justime Agent System v1.0
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-purple-400 pt-2 border-t border-purple-100">
              <p className="flex items-center justify-center gap-1">✨ 情绪评估</p>
              <p className="flex items-center justify-center gap-1">🎯 任务拆解</p>
              <p className="flex items-center justify-center gap-1">⏰ 专注训练</p>
              <p className="flex items-center justify-center gap-1">📊 数据分析</p>
            </div>
          </div>
        </div>
      ) : (
        /* 未登录状态 - 极简 macOS 风格欢迎页 */
        <div className="text-center animate-fade-in">
          {/* 动态 Justime 标题 */}
          <div className="relative">
            <h1 className="text-7xl sm:text-8xl font-bold bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600 bg-clip-text text-transparent animate-gradient-x tracking-tight">
              Justime
            </h1>
            {/* 柔和发光效果 */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-200/30 via-purple-300/20 to-purple-200/30 rounded-full blur-3xl -z-10 animate-breathing" />
          </div>

          {/* 副标题 */}
          <p className="mt-4 text-sm text-gray-400 font-light tracking-[0.2em] uppercase">
            智能情绪评估与任务规划助手
          </p>

          {/* 小图标登录入口 */}
          <div
            className="mt-12 animate-fade-in"
            style={{ animationDelay: '0.6s', animationFillMode: 'both' }}
          >
            <Link
              href="/auth?mode=login"
              className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-purple-200 text-purple-400 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all duration-300 group"
            >
              <LogIn className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
            </Link>
            <p className="mt-2 text-xs text-gray-300">点击登录</p>
          </div>
        </div>
      )}
    </div>
  )
}
