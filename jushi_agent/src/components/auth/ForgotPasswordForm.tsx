'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/alert'
import { Mail, AlertCircle, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react'

interface ForgotPasswordFormProps {
  onBackToLogin?: () => void
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setError('请输入邮箱地址')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim() })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(result.message || '如果该邮箱已注册，您将收到密码重置邮件')
      } else {
        setError(result.message || result.error || '发送重置邮件失败')
      }

    } catch (error) {
      console.error('忘记密码请求失败:', error)
      setError('发送请求时发生错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto border border-white/8 bg-transparent shadow-none text-gray-100">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold text-white">
          忘记密码
        </CardTitle>
        <p className="text-center text-white/75">
          输入您的邮箱地址，我们将发送密码重置链接
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 错误和成功提示 */}
        {error && (
          <Alert variant="destructive" className="bg-red-500/20 border-red-500/50 text-white">
            <AlertCircle className="h-4 w-4 text-red-200" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500/50 bg-green-500/20 text-white">
            <CheckCircle className="h-4 w-4 text-green-200" />
            <AlertDescription className="text-green-100">{success}</AlertDescription>
          </Alert>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱 */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/85">邮箱地址 *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                id="email"
                type="email"
                placeholder="请输入注册时使用的邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-orange-300 focus-visible:border-orange-300/70"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* 提交按钮 */}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                发送中...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                发送重置链接
              </>
            )}
          </Button>
        </form>

        {/* 返回登录 */}
        <div className="text-center">
          <Button
            variant="link"
            className="p-0 h-auto text-orange-300 hover:text-orange-200"
            onClick={onBackToLogin}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回登录
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ForgotPasswordForm
