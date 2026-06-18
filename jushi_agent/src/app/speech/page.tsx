'use client'

import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'
import { JushiPageShell } from '@/components/layout/JushiPageShell'
import { JushiGlassPanel } from '@/components/layout/JushiGlassPanel'
import { SpeechPanel } from '@/components/speech/SpeechPanel'
import dynamic from 'next/dynamic'

export default function SpeechPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <JushiPageShell fullHeight blur="xl" contentClassName="flex items-center justify-center px-4">
        <JushiGlassPanel className="rounded-3xl px-8 py-10 text-center">
          <div className="space-y-4">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-white" />
            <p className="text-sm uppercase tracking-widest text-white/60">Loading Speech Interface</p>
          </div>
        </JushiGlassPanel>
      </JushiPageShell>
    )
  }

  if (!user) {
    return null
  }

  return (
    <JushiPageShell fullHeight blur="lg" opacity={0.35} contentClassName="flex items-center justify-center p-4 md:p-8">
      <div className="flex w-full max-w-4xl flex-col items-center gap-8">
        {/* Page header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            语音交互
          </h1>
          <p className="mt-2 text-sm text-white/50">
            语音输入 · 文字转语音 · 智能交互
          </p>
        </div>

        {/* Main speech panel */}
        <SpeechPanel />

        {/* Feature info cards */}
        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
          <JushiGlassPanel className="rounded-2xl p-5">
            <h3 className="mb-2 text-sm font-semibold text-white/80">🎤 语音输入</h3>
            <p className="text-xs leading-relaxed text-white/40">
              点击麦克风按钮开始录音，浏览器实时将语音转换为文字。支持中文普通话识别。
            </p>
          </JushiGlassPanel>
          <JushiGlassPanel className="rounded-2xl p-5">
            <h3 className="mb-2 text-sm font-semibold text-white/80">🔊 文字转语音</h3>
            <p className="text-xs leading-relaxed text-white/40">
              输入或粘贴文字内容，点击播放按钮即可通过浏览器朗读。支持语速和音调调节。
            </p>
          </JushiGlassPanel>
        </div>
      </div>
    </JushiPageShell>
  )
}
