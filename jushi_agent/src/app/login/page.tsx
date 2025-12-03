'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  Info,
  ArrowLeft,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [redirectTo, setRedirectTo] = useState<string>('/')

  useEffect(() => {
    // 获取重定向参数
    const redirectParam = searchParams.get('redirect')
    if (redirectParam) {
      setRedirectTo(decodeURIComponent(redirectParam))
    }

    // 如果用户已经登录，重定向
    if (isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isAuthenticated, redirectTo, router])

  const handleLoginSuccess = (user: any) => {
    console.log('登录成功:', user)
    // 登录成功后会自动跳转
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">检查登录状态...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gray-50">
      {/* 动态背景 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* 磨砂玻璃容器 */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/30 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-8 space-y-6">

          {/* 返回按钮 */}
          <div className="flex justify-start">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:bg-white/20">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>

          {/* 品牌标识 */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-2xl shadow-lg flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">登录到聚时助手</h1>
            <p className="text-gray-600">
              智能对话 · 情绪分析 · 任务规划
            </p>
          </div>

          {/* 登录表单 */}
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToRegister={() => router.push('/auth?mode=register')}
            redirectTo={redirectTo}
          />

          {/* 安全提示 */}
          <div className="text-center text-xs text-gray-500 mt-4">
            <p>登录即表示您同意我们的服务条款和隐私政策</p>
          </div>
        </div>
      </div>
    </div>
  )
}
