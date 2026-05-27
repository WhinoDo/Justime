import * as React from 'react'

import { cn } from '@/lib/utils'

export function JustimeGlassPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-xl',
        className
      )}
      {...props}
    />
  )
}
