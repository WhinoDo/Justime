'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

interface ResetPasswordFormProps {
  token?: string
  onSuccess?: () => void
}

export function ResetPasswordForm({ token: propToken, onSuccess }: ResetPasswordFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = propToken || searchParams?.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('重置链接无效，请重新获取')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      setError('重置链接无效，请重新获取')
      return
    }

    if (!newPassword.trim() || newPassword.length < 8) {
      setError('密码至少需要8个字符')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          new_password: newPassword
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(result.message || '密码重置成功')
        // 3秒后跳转到登录页
        setTimeout(() => {
          if (onSuccess) {
            onSuccess()
          } else {
            router.push('/auth')
          }
        }, 3000)
      } else {
        setError(result.message || result.error || '重置密码失败')
      }

    } catch (error) {
      console.error('重置密码失败:', error)
      setError('重置密码时发生错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto border border-white/8 bg-transparent shadow-none text-gray-100">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold text-white">
          重置密码
        </CardTitle>
        <p className="text-center text-white/75">
          请输入您的新密码
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
            <AlertDescription className="text-green-100">
              {success}
              <br />
              <span className="text-sm opacity-75">即将跳转到登录页面...</span>
            </AlertDescription>
          </Alert>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 新密码 */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-white/85">新密码 *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入新密码（至少8位）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-orange-300 focus-visible:border-orange-300/70"
                disabled={isLoading || !token}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 确认密码 */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-white/85">确认密码 *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-orange-300 focus-visible:border-orange-300/70"
                disabled={isLoading || !token}
              />
            </div>
          </div>

          {/* 提交按钮 */}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
            disabled={isLoading || !token}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                重置中...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                重置密码
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default ResetPasswordForm
