'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertTriangle, ExternalLink, RefreshCw, Globe } from 'lucide-react'

interface ExternalLoginCheckerProps {
  onStatusChange?: (isAvailable: boolean) => void
}

export default function ExternalLoginChecker({ onStatusChange }: ExternalLoginCheckerProps) {
  const [status, setStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')
  const [djangoUrl, setDjangoUrl] = useState('http://127.0.0.1:3000')
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const checkExternalService = async () => {
    setStatus('checking')
    setLastCheck(new Date())
    
    try {
      // 检查Django+React服务是否可用
      const response = await fetch(djangoUrl, {
        method: 'GET',
        mode: 'no-cors', // 避免CORS问题
        signal: AbortSignal.timeout(5000) // 5秒超时
      })
      
      // 由于no-cors模式，我们无法读取响应内容
      // 但如果没有抛出异常，说明服务可能是可用的
      setStatus('available')
      onStatusChange?.(true)
      
    } catch (error) {
      console.log('Django+React服务检查失败:', error)
      setStatus('unavailable')
      onStatusChange?.(false)
    }
  }

  const openExternalLogin = () => {
    // 保存返回URL
    localStorage.setItem('feishu_return_url', window.location.href)
    // 在新窗口中打开Django+React登录页面
    window.open(djangoUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
  }

  useEffect(() => {
    checkExternalService()
    
    // 每30秒检查一次服务状态
    const interval = setInterval(checkExternalService, 30000)
    
    return () => clearInterval(interval)
  }, [djangoUrl])

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
      case 'available':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'unavailable':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusBadge = () => {
    switch (status) {
      case 'checking':
        return <Badge variant="secondary">检查中</Badge>
      case 'available':
        return <Badge className="bg-green-500">可用</Badge>
      case 'unavailable':
        return <Badge variant="destructive">不可用</Badge>
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'checking':
        return '正在检查Django+React登录服务状态...'
      case 'available':
        return 'Django+React登录服务运行正常，推荐使用'
      case 'unavailable':
        return 'Django+React登录服务不可用，请使用本地登录'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Globe className="h-5 w-5 text-blue-500 mr-2" />
            外部登录服务状态
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium">{getStatusMessage()}</p>
            {lastCheck && (
              <p className="text-xs text-gray-500">
                最后检查: {lastCheck.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">服务地址:</span>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
              {djangoUrl}
            </code>
          </div>
        </div>

        {status === 'available' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>推荐使用Django+React登录页面</strong>
              <br />
              该页面已经过验证，稳定可靠，登录成功率高
            </AlertDescription>
          </Alert>
        )}

        {status === 'unavailable' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Django+React服务不可用</strong>
              <br />
              请确保Django服务在 {djangoUrl} 上运行，或使用本地登录
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-2">
          {status === 'available' && (
            <Button 
              onClick={openExternalLogin}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              打开Django+React登录
            </Button>
          )}
          
          <Button 
            onClick={checkExternalService}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            重新检查
          </Button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Django+React页面提供完整的飞书登录功能</p>
          <p>• 登录成功后会自动返回当前页面</p>
          <p>• 如果服务不可用，请启动Django服务或使用本地登录</p>
        </div>
      </CardContent>
    </Card>
  )
}
