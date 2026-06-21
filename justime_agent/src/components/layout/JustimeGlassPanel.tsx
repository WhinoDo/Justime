import * as React from 'react'

import { cn } from '@/lib/utils'

interface JustimeGlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'desktop' | 'sidebar' | 'inspector'
}

const panelVariants = {
  glass: 'border border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-xl',
  desktop: 'border border-violet-200/40 bg-white/70 text-[#171421] shadow-[0_24px_80px_rgba(112,77,171,0.14)] backdrop-blur-2xl',
  sidebar: 'border-r border-violet-200/40 bg-white/[0.62] text-[#171421] shadow-none backdrop-blur-2xl',
  inspector: 'border-l border-violet-200/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,237,255,0.74))] text-[#171421] shadow-none backdrop-blur-2xl',
} as const

export function JustimeGlassPanel({
  className,
  variant = 'glass',
  ...props
}: JustimeGlassPanelProps) {
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
