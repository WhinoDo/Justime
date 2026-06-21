'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { cn } from '@/lib/utils'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  UserPlus
} from 'lucide-react'

interface RegisterFormProps {
  onSuccess?: (user: any) => void
  onSwitchToLogin?: () => void
  redirectTo?: string
}

export function RegisterForm({ onSuccess, onSwitchToLogin, redirectTo }: RegisterFormProps) {
  const { register, isLoading } = useAuth()
  const { isDesktop } = useDesktopRuntime()

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    phone: ''
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
    setSuccess(null)
  }

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

    // 验证用户名格式（如果填写了）
    if (formData.username.trim()) {
      const usernameRegex = /^[a-zA-Z0-9_-]+$/
      if (!usernameRegex.test(formData.username) || formData.username.length < 3 || formData.username.length > 30) {
        setError('用户名只能包含字母、数字、下划线和连字符，长度为3-30个字符')
        return false
      }
    }

    // 验证手机号格式（如果填写了）
    if (formData.phone.trim()) {
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(formData.phone)) {
        setError('请输入有效的手机号码')
        return false
      }
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

    try {
      const result = await register({
        username: formData.username.trim() || undefined,
        email: formData.email.trim(),
        password: formData.password,
        displayName: formData.displayName.trim() || undefined,
        phone: formData.phone.trim() || undefined
      })

      if (result.success) {
        setSuccess('注册成功！' + (result.needsVerification ? ' 请查收邮箱验证邮件。' : ''))
        onSuccess?.(result.user)

        // 如果有重定向地址，跳转到指定页面
        if (redirectTo) {
          setTimeout(() => {
            window.location.href = redirectTo
          }, 2000)
        }
      } else {
        setError(result.error || '注册失败')
      }

    } catch (error) {
      console.error('注册错误:', error)
      setError('注册时发生错误，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className={cn("w-full max-w-md mx-auto border bg-transparent shadow-none", isDesktop ? "border-violet-200/20 text-[#171421]" : "border-white/[0.08] text-gray-100")}>
      <CardHeader>
        <CardTitle className={cn("text-center text-2xl font-bold", isDesktop ? "text-[#171421]" : "text-white")}>
          创建账户
        </CardTitle>
        <p className={cn("text-center text-xs mt-1", isDesktop ? "text-[#6d6680]" : "text-white/75")}>
          注册新账户，开始使用矩时AI助手
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 错误和成功提示 */}
        {error && (
          <Alert variant="destructive" className={cn("border-0", isDesktop ? "bg-rose-50 text-rose-800" : "bg-red-500/20 border-red-500/50 text-white")}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className={cn("border-0", isDesktop ? "bg-emerald-50 text-emerald-800" : "border-green-500/50 bg-green-500/20 text-white")}>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* 注册表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱 */}
          <div className="space-y-2 font-medium">
            <Label htmlFor="email" className={isDesktop ? "text-[#171421] text-xs font-semibold" : "text-white/[0.85] text-xs font-medium"}>邮箱地址 *</Label>
            <div className="relative">
              <Mail className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4", isDesktop ? "text-violet-400" : "text-white/50")} />
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱地址"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="pl-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-violet-300 focus-visible:border-violet-300/70"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 用户名 */}
          <div className="space-y-2 font-medium">
            <Label htmlFor="username" className={isDesktop ? "text-[#171421] text-xs font-semibold" : "text-white/[0.85] text-xs font-medium"}>用户名（可选）</Label>
            <div className="relative">
              <User className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4", isDesktop ? "text-violet-400" : "text-white/50")} />
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="pl-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-violet-300 focus-visible:border-violet-300/70"
                disabled={isSubmitting}
              />
            </div>
            <p className={cn("text-xs", isDesktop ? "text-[#8b7aa8]" : "text-white/[0.65]")}>
              用户名可用于登录，只能包含字母、数字、下划线和连字符
            </p>
          </div>

          {/* 显示名称 */}
          <div className="space-y-2 font-medium">
            <Label htmlFor="displayName" className={isDesktop ? "text-[#171421] text-xs font-semibold" : "text-white/[0.85] text-xs font-medium"}>显示名称（可选）</Label>
            <div className="relative">
              <User className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4", isDesktop ? "text-violet-400" : "text-white/50")} />
              <Input
                id="displayName"
                type="text"
                placeholder="请输入显示名称"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                className="pl-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-violet-300 focus-visible:border-violet-300/70"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 手机号 */}
          <div className="space-y-2 font-medium">
            <Label htmlFor="phone" className={isDesktop ? "text-[#171421] text-xs font-semibold" : "text-white/[0.85] text-xs font-medium"}>手机号（可选）</Label>
            <div className="relative">
              <Phone className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4", isDesktop ? "text-violet-400" : "text-white/50")} />
              <Input
                id="phone"
                type="tel"
                placeholder="请输入手机号"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="pl-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-violet-300 focus-visible:border-violet-300/70"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 密码 */}
          <div className="space-y-2 font-medium">
            <Label htmlFor="password" className={isDesktop ? "text-[#171421] text-xs font-semibold" : "text-white/[0.85] text-xs font-medium"}>密码 *</Label>
            <div className="relative">
              <Lock className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4", isDesktop ? "text-violet-400" : "text-white/50")} />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码（至少6个字符）"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="pl-10 pr-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-violet-300 focus-visible:border-violet-300/70"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "absolute right-2 top-1/2 transform -translate-y-1/2",
                  isDesktop
                    ? "text-violet-400 hover:bg-violet-50 hover:text-violet-600"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 确认密码 */}
          <div className="space-y-2 font-medium">
            <Label htmlFor="confirmPassword" className={isDesktop ? "text-[#171421] text-xs font-semibold" : "text-white/[0.85] text-xs font-medium"}>确认密码 *</Label>
            <div className="relative">
              <Lock className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4", isDesktop ? "text-violet-400" : "text-white/50")} />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="请再次输入密码"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className="pl-10 pr-10 bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-violet-300 focus-visible:border-violet-300/70"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "absolute right-2 top-1/2 transform -translate-y-1/2",
                  isDesktop
                    ? "text-violet-400 hover:bg-violet-50 hover:text-violet-600"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isSubmitting}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 注册按钮 */}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white border-0"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                注册中...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                注册账户
              </>
            )}
          </Button>
        </form>

        {/* 分隔线 */}
        <div className="relative">
          <Separator className={isDesktop ? "bg-violet-200/50" : "bg-white/20"} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("bg-transparent px-2 text-sm", isDesktop ? "text-[#6d6680]" : "text-white/[0.65]")}>或</span>
          </div>
        </div>

        {/* 底部链接 */}
        <div className="text-center pt-1">
          <div className={cn("text-xs", isDesktop ? "text-[#6d6680]" : "text-white/75")}>
            已有账户？
            <Button
              variant="link"
              className="p-0 h-auto ml-1 text-violet-300 hover:text-violet-200"
              onClick={onSwitchToLogin}
            >
              立即登录
            </Button>
          </div>
        </div>

        {/* 服务条款 */}
        <div className={cn("text-[11px] text-center pt-2", isDesktop ? "text-[#8b7aa8]" : "text-white/[0.65]")}>
          注册即表示您同意我们的
          <Button variant="link" className="p-0 h-auto text-xs text-violet-300 hover:text-violet-200 ml-1">
            服务条款
          </Button>
          和
          <Button variant="link" className="p-0 h-auto text-xs text-violet-300 hover:text-violet-200 ml-1">
            隐私政策
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default RegisterForm
