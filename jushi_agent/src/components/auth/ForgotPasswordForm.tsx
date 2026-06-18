'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, AlertCircle, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react'

interface ForgotPasswordFormProps {
  onBackToLogin?: () => void
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const router = useRouter()
  const handleBackToLogin = onBackToLogin || (() => router.push('/auth'))
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('请输入邮箱地址'); return }
    setIsLoading(true); setError(null); setSuccess(null)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const result = await response.json()
      if (result.success) setSuccess(result.message || '如果该邮箱已注册，您将收到密码重置邮件')
      else setError(result.message || result.error || '发送重置邮件失败')
    } catch (error) {
      console.error('忘记密码请求失败:', error); setError('发送请求时发生错误，请稍后重试')
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
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-gray-700 dark:text-gray-300">邮箱地址 *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input id="email" type="email" placeholder="请输入注册时使用的邮箱"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
              disabled={isLoading} />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium" disabled={isLoading}>
          {isLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />发送中...</> : <><Mail className="h-4 w-4 mr-2" />发送重置链接</>}
        </Button>
      </form>

      <div className="text-center">
        <Button variant="link" className="p-0 h-auto text-xs text-purple-600 dark:text-purple-400" onClick={handleBackToLogin}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回登录
        </Button>
      </div>
    </div>
  )
}

export default ForgotPasswordForm
