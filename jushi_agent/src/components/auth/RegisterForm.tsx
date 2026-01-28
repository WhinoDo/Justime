'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
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
    <Card className="w-full max-w-md mx-auto bg-white/95 text-gray-900 border border-orange-100 shadow-xl dark:bg-white dark:text-gray-900">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold text-gray-900">
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

        {/* 注册表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱 */}
          <div className="space-y-2">
            <Label htmlFor="email">邮箱地址 *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱地址"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="pl-10 bg-white text-gray-900 placeholder:text-gray-400 border-gray-200 focus-visible:ring-orange-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 用户名 */}
          <div className="space-y-2">
            <Label htmlFor="username">用户名（可选）</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="pl-10 bg-white text-gray-900 placeholder:text-gray-400 border-gray-200 focus-visible:ring-orange-500"
                disabled={isSubmitting}
              />
            </div>
            <p className="text-xs text-gray-500">
              用户名可用于登录，只能包含字母、数字、下划线和连字符
            </p>
          </div>

          {/* 显示名称 */}
          <div className="space-y-2">
            <Label htmlFor="displayName">显示名称（可选）</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="displayName"
                type="text"
                placeholder="请输入显示名称"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                className="pl-10 bg-white text-gray-900 placeholder:text-gray-400 border-gray-200 focus-visible:ring-orange-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 手机号 */}
          <div className="space-y-2">
            <Label htmlFor="phone">手机号（可选）</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                placeholder="请输入手机号"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="pl-10 bg-white text-gray-900 placeholder:text-gray-400 border-gray-200 focus-visible:ring-orange-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 密码 */}
          <div className="space-y-2">
            <Label htmlFor="password">密码 *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码（至少6个字符）"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="pl-10 pr-10 bg-white text-gray-900 placeholder:text-gray-400 border-gray-200 focus-visible:ring-orange-500"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 确认密码 */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码 *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="请再次输入密码"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className="pl-10 pr-10 bg-white text-gray-900 placeholder:text-gray-400 border-gray-200 focus-visible:ring-orange-500"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
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
            className="w-full"
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
          <Separator />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-white px-2 text-sm text-gray-500">或</span>
          </div>
        </div>

        {/* 底部链接 */}
        <div className="text-center">
          <div className="text-sm text-gray-600">
            已有账户？
            <Button
              variant="link"
              className="p-0 h-auto ml-1 text-blue-600 hover:text-blue-800"
              onClick={onSwitchToLogin}
            >
              立即登录
            </Button>
          </div>
        </div>

        {/* 服务条款 */}
        <div className="text-xs text-gray-500 text-center">
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

export default RegisterForm
