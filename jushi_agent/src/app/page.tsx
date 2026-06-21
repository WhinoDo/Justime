'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, User, LogOut, Shield, ArrowRight, Sparkles } from 'lucide-react'

export default function HomePage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    const result = await logout()
    if (result.success) router.push('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">聚时</h1>
          <p className="text-gray-500 dark:text-gray-400 font-light">Loading...</p>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
      <div className="relative z-10 w-full max-w-sm animate-mac-slide-in">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)] rounded-2xl p-8 space-y-8 text-center">

          {/* macOS-style icon */}
          <div className="space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
              聚时
            </h1>
            <div>
              <p className="text-base text-gray-600 dark:text-gray-300 font-medium">
                智能情绪评估与任务规划助手
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 leading-relaxed max-w-xs mx-auto">
                基于 AI 的情绪感知与自动化任务拆解，助你摆脱焦虑，高效行动。
              </p>
            </div>
          </div>

          {/* User Status */}
          {isAuthenticated && user && (
            <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4 border border-purple-200 dark:border-purple-500/20">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <Shield className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs font-medium text-green-700 dark:text-green-300">已登录</span>
              </div>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                Hi, {user.displayName || user.email}
              </p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="block mac-btn-press">
                  <Button className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white shadow-sm rounded-xl font-medium">
                    进入工作台 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>

                <div className="grid grid-cols-2 gap-3">
                  <Link href="/profile">
                    <Button variant="outline" className="w-full h-10 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm">
                      个人信息
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    className="w-full h-10 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl text-sm"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-1.5" />退出
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="block mac-btn-press">
                  <Button className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white shadow-sm rounded-xl font-medium">
                    立即登录
                  </Button>
                </Link>
                <Link href="/auth?mode=register" className="block mac-btn-press">
                  <Button variant="outline" className="w-full h-11 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl">
                    注册账户
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 dark:text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-800">
            <span>✨ 情绪评估</span>
            <span>🎯 任务拆解</span>
            <span>⏰ 专注训练</span>
            <span>📊 数据分析</span>
          </div>

          <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono tracking-widest uppercase pt-1">
            Jushi Agent System v1.0
          </div>
        </div>
      </div>
    </div>
  )
}
