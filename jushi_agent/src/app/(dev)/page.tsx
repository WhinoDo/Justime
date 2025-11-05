'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Code, 
  Bug, 
  TestTube, 
  Feather, 
  Settings, 
  Shield, 
  Calendar,
  User,
  MessageSquare,
  Database,
  Clock,
  Activity,
  Eye,
  LogIn,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

export default function DevToolsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Code className="h-10 w-10 text-blue-600" />
              开发工具集合
            </h1>
            <p className="text-gray-600 mt-2">用于开发、调试和测试的工具页面</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Button>
          </Link>
        </div>

        <Separator />

        {/* 工具分类 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* 认证调试工具 */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Shield className="h-5 w-5" />
                认证调试
              </CardTitle>
              <CardDescription>
                用于调试OAuth2、PKCE、Token等认证相关功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/(dev)/debug/debug-auth-code">
                <Button variant="outline" className="w-full justify-start">
                  <Bug className="h-4 w-4 mr-2" />
                  授权码调试
                  <Badge variant="secondary" className="ml-auto">Debug</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/debug/debug-binding">
                <Button variant="outline" className="w-full justify-start">
                  <LogIn className="h-4 w-4 mr-2" />
                  绑定调试
                  <Badge variant="secondary" className="ml-auto">Debug</Badge>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 飞书调试工具 */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Feather className="h-5 w-5" />
                飞书调试
              </CardTitle>
              <CardDescription>
                飞书API、日历、登录等功能的调试工具
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/(dev)/feishu-debug/debug">
                <Button variant="outline" className="w-full justify-start">
                  <Bug className="h-4 w-4 mr-2" />
                  飞书通用调试
                  <Badge variant="secondary" className="ml-auto">Debug</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/debug-user">
                <Button variant="outline" className="w-full justify-start">
                  <User className="h-4 w-4 mr-2" />
                  用户信息调试
                  <Badge variant="secondary" className="ml-auto">Debug</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/calendar-debug">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  日历调试
                  <Badge variant="secondary" className="ml-auto">Debug</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/login-test">
                <Button variant="outline" className="w-full justify-start">
                  <LogIn className="h-4 w-4 mr-2" />
                  登录测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/token-test">
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Token测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/network-test">
                <Button variant="outline" className="w-full justify-start">
                  <Activity className="h-4 w-4 mr-2" />
                  网络测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/config-check">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  配置检查
                  <Badge variant="secondary" className="ml-auto">Check</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/sdk-test">
                <Button variant="outline" className="w-full justify-start">
                  <Code className="h-4 w-4 mr-2" />
                  SDK测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/calendar-api-demo">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  日历API演示
                  <Badge variant="secondary" className="ml-auto">Demo</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/calendar-advanced">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  高级日历创建
                  <Badge variant="secondary" className="ml-auto">Create</Badge>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 日历功能测试 */}
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <Calendar className="h-5 w-5" />
                日历测试
              </CardTitle>
              <CardDescription>
                专门用于测试日历相关功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/(dev)/feishu-debug/calendar-test">
                <Button variant="outline" className="w-full justify-start">
                  <TestTube className="h-4 w-4 mr-2" />
                  基础日历测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/calendar-events-test">
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="h-4 w-4 mr-2" />
                  事件测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/calendar-month">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  月历显示
                  <Badge variant="secondary" className="ml-auto">View</Badge>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* PKCE和认证测试 */}
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Shield className="h-5 w-5" />
                PKCE & 认证测试
              </CardTitle>
              <CardDescription>
                OAuth2 PKCE流程和认证机制测试
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/(dev)/test/test-pkce">
                <Button variant="outline" className="w-full justify-start">
                  <TestTube className="h-4 w-4 mr-2" />
                  PKCE测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/test/test-pkce-validation">
                <Button variant="outline" className="w-full justify-start">
                  <Bug className="h-4 w-4 mr-2" />
                  PKCE验证
                  <Badge variant="secondary" className="ml-auto">Validation</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/feishu-debug/test-login">
                <Button variant="outline" className="w-full justify-start">
                  <LogIn className="h-4 w-4 mr-2" />
                  标准登录测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* UI和显示测试 */}
          <Card className="border-teal-200 bg-teal-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-800">
                <Eye className="h-5 w-5" />
                UI & 显示测试
              </CardTitle>
              <CardDescription>
                用户界面和组件显示测试
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/(dev)/test/test-ui">
                <Button variant="outline" className="w-full justify-start">
                  <Eye className="h-4 w-4 mr-2" />
                  UI组件测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/test/test-feishu-display">
                <Button variant="outline" className="w-full justify-start">
                  <Feather className="h-4 w-4 mr-2" />
                  飞书显示测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/test/test-hydration">
                <Button variant="outline" className="w-full justify-start">
                  <Activity className="h-4 w-4 mr-2" />
                  水合测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/test/test-qr">
                <Button variant="outline" className="w-full justify-start">
                  <Code className="h-4 w-4 mr-2" />
                  二维码测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 功能模块测试 */}
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-800">
                <TestTube className="h-5 w-5" />
                功能模块测试
              </CardTitle>
              <CardDescription>
                具体功能模块的独立测试
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/(dev)/test/test-tasks">
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  任务模块测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/test/time-test">
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="h-4 w-4 mr-2" />
                  时间功能测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
              <Link href="/(dev)/test/emotion-task-test">
                <Button variant="outline" className="w-full justify-start">
                  <Activity className="h-4 w-4 mr-2" />
                  情感任务测试
                  <Badge variant="secondary" className="ml-auto">Test</Badge>
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>

        {/* 使用说明 */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Settings className="h-5 w-5" />
              使用说明
            </CardTitle>
          </CardHeader>
          <CardContent className="text-yellow-800">
            <div className="space-y-2 text-sm">
              <p><strong>Debug</strong> - 用于调试和排查问题的工具</p>
              <p><strong>Test</strong> - 功能测试和验证工具</p>
              <p><strong>Check</strong> - 配置和状态检查工具</p>
              <p><strong>View</strong> - 数据展示和可视化工具</p>
              <p className="text-yellow-700 font-medium mt-4">
                ⚠️ 这些工具仅用于开发环境，请勿在生产环境中使用
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
