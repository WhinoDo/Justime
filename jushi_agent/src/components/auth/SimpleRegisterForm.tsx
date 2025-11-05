'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface SimpleRegisterFormProps {
  onSuccess?: (user: any) => void
  redirectTo?: string
}

export function SimpleRegisterForm({ onSuccess, redirectTo = '/' }: SimpleRegisterFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('请输入邮箱地址')
      return false
    }

    if (!formData.password.trim()) {
      setError('请输入密码')
      return false
    }

    if (formData.password.length < 6) {
      setError('密码至少需要6个字符')
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return false
    }

    // 验证邮箱格式
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
    if (!emailRegex.test(formData.email)) {
      setError('请输入有效的邮箱地址')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // 模拟API调用
      console.log('注册数据:', formData)

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 模拟注册成功
      const mockUser = {
        id: Date.now().toString(),
        username: formData.username || formData.email.split('@')[0],
        email: formData.email,
        displayName: formData.displayName || formData.username || formData.email.split('@')[0]
      }

      setSuccess('注册成功！正在跳转...')

      // 调用成功回调
      onSuccess?.(mockUser)

      // 延迟跳转
      setTimeout(() => {
        window.location.href = redirectTo
      }, 1500)

    } catch (error) {
      console.error('注册失败:', error)
      setError('注册失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold">
          创建账户
        </CardTitle>
        <p className="text-center text-gray-600">
          注册新账户，开始使用聚时AI助手
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
            <Label htmlFor="email">邮箱地址 *</Label>
            <Input
              id="email"
              type="email"
              placeholder="请输入邮箱地址"
              value={formData.email}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  email: e.target.value
                }))
                // 清除错误信息
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">用户名（可选）</Label>
            <Input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                username: e.target.value
              }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">显示名称（可选）</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="请输入显示名称"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                displayName: e.target.value
              }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码 *</Label>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码（至少6个字符）"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                password: e.target.value
              }))}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码 *</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                confirmPassword: e.target.value
              }))}
              disabled={isSubmitting}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                注册中...
              </>
            ) : (
              '注册账户'
            )}
          </Button>
        </form>

        <div className="text-xs text-gray-500 text-center mt-4">
          注册即表示您同意我们的
          <Button variant="link" className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800">
            服务条款
          </Button>
          和
          <Button variant="link" className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800">
            隐私政策
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
