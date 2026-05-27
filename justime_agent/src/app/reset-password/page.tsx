'use client'

import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { ArrowLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function ResetPasswordContent() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* 全屏背景图 */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/justime_login_bg.png"
          alt="Justime Background"
          className="w-full h-full object-cover"
        />
        {/* 黑色遮罩，确保文字可读性 */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
      </div>

      {/* 磨砂玻璃容器 - 增强版 */}
      <div className="relative z-10 w-full max-w-md animate-slide-in">
        <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/15 shadow-2xl rounded-3xl p-8 space-y-6 text-white transform hover:scale-[1.01] transition-all duration-500">

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
              <div className="w-20 h-20 bg-gradient-to-br from-orange-400/90 to-yellow-600/90 rounded-2xl shadow-xl flex items-center justify-center transform hover:rotate-6 transition-all duration-300 border border-white/30 backdrop-blur-md">
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
          <div className="rounded-2xl border border-white/15 bg-white/[0.03] backdrop-blur-xl p-1.5 shadow-inner shadow-black/10 text-gray-100">
            <ResetPasswordForm />
          </div>

          {/* 底部信息 */}
          <div className="text-center mt-4 text-xs text-gray-200 drop-shadow">
            <p>© 2024 聚时AI助手. 保留所有权利.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
