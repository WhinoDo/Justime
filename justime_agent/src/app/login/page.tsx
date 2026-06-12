'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AuthPageShell, AuthStateShell } from '@/components/auth/AuthPageShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/hooks/useAuth'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [redirectTo, setRedirectTo] = useState<string>('/dashboard')

  useEffect(() => {
    const redirectParam = searchParams.get('redirect')
    if (redirectParam) {
      setRedirectTo(decodeURIComponent(redirectParam))
    }
  }, [searchParams])

  useAuthRedirect({
    isLoading: authLoading,
    isAuthenticated,
    redirectTo,
    mode: 'push',
  })

  const handleLoginSuccess = (user: any) => {
    console.log('登录成功:', user)
    // 登录成功后会自动跳转
  }

  if (authLoading) {
    return (
      <AuthStateShell>
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
          <p className="text-white/65">检查登录状态...</p>
        </div>
      </AuthStateShell>
    )
  }

  return (
    <AuthPageShell
      title="登录到矩时"
      subtitle="智能对话 · 情绪分析 · 任务规划"
      footer={(
        <div className="mt-4 text-center text-xs text-gray-200 drop-shadow">
          <p>登录即表示您同意我们的服务条款和隐私政策</p>
        </div>
      )}
    >
      <LoginForm
        onSuccess={handleLoginSuccess}
        onSwitchToRegister={() => router.push('/auth?mode=register')}
        redirectTo={redirectTo}
      />
    </AuthPageShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthStateShell>
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
          <p className="text-white/65">检查登录状态...</p>
        </div>
      </AuthStateShell>
    }>
      <LoginContent />
    </Suspense>
  )
}
