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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 顶部导航 */}
      <div className="absolute top-4 left-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </Link>
      </div>

      {/* 主要内容 */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          {/* 品牌标识 */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">聚时AI助手</h1>
            </div>
            <p className="text-gray-600">
              智能对话 · 情绪分析 · 任务规划 · 日程管理
            </p>
          </div>

          {/* 认证表单 */}
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

          <div className="text-center mt-4">
            <Button
              variant="link"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? '没有账户？点击注册' : '已有账户？点击登录'}
            </Button>
          </div>

          {/* 底部信息 */}
          <div className="text-center mt-8 text-sm text-gray-500">
            <p>© 2024 聚时AI助手. 保留所有权利.</p>
            <div className="flex justify-center space-x-4 mt-2">
              <Button variant="link" className="p-0 h-auto text-xs text-gray-500 hover:text-gray-700">
                服务条款
              </Button>
              <Button variant="link" className="p-0 h-auto text-xs text-gray-500 hover:text-gray-700">
                隐私政策
              </Button>
              <Button variant="link" className="p-0 h-auto text-xs text-gray-500 hover:text-gray-700">
                帮助中心
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200 rounded-full opacity-20 animate-pulse delay-1000"></div>
      </div>
    </div>
  )
}
