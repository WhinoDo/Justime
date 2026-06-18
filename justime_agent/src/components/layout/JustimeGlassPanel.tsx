import * as React from 'react'

import { cn } from '@/lib/utils'

export function JustimeGlassPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white/70 backdrop-blur-2xl border border-gray-200/50 shadow-mac',
        'dark:bg-gray-800/80 dark:border-gray-600/30',
        className
      )}
      {...props}
    />
  )
}
