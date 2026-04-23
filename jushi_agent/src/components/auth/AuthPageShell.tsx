'use client'

import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JushiGlassPanel } from '@/components/layout/JushiGlassPanel'
import { JushiPageShell } from '@/components/layout/JushiPageShell'

interface AuthPageShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthStateShell({ children }: { children: React.ReactNode }) {
  return (
    <JushiPageShell contentClassName="flex min-h-screen items-center justify-center p-4" blur="xl" opacity={0.3}>
      <JushiGlassPanel className="w-full max-w-md rounded-3xl p-8 text-center text-white">
        {children}
      </JushiGlassPanel>
    </JushiPageShell>
  )
}

export function AuthPageShell({ title, subtitle, children, footer }: AuthPageShellProps) {
  return (
    <JushiPageShell contentClassName="flex min-h-screen items-center justify-center overflow-hidden p-4" blur="xl" opacity={0.3}>
      <JushiGlassPanel className="relative z-10 w-full max-w-md animate-slide-in space-y-6 rounded-3xl p-8 text-white transition-all duration-500 hover:scale-[1.01]">
        <div className="flex justify-start">
          <Link href="/">
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-white hover:bg-white/20 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Button>
          </Link>
        </div>

        <div className="text-center">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br from-orange-400/90 to-yellow-600/90 shadow-xl backdrop-blur-md transition-all duration-300 hover:rotate-6">
              <Sparkles className="h-10 w-10 animate-pulse text-white" />
            </div>
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-wide text-white drop-shadow-md">{title}</h1>
          <p className="font-medium tracking-wide text-gray-100 opacity-90">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-1.5 text-gray-100 shadow-inner shadow-black/10 backdrop-blur-xl">
          {children}
        </div>

        {footer ? footer : null}
      </JushiGlassPanel>
    </JushiPageShell>
  )
}
