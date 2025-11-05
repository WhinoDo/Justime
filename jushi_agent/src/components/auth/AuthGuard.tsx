'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
  redirectTo?: string
  requireAuth?: boolean
  showLoginPrompt?: boolean
}

export function AuthGuard({ 
  children, 
  fallback,
  redirectTo = '/auth?mode=login',
  requireAuth = true,
  showLoginPrompt = true
}: AuthGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500">正在检查登录状态...</p>
        </div>
      </div>
    )
  }

  // 如果需要认证但未登录
  if (requireAuth && !isAuthenticated) {
    // 如果提供了自定义fallback，使用它
    if (fallback) {
      return <>{fallback}</>
    }

    // 如果需要重定向
    if (redirectTo) {
      useEffect(() => {
        router.push(redirectTo)
      }, [router, redirectTo])
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
            <p className="text-gray-600">正在重定向到登录页面...</p>
          </div>
        </div>
      )
    }

    // 如果显示登录提示
    if (showLoginPrompt) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md mx-auto text-center space-y-6 p-6">
            <div className="space-y-2">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
              <h2 className="text-xl font-semibold text-gray-900">需要登录</h2>
              <p className="text-gray-600">
                此功能需要登录才能使用，这样可以保存您的数据和个性化设置。
              </p>
            </div>
            
            <div className="space-y-3">
              <Link href="/auth?mode=login" className="block">
                <Button className="w-full">
                  立即登录
                </Button>
              </Link>
              
              <Link href="/auth?mode=register" className="block">
                <Button variant="outline" className="w-full">
                  注册账户
                </Button>
              </Link>
              
              <Link href="/feishu/qr-login" className="block">
                <Button variant="outline" className="w-full">
                  📱 飞书扫码登录
                </Button>
              </Link>
              
              <Link href="/" className="block">
                <Button variant="ghost" className="w-full">
                  返回首页
                </Button>
              </Link>
            </div>
            
            <div className="text-xs text-gray-500">
              <p>或者您可以先体验其他功能</p>
            </div>
          </div>
        </div>
      )
    }

    // 如果都不需要，返回null
    return null
  }

  // 已登录或不需要认证，显示内容
  return <>{children}</>
}

// 便捷的HOC组件
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<AuthGuardProps, 'children'>
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    )
  }
}
