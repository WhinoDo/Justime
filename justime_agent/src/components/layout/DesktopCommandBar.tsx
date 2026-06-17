import * as React from 'react'
import { cn } from '@/lib/utils'

interface DesktopCommandBarProps {
  children: React.ReactNode
  className?: string
}

export function DesktopCommandBar({ children, className }: DesktopCommandBarProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {children}
    </div>
  )
}
