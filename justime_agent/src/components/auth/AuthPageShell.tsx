'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { cn } from '@/lib/utils'
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
  const { isDesktop } = useDesktopRuntime()

  useGSAP(() => {
    gsap.fromTo(".animate-state-card",
      { scale: 0.95, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.5, ease: "power2.out" }
    )
  }, { scope: containerRef })

  return (
    <JustimePageShell fullHeight variant={isDesktop ? "desktop" : "immersive"} blur={isDesktop ? "none" : "xl"} opacity={isDesktop ? 0 : 0.3} contentClassName="flex min-h-screen items-center justify-center p-4">
      <div ref={containerRef} className="w-full max-w-md">
        <JustimeGlassPanel variant={isDesktop ? "desktop" : "glass"} className="animate-state-card w-full rounded-3xl p-8 text-center opacity-0">
          {children}
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}

export function AuthPageShell({ title, subtitle, children, footer }: AuthPageShellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isDesktop } = useDesktopRuntime()

  useGSAP(() => {
    // Beautiful reveal of the authentication card
    gsap.fromTo(".animate-auth-card",
      { scale: 0.96, y: 20, autoAlpha: 0 },
      { scale: 1, y: 0, autoAlpha: 1, duration: 0.6, ease: "back.out(1.2)" }
    )

    // Gentle rotate/bounce on the branding icon
    gsap.fromTo(".animate-brand-icon",
      { rotation: -10, scale: 0.8 },
      { rotation: 0, scale: 1, duration: 0.8, delay: 0.2, ease: "elastic.out(1, 0.5)" }
    )
  }, { scope: containerRef })

  return (
    <JustimePageShell fullHeight variant={isDesktop ? "desktop" : "immersive"} blur={isDesktop ? "none" : "xl"} opacity={isDesktop ? 0 : 0.3} contentClassName="flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div ref={containerRef} className="w-full max-w-md">
        <JustimeGlassPanel variant={isDesktop ? "desktop" : "glass"} className="animate-auth-card relative z-10 w-full space-y-6 rounded-3xl p-8 opacity-0">
          <div className="flex justify-start">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex items-center gap-2",
                  isDesktop ? "text-[#6d6680] hover:bg-violet-50 hover:text-[#171421]" : "text-white hover:bg-white/20 hover:text-white"
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>

          <div className="text-center">
            <div className="mb-6 flex items-center justify-center">
              <div
                className={cn(
                  "animate-brand-icon flex h-20 w-20 items-center justify-center rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 hover:rotate-6",
                  isDesktop
                    ? "border-violet-200/50 bg-gradient-to-br from-violet-500 to-indigo-600"
                    : "border-white/30 bg-gradient-to-br from-orange-400/90 to-yellow-600/90"
                )}
              >
                <Sparkles className="h-10 w-10 animate-pulse text-white" />
              </div>
            </div>
            <h1
              className={cn(
                "mb-2 text-3xl font-bold tracking-wide",
                isDesktop ? "text-[#171421]" : "text-white drop-shadow-md"
              )}
            >
              {title}
            </h1>
            <p
              className={cn(
                "font-semibold tracking-wide",
                isDesktop ? "text-[#6d6680]" : "text-gray-100 opacity-90"
              )}
            >
              {subtitle}
            </p>
          </div>

          <div
            className={cn(
              "rounded-2xl border backdrop-blur-xl p-1.5",
              isDesktop
                ? "border-violet-200/30 bg-white/40 text-[#171421] shadow-inner shadow-violet-100/50"
                : "border-white/[0.15] bg-white/[0.03] text-gray-100 shadow-inner shadow-black/10"
            )}
          >
            {children}
          </div>

          {footer ? footer : null}
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}
