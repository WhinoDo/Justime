import * as React from 'react'

import { cn } from '@/lib/utils'
import { JustimeBackground } from '@/components/ui/JustimeBackground'

interface JustimePageShellProps {
  children: React.ReactNode
  className?: string
  contentClassName?: string
  blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  opacity?: number
  fullHeight?: boolean
  variant?: 'immersive' | 'desktop'
}

export function JustimePageShell({
  children,
  className,
  contentClassName,
  blur = 'lg',
  opacity = 0.45,
  fullHeight = false,
  variant = 'immersive',
}: JustimePageShellProps) {
  return (
    <div
      className={cn(
        'relative',
        fullHeight ? 'justime-app' : 'min-h-screen overflow-hidden',
        variant === 'desktop' && 'bg-[#fbfaff] text-[#171421]',
        className
      )}
    >
      <JustimeBackground blur={blur} opacity={opacity} />
      <div className={cn(
        'relative z-10',
        fullHeight ? 'h-full local-scroll' : 'min-h-screen',
        variant === 'desktop' && 'desktop-titlebar-safe',
        contentClassName
      )}>
        {children}
      </div>
    </div>
  )
}
