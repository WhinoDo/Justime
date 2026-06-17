'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthPageShell, AuthStateShell } from '@/components/auth/AuthPageShell'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { cn } from '@/lib/utils'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const { isDesktop } = useDesktopRuntime()
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    setToken(tokenParam)
    setChecked(true)
  }, [searchParams])

  if (!checked) {
    return (
      <AuthStateShell>
        <div className="text-center">
          <div className={cn("mx-auto h-8 w-8 animate-spin rounded-full border-b-2", isDesktop ? "border-violet-600" : "border-white")} />
          <p className={cn("mt-4", isDesktop ? "text-[#6d6680]" : "text-white/[0.65]")}>加载中...</p>
        </div>
      </AuthStateShell>
    )
  }

  if (!token) {
    return (
      <AuthPageShell
        title="重置密码"
        subtitle="链接无效"
        footer={
          <div className={cn("mt-4 text-center text-xs", isDesktop ? "text-[#8b7aa8]" : "text-gray-200 drop-shadow")}>
            <p>&copy; 2024 矩时AI助手. 保留所有权利.</p>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert variant="destructive" className={cn("border-0", isDesktop ? "bg-rose-50 text-rose-800" : "bg-red-500/20 border-red-500/50 text-white")}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              重置链接无效或已过期。请重新申请重置链接。
            </AlertDescription>
          </Alert>
          <div className="text-center">
            <Link href="/auth/forgot-password">
              <Button variant="link" className={cn("font-medium", isDesktop ? "text-violet-600 hover:text-violet-700" : "text-orange-300 hover:text-orange-200")}>
                重新申请重置链接
              </Button>
            </Link>
          </div>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title="重置密码"
      subtitle="设置您的新密码"
      footer={
        <div className={cn("mt-4 text-center text-xs", isDesktop ? "text-[#8b7aa8]" : "text-gray-200 drop-shadow")}>
          <p>&copy; 2024 矩时AI助手. 保留所有权利.</p>
        </div>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthPageShell>
  )
}

export default function ResetPasswordPage() {
  const { isDesktop } = useDesktopRuntime()

  return (
    <Suspense fallback={
      <AuthStateShell>
        <div className="text-center">
          <div className={cn("mx-auto h-8 w-8 animate-spin rounded-full border-b-2", isDesktop ? "border-violet-600" : "border-white")} />
          <p className={cn("mt-4", isDesktop ? "text-[#6d6680]" : "text-white/[0.65]")}>加载中...</p>
        </div>
      </AuthStateShell>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
