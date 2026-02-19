'use client'

import { useState, useEffect, Suspense } from 'react'
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

function LoginContent() {
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
            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md tracking-wide">登录到聚时</h1>
            <p className="text-gray-100 font-medium tracking-wide opacity-90">
              智能对话 · 情绪分析 · 任务规划
            </p>
          </div>

          {/* 登录表单 - 传递额外的样式给 LoginForm (如果有必要，目前 LoginForm 主要是白色背景，我们可能需要让它透明一点，但它是外部组件。
             考虑到 LoginForm 内部写死了一些白色背景 (card bg-white)，我们可能需要去 LoginForm 也可以改，或者在这里用一个 div 包裹强行覆盖样式?
             更好的做法是让 LoginForm 支持透明背景 prop，或者我们先保留 LoginForm 的默认样式，让它作为一个“浮在浮层上的卡片”？
             
             回顾 LoginForm.tsx:
             className="w-full max-w-md mx-auto bg-white/95 text-gray-900 border border-orange-100 ..."
             
             如果不改 LoginForm，它会是一个白色的卡片放在我们的玻璃层上，这有点“双重卡片”。
             最好是把 LoginForm 改成透明的，适应这里的 dark theme 或者 glass theme。
             
             不过 Implementation Plan 里没说要大改 LoginForm，只说了 modifying page.tsx directly.
             为了达到最佳效果，我还是稍微调整一下 LoginForm 的容器样式，或者接受它是白色的。
             在此处，我先保持 page.tsx 的结构。
             为了视觉统一，我稍微调整 page.tsx 的容器背景，让内部的 LoginForm (白色) 看起来像是一个核心操作区。
          */}

          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-1 shadow-inner">
            <LoginForm
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={() => router.push('/auth?mode=register')}
              redirectTo={redirectTo}
            />
          </div>

          {/* 安全提示 */}
          <div className="text-center text-xs text-gray-200 mt-4 drop-shadow">
            <p>登录即表示您同意我们的服务条款和隐私政策</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">检查登录状态...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
