'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User, 
  Mail, 
  Lock,
  ArrowRight,
  Feather,
  Shield,
  Info,
  ArrowLeft,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  
  const [feishuLoggedIn, setFeishuLoggedIn] = useState(false)
  const [redirectTo, setRedirectTo] = useState<string>('/')

  useEffect(() => {
    // 获取重定向参数
    const redirectParam = searchParams.get('redirect')
    if (redirectParam) {
      setRedirectTo(decodeURIComponent(redirectParam))
    }

    // 检查飞书登录状态
    setFeishuLoggedIn(FeishuTokenManager.isLoggedIn())

    // 如果用户已经通过某种方式登录，重定向
    if (isAuthenticated || feishuLoggedIn) {
      router.push(redirectTo)
    }
  }, [isAuthenticated, feishuLoggedIn, redirectTo, router])

  // 处理飞书登录
  const handleFeishuLogin = () => {
    FeishuLoginRedirect.redirectToLogin(true, redirectTo)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">检查登录状态...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* 返回按钮 */}
        <div className="flex justify-start">
          <Link href="/">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Button>
          </Link>
        </div>

        {/* 主登录卡片 */}
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">登录到菊事助手</CardTitle>
            <CardDescription>
              选择你的登录方式开始使用
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 飞书登录 - 推荐 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">推荐</Badge>
                <span className="text-sm font-medium text-gray-700">企业级认证</span>
              </div>
              <Button 
                onClick={handleFeishuLogin}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <Feather className="h-5 w-5 mr-3" />
                使用飞书账号登录
                <ArrowRight className="h-4 w-4 ml-3" />
              </Button>
              <p className="text-xs text-gray-500 text-center">
                安全、快速，支持单点登录和权限管理
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">或者</span>
              </div>
            </div>

            {/* 传统登录 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">传统认证</span>
              </div>
              <Link href="/auth?mode=login">
                <Button 
                  variant="outline" 
                  className="w-full h-12 border-gray-300"
                  size="lg"
                >
                  <User className="h-5 w-5 mr-3" />
                  用户名密码登录
                  <ArrowRight className="h-4 w-4 ml-3" />
                </Button>
              </Link>
              <p className="text-xs text-gray-500 text-center">
                使用传统的用户名和密码进行认证
              </p>
            </div>

            <Separator />

            {/* 注册入口 */}
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">还没有账号？</p>
              <Link href="/auth?mode=register">
                <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
                  创建新账号
                </Button>
              </Link>
            </div>

          </CardContent>
        </Card>

        {/* 功能说明 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-blue-800">
                <p className="font-medium">登录后你可以：</p>
                <ul className="space-y-1 text-blue-700">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    管理个人日程和任务
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    使用AI智能对话助手
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    同步飞书日历和通讯录
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    访问个性化数据面板
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 安全提示 */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            我们使用业界标准的安全协议保护你的账号信息。登录即表示你同意我们的隐私政策和服务条款。
          </AlertDescription>
        </Alert>

      </div>
    </div>
  )
}
