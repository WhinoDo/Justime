'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

import { AuthPageShell, AuthStateShell } from '@/components/auth/AuthPageShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { useAuth } from '@/hooks/useAuth'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

function AuthContent() {
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [redirectTo, setRedirectTo] = useState<string>('/dashboard')

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

  useAuthRedirect({
    isLoading,
    isAuthenticated,
    redirectTo,
  })

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
      <AuthStateShell>
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          <p className="mt-4 text-white/65">加载中...</p>
        </div>
      </AuthStateShell>
    )
  }

  if (isAuthenticated) {
    return (
      <AuthStateShell>
        <div className="text-center">
          <div className="animate-pulse">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-amber-200" />
          </div>
          <p className="text-white/65">已登录，正在跳转...</p>
        </div>
      </AuthStateShell>
    )
  }

  return (
    <AuthPageShell
      title={mode === 'login' ? '登录到矩时' : '加入矩时'}
      subtitle="智能对话 · 情绪分析 · 任务规划"
      footer={(
        <>
          <div className="mt-2 text-center">
            <Button
              variant="link"
              className="text-white hover:text-orange-200"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? '没有账户？点击注册' : '已有账户？点击登录'}
            </Button>
          </div>

          <div className="mt-4 text-center text-xs text-gray-200 drop-shadow">
            <p>© 2024 矩时AI助手. 保留所有权利.</p>
          </div>
        </>
      )}
    >
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
    </AuthPageShell>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <AuthStateShell>
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          <p className="mt-4 text-white/65">加载中...</p>
        </div>
      </AuthStateShell>
    }>
      <AuthContent />
    </Suspense>
  )
}
