'use client'

import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { ArrowLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { cn } from '@/lib/utils'

function ResetPasswordContent() {
  const { isDesktop } = useDesktopRuntime()

  if (isDesktop) {
    return (
      <JustimePageShell variant="desktop" blur="none" opacity={0} contentClassName="min-h-screen py-8 px-6 flex items-center justify-center">
        <div className="w-full max-w-md animate-in fade-in duration-700">
          <div className="bg-white/[0.68] border border-violet-200/[0.45] shadow-[0_24px_80px_rgba(112,77,171,0.12)] rounded-3xl overflow-hidden backdrop-blur-2xl p-8 space-y-6 text-[#171421]">

            {/* 返回按钮 */}
            <div className="flex justify-start">
              <Link href="/auth">
                <Button variant="ghost" size="sm" className="flex items-center gap-2 text-[#6d6680] hover:bg-violet-50 hover:text-[#171421]">
                  <ArrowLeft className="h-4 w-4" />
                  返回登录
                </Button>
              </Link>
            </div>

            {/* 品牌标识 */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl shadow-xl flex items-center justify-center transform hover:rotate-6 transition-all duration-300 border border-violet-200/50 backdrop-blur-md">
                  <Sparkles className="h-10 w-10 text-white animate-pulse" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-[#171421] mb-2 tracking-wide">
                重置密码
              </h1>
              <p className="text-[#6d6680] font-semibold tracking-wide">
                设置您的新密码
              </p>
            </div>

            {/* 重置密码表单容器 */}
            <div className="rounded-2xl border border-violet-200/30 bg-white/40 backdrop-blur-xl p-1.5 shadow-inner shadow-violet-100/50 text-[#171421]">
              <ResetPasswordForm />
            </div>

            {/* 底部信息 */}
            <div className="text-center mt-4 text-xs text-[#8b7aa8]">
              <p>© 2024 矩时AI助手. 保留所有权利.</p>
            </div>
          </div>
        </div>
      </JustimePageShell>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-background">

      {/* 磨砂玻璃容器 - 增强版 */}
      <div className="relative z-10 w-full max-w-md animate-slide-in">
        <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/[0.15] shadow-2xl rounded-3xl p-8 space-y-6 text-white transform hover:scale-[1.01] transition-all duration-500">

          {/* 返回按钮 */}
          <div className="flex justify-start">
            <Link href="/auth">
              <Button variant="ghost" size="sm" className="flex items-center gap-2 text-white hover:bg-white/20 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                返回登录
              </Button>
            </Link>
          </div>

          {/* 品牌标识 */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-400/90 to-indigo-600/90 rounded-2xl shadow-xl flex items-center justify-center transform hover:rotate-6 transition-all duration-300 border border-white/30 backdrop-blur-md">
                <Sparkles className="h-10 w-10 text-white animate-pulse" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md tracking-wide">
              重置密码
            </h1>
            <p className="text-gray-100 font-medium tracking-wide opacity-90">
              设置您的新密码
            </p>
          </div>

          {/* 重置密码表单容器 */}
          <div className="rounded-2xl border border-white/[0.15] bg-white/[0.03] backdrop-blur-xl p-1.5 shadow-inner shadow-black/10 text-gray-100">
            <ResetPasswordForm />
          </div>

          {/* 底部信息 */}
          <div className="text-center mt-4 text-xs text-gray-200 drop-shadow">
            <p>© 2024 矩时AI助手. 保留所有权利.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const { isDesktop } = useDesktopRuntime()

  return (
    <Suspense fallback={
      <div className={cn("min-h-screen flex items-center justify-center", isDesktop ? "bg-[#f4edff]" : "bg-gradient-to-br from-blue-50 to-indigo-100")}>
        <div className="text-center">
          <div className={cn("animate-spin rounded-full h-8 w-8 border-b-2 mx-auto", isDesktop ? "border-violet-600" : "border-blue-600")}></div>
          <p className={cn("mt-4 text-sm", isDesktop ? "text-[#6d6680]" : "text-gray-600")}>加载中...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
