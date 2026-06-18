'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

  useEffect(() => { if (!token) setError('重置链接无效，请重新获取') }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) { setError('重置链接无效，请重新获取'); return }
    if (!newPassword.trim() || newPassword.length < 8) { setError('密码至少需要8个字符'); return }
    if (newPassword !== confirmPassword) { setError('两次输入的密码不一致'); return }
    setIsLoading(true); setError(null); setSuccess(null)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword })
      })
      const result = await response.json()
      if (result.success) {
        setSuccess(result.message || '密码重置成功')
        setTimeout(() => { onSuccess ? onSuccess() : router.push('/auth') }, 3000)
      } else setError(result.message || result.error || '重置密码失败')
    } catch (error) {
      console.error('重置密码失败:', error); setError('重置密码时发生错误，请稍后重试')
    } finally { setIsLoading(false) }
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
          <AlertDescription>
            {success}<br />
            <span className="text-sm opacity-75">即将跳转到登录页面...</span>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword" className="text-xs font-medium text-gray-700 dark:text-gray-300">新密码 *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="newPassword" type={showPassword ? 'text' : 'password'} placeholder="请输入新密码（至少8位）"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 pr-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isLoading || !token} />
            <Button type="button" variant="ghost" size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-700 dark:text-gray-300">确认密码 *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="请再次输入新密码"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isLoading || !token} />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium" disabled={isLoading || !token}>
          {isLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />重置中...</> : <><Lock className="h-4 w-4 mr-2" />重置密码</>}
        </Button>
      </form>
    </div>
  )
}

export default ResetPasswordForm
