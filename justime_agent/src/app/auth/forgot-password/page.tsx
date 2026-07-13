'use client'

import { AuthPageShell, AuthStateShell } from '@/components/auth/AuthPageShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { Suspense } from 'react'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { cn } from '@/lib/utils'

function ForgotPasswordContent() {
  const { isDesktop } = useDesktopRuntime()

  return (
    <AuthPageShell
      title="找回密码"
      subtitle="输入邮箱获取重置链接"
      footer={
        <div className={cn("mt-4 text-center text-xs", isDesktop ? "text-[#8b7aa8]" : "text-gray-200 drop-shadow")}>
          <p>&copy; 2024 Justime AI 助手. 保留所有权利.</p>
        </div>
      }
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  )
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordContent />
    </Suspense>
  )
}
