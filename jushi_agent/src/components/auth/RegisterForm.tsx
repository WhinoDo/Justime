'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null); setSuccess(null)
  }

  const validateForm = () => {
    if (!formData.email.trim()) { setError('请输入邮箱地址'); return false }
    if (!formData.password.trim()) { setError('请输入密码'); return false }
    if (formData.password.length < 6) { setError('密码至少需要6个字符'); return false }
    if (formData.password !== formData.confirmPassword) { setError('两次输入的密码不一致'); return false }
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
    if (!emailRegex.test(formData.email)) { setError('请输入有效的邮箱地址'); return false }
    if (formData.username.trim()) {
      const usernameRegex = /^[a-zA-Z0-9_-]+$/
      if (!usernameRegex.test(formData.username) || formData.username.length < 3 || formData.username.length > 30) {
        setError('用户名只能包含字母、数字、下划线和连字符，长度为3-30个字符'); return false
      }
    }
    if (formData.phone.trim()) {
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(formData.phone)) { setError('请输入有效的手机号码'); return false }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true); setError(null)
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
        if (redirectTo) setTimeout(() => { window.location.href = redirectTo }, 2000)
      } else setError(result.error || '注册失败')
    } catch (error) {
      console.error('注册错误:', error); setError('注册时发生错误，请稍后重试')
    } finally { setIsSubmitting(false) }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {error && (
        <Alert className="bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/30 text-green-700 dark:text-green-300 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-gray-700 dark:text-gray-300">邮箱地址 *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="email" type="email" placeholder="请输入邮箱地址"
              value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isSubmitting} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-xs font-medium text-gray-700 dark:text-gray-300">用户名（可选）</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="username" type="text" placeholder="请输入用户名"
              value={formData.username} onChange={(e) => handleInputChange('username', e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isSubmitting} />
          </div>
          <p className="text-xs text-gray-400">用户名可用于登录，只能包含字母、数字、下划线和连字符</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="displayName" className="text-xs font-medium text-gray-700 dark:text-gray-300">显示名称（可选）</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="displayName" type="text" placeholder="请输入显示名称"
              value={formData.displayName} onChange={(e) => handleInputChange('displayName', e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isSubmitting} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-medium text-gray-700 dark:text-gray-300">手机号（可选）</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="phone" type="tel" placeholder="请输入手机号"
              value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isSubmitting} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium text-gray-700 dark:text-gray-300">密码 *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="请输入密码（至少6个字符）"
              value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)}
              className="pl-10 pr-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isSubmitting} />
            <Button type="button" variant="ghost" size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              onClick={() => setShowPassword(!showPassword)} disabled={isSubmitting}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-700 dark:text-gray-300">确认密码 *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="请再次输入密码"
              value={formData.confirmPassword} onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="pl-10 pr-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isSubmitting} />
            <Button type="button" variant="ghost" size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isSubmitting}>
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button type="submit" className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium" disabled={isSubmitting || isLoading}>
          {isSubmitting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />注册中...</> : <><UserPlus className="h-4 w-4 mr-2" />注册账户</>}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-800" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-gray-900 px-2 text-gray-400">或</span>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        已有账户？
        <Button variant="link" className="p-0 h-auto ml-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300" onClick={onSwitchToLogin}>
          立即登录
        </Button>
      </div>

      <div className="text-xs text-gray-400 text-center">
        注册即表示您同意我们的
        <Button variant="link" className="p-0 h-auto text-xs text-purple-600 dark:text-purple-400 ml-1">服务条款</Button>
        和
        <Button variant="link" className="p-0 h-auto text-xs text-purple-600 dark:text-purple-400 ml-1">隐私政策</Button>
      </div>
    </div>
  )
}

export default RegisterForm
