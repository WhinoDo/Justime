'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'

// 导入真正的认证组件
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { useAuth } from '@/hooks/useAuth'

export default function AuthPage() {
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [redirectTo, setRedirectTo] = useState<string>('/')

  useEffect(() => {
    // 从URL参数获取模式和重定向地址
    const modeParam = searchParams.get('mode')
    const redirectParam = searchParams.get('redirect')

    if (modeParam === 'register') {
      setMode('register')
    }

    if (redirectParam) {
      setRedirectTo(decodeURIComponent(redirectParam))
    }
  }, [searchParams])

  useEffect(() => {
    // 如果已经登录，重定向到目标页面
    if (isAuthenticated && !isLoading) {
      window.location.href = redirectTo
    }
  }, [isAuthenticated, isLoading, redirectTo])

  const handleAuthSuccess = (user: any) => {
    console.log('认证成功:', user)

    // 显示成功消息
    const action = mode === 'login' ? '登录' : '注册'
    console.log(`🎉 ${action}成功！欢迎 ${user.displayName || user.username}`)

    // 可以在这里添加用户状态管理逻辑
    // 例如：保存到localStorage、更新全局状态等

    // 表单组件会自动处理跳转
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <Sparkles className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          </div>
          <p className="text-gray-600">已登录，正在跳转...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* 全屏背景图 */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/jushi_login_bg.png"
          alt="Jushi Background"
          className="w-full h-full object-cover"
        />
        {/* 黑色遮罩，确保文字可读性 */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
      </div>

      {/* 磨砂玻璃容器 - 增强版 */}
      <div className="relative z-10 w-full max-w-md animate-slide-in">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-3xl p-8 space-y-6 text-white transform hover:scale-[1.01] transition-all duration-500">

          {/* 返回按钮 */}
          <div className="flex justify-start">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2 text-white hover:bg-white/20 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>

          {/* 品牌标识 */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-400/90 to-yellow-600/90 rounded-2xl shadow-xl flex items-center justify-center transform hover:rotate-6 transition-all duration-300 border border-white/30 backdrop-blur-md">
                <Sparkles className="h-10 w-10 text-white animate-pulse" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md tracking-wide">
              {mode === 'login' ? '登录到聚时' : '加入聚时'}
            </h1>
            <p className="text-gray-100 font-medium tracking-wide opacity-90">
              智能对话 · 情绪分析 · 任务规划
            </p>
          </div>

          {/* 认证表单容器 */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-1 shadow-inner text-gray-900">
            {mode === 'login' ? (
              <LoginForm
                onSuccess={handleAuthSuccess}
                onSwitchToRegister={() => setMode('register')}
                redirectTo={redirectTo}
              />
            ) : (
              <RegisterForm
                onSuccess={handleAuthSuccess}
                onSwitchToLogin={() => setMode('login')}
                redirectTo={redirectTo}
              />
            )}
          </div>

          <div className="text-center mt-2">
            <Button
              variant="link"
              className="text-white hover:text-orange-200"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? '没有账户？点击注册' : '已有账户？点击登录'}
            </Button>
          </div>

          {/* 底部信息 */}
          <div className="text-center mt-4 text-xs text-gray-200 drop-shadow">
            <p>© 2024 聚时AI助手. 保留所有权利.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
