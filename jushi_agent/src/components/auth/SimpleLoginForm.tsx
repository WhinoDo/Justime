'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface SimpleLoginFormProps {
  onSuccess?: (user: any) => void
  redirectTo?: string
}

export function SimpleLoginForm({ onSuccess, redirectTo = '/' }: SimpleLoginFormProps) {
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 基本验证
    if (!formData.identifier.trim() || !formData.password.trim()) {
      setError('请填写用户名/邮箱和密码')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // 模拟API调用
      console.log('登录数据:', formData)

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 模拟登录成功
      const mockUser = {
        id: '1',
        username: formData.identifier,
        email: formData.identifier.includes('@') ? formData.identifier : `${formData.identifier}@example.com`,
        displayName: formData.identifier
      }

      setSuccess('登录成功！正在跳转...')

      // 调用成功回调
      onSuccess?.(mockUser)

      // 延迟跳转
      setTimeout(() => {
        window.location.href = redirectTo
      }, 1000)

    } catch (error) {
      console.error('登录失败:', error)
      setError('登录失败，请检查用户名和密码')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold">
          登录账户
        </CardTitle>
        <p className="text-center text-gray-600">
          欢迎回来，请登录您的账户
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 错误和成功提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">用户名或邮箱</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="请输入用户名或邮箱"
              value={formData.identifier}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  identifier: e.target.value
                }))
                // 清除错误信息
                if (error) setError(null)
              }}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={formData.password}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  password: e.target.value
                }))
                // 清除错误信息
                if (error) setError(null)
              }}
              disabled={isSubmitting}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
