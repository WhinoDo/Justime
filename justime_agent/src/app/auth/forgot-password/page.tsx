'use client'

import { AuthPageShell, AuthStateShell } from '@/components/auth/AuthPageShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { Suspense } from 'react'

function ForgotPasswordContent() {
  return (
    <AuthPageShell
      title="找回密码"
      subtitle="输入邮箱获取重置链接"
      footer={
        <div className="mt-4 text-center text-xs text-gray-200 drop-shadow">
          <p>&copy; 2024 矩时AI助手. 保留所有权利.</p>
        </div>
      }
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <AuthStateShell>
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          <p className="mt-4 text-white/65">加载中...</p>
        </div>
      </AuthStateShell>
    }>
      <ForgotPasswordContent />
    </Suspense>
  )
}
