'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

// Register the useGSAP plugin
gsap.registerPlugin(useGSAP)

interface AuthPageShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthStateShell({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from(".animate-state-card", {
      scale: 0.95,
      autoAlpha: 0,
      duration: 0.5,
      ease: "power2.out"
    })
  }, { scope: containerRef })

  return (
    <JustimePageShell contentClassName="flex min-h-screen items-center justify-center p-4" blur="xl" opacity={0.3}>
      <div ref={containerRef} className="w-full max-w-md">
        <JustimeGlassPanel className="animate-state-card w-full rounded-3xl p-8 text-center text-white opacity-0">
          {children}
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}

export function AuthPageShell({ title, subtitle, children, footer }: AuthPageShellProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    // Beautiful reveal of the authentication card
    gsap.from(".animate-auth-card", {
      scale: 0.96,
      y: 20,
      autoAlpha: 0,
      duration: 0.6,
      ease: "back.out(1.2)"
    })

    // Gentle rotate/bounce on the branding icon
    gsap.from(".animate-brand-icon", {
      rotation: -10,
      scale: 0.8,
      duration: 0.8,
      delay: 0.2,
      ease: "elastic.out(1, 0.5)"
    })
  }, { scope: containerRef })

  return (
    <JustimePageShell contentClassName="flex min-h-screen items-center justify-center overflow-hidden p-4" blur="xl" opacity={0.3}>
      <div ref={containerRef} className="w-full max-w-md">
        <JustimeGlassPanel className="animate-auth-card relative z-10 w-full space-y-6 rounded-3xl p-8 text-white opacity-0">
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
              <div className="animate-brand-icon flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br from-purple-400/90 to-indigo-600/90 shadow-xl backdrop-blur-md transition-all duration-300 hover:rotate-6">
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
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}
