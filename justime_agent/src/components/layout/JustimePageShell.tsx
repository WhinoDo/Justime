import * as React from 'react'

import { cn } from '@/lib/utils'

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
  fullHeight = false,
}: JustimePageShellProps) {
  return (
    <div
      className={cn(
        'relative bg-background',
        fullHeight ? 'h-screen' : 'min-h-screen',
        className
      )}
    >
      <div className={cn('relative z-10', fullHeight ? 'h-full' : 'min-h-screen', contentClassName)}>
        {children}
      </div>
    </div>
  )
}
