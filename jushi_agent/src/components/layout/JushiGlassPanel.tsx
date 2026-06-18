import * as React from 'react'

import { cn } from '@/lib/utils'

export function JushiGlassPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white shadow-md border',
        className
      )}
      {...props}
    />
  )
}
