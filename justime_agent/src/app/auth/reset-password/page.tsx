'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthPageShell, AuthStateShell } from '@/components/auth/AuthPageShell'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
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
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          <p className="mt-4 text-white/65">加载中...</p>
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
          <div className="mt-4 text-center text-xs text-gray-200 drop-shadow">
            <p>&copy; 2024 聚时AI助手. 保留所有权利.</p>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert variant="destructive" className="bg-red-500/20 border-red-500/50 text-white">
            <AlertCircle className="h-4 w-4 text-red-200" />
            <AlertDescription>
              重置链接无效或已过期。请重新申请重置链接。
            </AlertDescription>
          </Alert>
          <div className="text-center">
            <Link href="/auth/forgot-password">
              <Button variant="link" className="text-orange-300 hover:text-orange-200">
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
        <div className="mt-4 text-center text-xs text-gray-200 drop-shadow">
          <p>&copy; 2024 聚时AI助手. 保留所有权利.</p>
        </div>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthPageShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthStateShell>
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          <p className="mt-4 text-white/65">加载中...</p>
        </div>
      </AuthStateShell>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
