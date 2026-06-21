'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/useAuth'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { cn } from '@/lib/utils'
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
  const { isDesktop } = useDesktopRuntime()
  const router = useRouter()

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
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null); setSuccess(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.identifier.trim() || !formData.password.trim()) { setError('请填写用户名/邮箱和密码'); return }
    setIsSubmitting(true); setError(null)
    try {
      const result = await login({ identifier: formData.identifier.trim(), password: formData.password, rememberMe: formData.rememberMe })
      if (result.success) {
        setSuccess('登录成功！')
        onSuccess?.(result.user)
        if (redirectTo) setTimeout(() => { window.location.href = redirectTo }, 1000)
      } else setError(result.error || '登录失败')
    } catch (error) {
      console.error('登录错误:', error); setError('登录时发生错误，请稍后重试')
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
          <Label htmlFor="identifier" className="text-xs font-medium text-gray-700 dark:text-gray-300">用户名或邮箱 *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="identifier" type="text" placeholder="请输入用户名或邮箱"
              value={formData.identifier} onChange={(e) => handleInputChange('identifier', e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isSubmitting} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium text-gray-700 dark:text-gray-300">密码 *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="请输入密码"
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

        <div className="flex items-center space-x-2">
          <Checkbox id="rememberMe" checked={formData.rememberMe}
            onCheckedChange={(checked) => handleInputChange('rememberMe', checked)}
            disabled={isSubmitting}
            className="border-gray-400 dark:border-gray-600 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600" />
          <Label htmlFor="rememberMe" className="text-xs text-gray-500 dark:text-gray-400">记住我（30天内免登录）</Label>
        </div>

        <Button type="submit" className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium" disabled={isSubmitting || isLoading}>
          {isSubmitting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />登录中...</> : <><Mail className="h-4 w-4 mr-2" />登录</>}
        </Button>
      </form>

      <div className="text-center space-y-2 pt-2">
        <div className="text-sm">
          <Button variant="link" className="p-0 h-auto text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300" onClick={() => router.push('/auth/forgot-password')}>
            忘记密码？
          </Button>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          还没有账户？
          <Button variant="link" className="p-0 h-auto ml-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300" onClick={onSwitchToRegister}>
            立即注册
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LoginForm
