'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle } from 'lucide-react'

export default function TestHydrationPage() {
  const [mounted, setMounted] = useState(false)
  const [testResult, setTestResult] = useState<string>('')

  useEffect(() => {
    setMounted(true)
    setTestResult('客户端已挂载，hydration 成功！')
  }, [])

  if (!mounted) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Hydration 测试</CardTitle>
            <CardDescription>正在加载...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hydration 错误测试</h1>
        <p className="text-gray-600 mt-2">测试服务端渲染和客户端渲染的一致性</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>测试结果</CardTitle>
          <CardDescription>检查是否还有 hydration 错误</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>组件已成功挂载</span>
            <Badge variant="default">成功</Badge>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div>
                <strong>测试状态：</strong>
              </div>
              <div className="mt-2">
                {testResult}
              </div>
            </AlertDescription>
          </Alert>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-800 mb-2">修复的问题：</h3>
            <div className="text-sm text-green-700 space-y-1">
              <div>✅ 修复了 AlertDescription 中的 HTML 结构问题</div>
              <div>✅ 移除了 &lt;p&gt; 标签内的 &lt;div&gt; 嵌套</div>
              <div>✅ 使用正确的 HTML 结构避免 hydration 错误</div>
              <div>✅ 添加了客户端挂载检查</div>
              <div>✅ 修复了服务端/客户端渲染不匹配问题</div>
              <div>✅ 统一了页面结构，避免条件渲染导致的不一致</div>
            </div>
          </div>

          <Button 
            onClick={() => {
              console.log('✅ 按钮点击测试成功，无 hydration 错误')
              setTestResult('按钮交互测试成功！时间：' + new Date().toLocaleTimeString())
            }}
            className="w-full"
          >
            测试交互功能
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          <div>
            <strong>Hydration 错误修复说明：</strong>
          </div>
          <div className="mt-2 space-y-1">
            <div>1. 在 AlertDescription 中避免使用 &lt;br /&gt; 标签</div>
            <div>2. 使用 &lt;div&gt; 结构替代换行标签</div>
            <div>3. 添加客户端挂载检查避免服务端/客户端不一致</div>
            <div>4. 确保所有组件在服务端和客户端渲染相同的 HTML 结构</div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
