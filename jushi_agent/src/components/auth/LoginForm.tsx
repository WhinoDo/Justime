'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/useAuth'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
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
  const { loginWithQR } = useFeishuLogin()
  
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

  const handleFeishuLogin = async () => {
    try {
      const result = await loginWithQR()
      if (result.success) {
        setSuccess('飞书登录成功！')
        onSuccess?.(result.userInfo)
        
        if (redirectTo) {
          setTimeout(() => {
            window.location.href = redirectTo
          }, 1000)
        }
      } else {
        setError(result.error || '飞书登录失败')
      }
    } catch (error) {
      console.error('飞书登录错误:', error)
      setError('飞书登录时发生错误')
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

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名/邮箱 */}
          <div className="space-y-2">
            <Label htmlFor="identifier">用户名或邮箱 *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="identifier"
                type="text"
                placeholder="请输入用户名或邮箱"
                value={formData.identifier}
                onChange={(e) => handleInputChange('identifier', e.target.value)}
                className="pl-10"
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
                placeholder="请输入密码"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="pl-10 pr-10"
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

          {/* 记住我 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberMe"
              checked={formData.rememberMe}
              onCheckedChange={(checked) => handleInputChange('rememberMe', checked)}
              disabled={isSubmitting}
            />
            <Label htmlFor="rememberMe" className="text-sm">
              记住我（30天内免登录）
            </Label>
          </div>

          {/* 登录按钮 */}
          <Button
            type="submit"
            className="w-full"
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

        {/* 分隔线 */}
        <div className="relative">
          <Separator />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-white px-2 text-sm text-gray-500">或</span>
          </div>
        </div>

        {/* 飞书登录 */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleFeishuLogin}
          disabled={isSubmitting || isLoading}
        >
          <img 
            src="/feishu-icon.png" 
            alt="飞书" 
            className="h-4 w-4 mr-2"
            onError={(e) => {
              // 如果图标加载失败，使用文字
              e.currentTarget.style.display = 'none'
            }}
          />
          使用飞书账号登录
        </Button>

        {/* 底部链接 */}
        <div className="text-center space-y-2">
          <div className="text-sm">
            <Button
              variant="link"
              className="p-0 h-auto text-blue-600 hover:text-blue-800"
              onClick={() => {
                // TODO: 实现忘记密码功能
                alert('忘记密码功能即将上线')
              }}
            >
              忘记密码？
            </Button>
          </div>
          
          <div className="text-sm text-gray-600">
            还没有账户？
            <Button
              variant="link"
              className="p-0 h-auto ml-1 text-blue-600 hover:text-blue-800"
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
