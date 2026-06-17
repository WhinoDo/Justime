'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, AlertCircle, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { cn } from '@/lib/utils'

interface ForgotPasswordFormProps {
  onBackToLogin?: () => void
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const router = useRouter()
  const { isDesktop } = useDesktopRuntime()
  const handleBackToLogin = onBackToLogin || (() => router.push('/auth'))
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
    <Card className={cn("w-full max-w-md mx-auto border bg-transparent shadow-none", isDesktop ? "border-violet-200/20 text-[#171421]" : "border-white/[0.08] text-gray-100")}>
      <CardHeader>
        <CardTitle className={cn("text-center text-2xl font-bold", isDesktop ? "text-[#171421]" : "text-white")}>
          忘记密码
        </CardTitle>
        <p className={cn("text-center text-xs mt-1", isDesktop ? "text-[#6d6680]" : "text-white/75")}>
          输入您的邮箱地址，我们将发送密码重置链接
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

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱 */}
          <div className="space-y-2 font-medium">
            <Label htmlFor="email" className={isDesktop ? "text-[#171421] text-xs font-semibold" : "text-white/[0.85] text-xs font-medium"}>邮箱地址 *</Label>
            <div className="relative">
              <Mail className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4", isDesktop ? "text-violet-400" : "text-white/50")} />
              <Input
                id="email"
                type="email"
                placeholder="请输入注册时使用的邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  "pl-10 text-sm",
                  isDesktop
                    ? "bg-white border-violet-200 text-[#171421] placeholder:text-[#8b7aa8]/60 focus-visible:ring-violet-300 focus-visible:border-violet-400"
                    : "bg-white/[0.08] border-white/20 text-white placeholder:text-white/40 focus-visible:ring-orange-300 focus-visible:border-orange-300/70"
                )}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* 提交按钮 */}
          <Button
            type="submit"
            className={cn(
              "w-full border-0 font-medium",
              isDesktop
                ? "bg-violet-600 hover:bg-violet-500 text-white shadow-sm"
                : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            )}
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
        <div className="text-center pt-2">
          <Button
            variant="link"
            className={cn("p-0 h-auto font-medium", isDesktop ? "text-violet-600 hover:text-violet-700" : "text-orange-300 hover:text-orange-200")}
            onClick={handleBackToLogin}
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
