'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowRight, Info } from 'lucide-react'

export default function FeishuAuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // 这个页面已经被弃用，自动重定向到新的绑定回调页面
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    
    // 构建新的URL参数
    const params = new URLSearchParams()
    if (code) params.set('code', code)
    if (state) params.set('state', state)
    if (error) params.set('error', error)
    
    const redirectUrl = `/feishu/bind-callback${params.toString() ? '?' + params.toString() : ''}`
    
    console.log('🔀 旧版飞书认证页面重定向到新页面:', redirectUrl)
    
    // 立即重定向到新的回调页面
    router.replace(redirectUrl)
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <ArrowRight className="h-6 w-6 text-blue-600" />
            页面重定向
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              正在重定向到新的飞书绑定页面...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}