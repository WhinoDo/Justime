'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/useAuth'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react'

interface LoginFormProps {
  onSuccess?: (user: any) => void
  onSwitchToRegister?: () => void
  redirectTo?: string
}

export function LoginForm({ onSuccess, onSwitchToRegister, redirectTo }: LoginFormProps) {
  const { login, isLoading } = useAuth()

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false
  })

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.identifier.trim() || !formData.password.trim()) {
      setError('请填写用户名/邮箱和密码')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await login({
        identifier: formData.identifier.trim(),
        password: formData.password,
        rememberMe: formData.rememberMe
      })

      if (result.success) {
        setSuccess('登录成功！')
        onSuccess?.(result.user)

        // 如果有重定向地址，跳转到指定页面
        if (redirectTo) {
          setTimeout(() => {
            window.location.href = redirectTo
          }, 1000)
        }
      } else {
        setError(result.error || '登录失败')
      }

    } catch (error) {
      console.error('登录错误:', error)
      setError('登录时发生错误，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto border border-white/8 bg-transparent shadow-none text-gray-100">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold text-white">
          登录账户
        </CardTitle>
        <p className="text-center text-white/75">
          欢迎回来，请登录您的账户
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

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名/邮箱 */}
          <div className="space-y-2">
            <Label htmlFor="identifier" className="text-white/85">用户名或邮箱 *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                id="identifier"
                type="text"
                placeholder="请输入用户名或邮箱"
                value={formData.identifier}
                onChange={(e) => handleInputChange('identifier', e.target.value)}
                className="pl-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-orange-300 focus-visible:border-orange-300/70"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 密码 */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/85">密码 *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="pl-10 pr-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-orange-300 focus-visible:border-orange-300/70"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 记住我 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberMe"
              checked={formData.rememberMe}
              onCheckedChange={(checked) => handleInputChange('rememberMe', checked)}
              disabled={isSubmitting}
              className="border-white/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
            />
            <Label htmlFor="rememberMe" className="text-sm text-white/75">
              记住我（30天内免登录）
            </Label>
          </div>

          {/* 登录按钮 */}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                登录
              </>
            )}
          </Button>
        </form>

        {/* 底部链接 */}
        <div className="text-center space-y-2">
          <div className="text-sm">
            <Button
              variant="link"
              className="p-0 h-auto text-orange-300 hover:text-orange-200"
              onClick={() => {
                // TODO: 实现忘记密码功能
                alert('忘记密码功能即将上线')
              }}
            >
              忘记密码？
            </Button>
          </div>

          <div className="text-sm text-white/75">
            还没有账户？
            <Button
              variant="link"
              className="p-0 h-auto ml-1 text-orange-300 hover:text-orange-200"
              onClick={onSwitchToRegister}
            >
              立即注册
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default LoginForm
