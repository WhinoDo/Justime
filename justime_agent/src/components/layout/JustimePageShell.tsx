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
}

export function JustimePageShell({
  children,
  className,
  contentClassName,
  blur = 'lg',
  opacity = 0.45,
  fullHeight = false,
}: JustimePageShellProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        fullHeight ? 'h-screen' : 'min-h-screen',
        className
      )}
    >
      <JustimeBackground blur={blur} opacity={opacity} />
      <div className={cn('relative z-10', fullHeight ? 'h-full' : 'min-h-screen', contentClassName)}>
        {children}
      </div>
    </div>
  )
}
