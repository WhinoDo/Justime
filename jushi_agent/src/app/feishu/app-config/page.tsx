'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { FeishuAppConfig } from '@/components/feishu/FeishuAppConfig'
import { chatDB } from '@/lib/database/ChatDatabaseIntegration'
import {
  Settings,
  ExternalLink,
  BookOpen,
  Shield,
  Key,
  AlertTriangle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

export default function FeishuAppConfigPage() {
  const { isLoggedIn, userInfo } = useFeishuLogin()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [urlMessage, setUrlMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  useEffect(() => {
    if (isLoggedIn) {
      initializeUser()
    } else {
      setLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success) {
      setUrlMessage({ type: 'success', message: success })
      // 清除URL参数
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      window.history.replaceState({}, '', url.toString())
    } else if (error) {
      setUrlMessage({ type: 'error', message: error })
      // 清除URL参数
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  const initializeUser = async () => {
    try {
      const user = await chatDB.initializeUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('初始化用户失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfigSaved = (config: any) => {
    console.log('飞书应用配置已保存:', config)
  }

  const handleConfigDeleted = () => {
    console.log('飞书应用配置已删除')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首页
              </Button>
            </Link>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              请先登录飞书账号才能配置应用信息。
              <Link href="/feishu/qr-login" className="ml-2 text-blue-600 hover:underline">
                点击这里登录
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-8 w-8 text-blue-600" />
              飞书应用配置
            </h1>
            <p className="text-gray-600 mt-1">
              配置您的飞书应用以启用日程管理功能
            </p>
          </div>
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </Link>
        </div>

        {/* URL消息提示 */}
        {urlMessage && (
          <div>
            {urlMessage.type === 'success' ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {urlMessage.message}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {urlMessage.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* 用户信息 */}
        {userInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                当前用户
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {userInfo.avatar && (
                  <img 
                    src={userInfo.avatar} 
                    alt={userInfo.name}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <h3 className="font-medium">{userInfo.name}</h3>
                  <p className="text-sm text-gray-600">{userInfo.email}</p>
                  <Badge variant="outline" className="mt-1">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    已登录
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 配置说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              配置说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                为了使用日程管理功能，您需要配置自己的飞书应用。每个用户都需要绑定自己的应用才能进行日程的读取和写入操作。
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-medium">配置步骤：</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>
                  访问 <a 
                    href="https://open.feishu.cn/app" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    飞书开放平台 <ExternalLink className="h-3 w-3" />
                  </a> 创建应用
                </li>
                <li>在应用管理页面获取"应用ID"和"应用密钥"</li>
                <li>为应用开通"日历"相关权限</li>
                <li>在下方表单中填入应用信息并保存</li>
                <li>点击"测试配置"验证应用配置是否正确</li>
                <li>点击"激活"按钮启用应用</li>
              </ol>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">重要提醒：</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• 应用密钥将被加密存储，仅用于API调用</li>
                <li>• 请确保应用已开通日历读写权限</li>
                <li>• 每个用户只能有一个活跃的应用配置</li>
                <li>• 应用配置验证成功后才能使用日程功能</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 应用配置组件 */}
        <FeishuAppConfig
          userId={currentUser?.id}
          onConfigSaved={handleConfigSaved}
          onConfigDeleted={handleConfigDeleted}
        />

        {/* 帮助链接 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              相关链接
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="https://open.feishu.cn/app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="font-medium">飞书开放平台</div>
                  <div className="text-sm text-gray-600">创建和管理应用</div>
                </div>
              </a>

              <a
                href="https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/calendar-v4/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <BookOpen className="h-4 w-4 text-green-600" />
                <div>
                  <div className="font-medium">日历API文档</div>
                  <div className="text-sm text-gray-600">了解日历权限配置</div>
                </div>
              </a>

              <a
                href="https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/guides/permission-overview"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Shield className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="font-medium">权限配置指南</div>
                  <div className="text-sm text-gray-600">应用权限申请流程</div>
                </div>
              </a>

              <Link
                href="/database/dashboard"
                className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4 text-orange-600" />
                <div>
                  <div className="font-medium">数据库仪表板</div>
                  <div className="text-sm text-gray-600">查看应用使用统计</div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
