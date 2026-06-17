'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface DesktopAppFrameProps {
  title: string
  subtitle?: string
  sidebar?: React.ReactNode
  inspector?: React.ReactNode
  toolbar?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function DesktopAppFrame({
  title,
  subtitle,
  sidebar,
  inspector,
  toolbar,
  children,
  className,
}: DesktopAppFrameProps) {
  return (
    <div
      data-testid="desktop-app-frame"
      className={cn('grid h-screen min-h-0 grid-rows-[var(--desktop-titlebar-height)_1fr]', className)}
    >
      <header className="desktop-drag-region flex items-center border-b border-violet-200/40 bg-white/[0.58] pl-24 pr-4 shadow-[0_12px_36px_rgba(112,77,171,0.08)] backdrop-blur-2xl">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[13px] font-semibold leading-5 text-[#171421]">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[11px] leading-4 text-[#6d6680]">{subtitle}</p>
          ) : null}
        </div>
        {toolbar ? (
          <div className="desktop-no-drag ml-4 flex items-center gap-2">
            {toolbar}
          </div>
        ) : null}
      </header>

      <div className="grid min-h-0 grid-cols-[var(--desktop-sidebar-width)_minmax(0,1fr)]">
        {sidebar ? <aside className="min-h-0 border-r border-violet-200/40 bg-white/[0.42] backdrop-blur-2xl">{sidebar}</aside> : null}
        <main
          className={cn(
            'grid min-h-0',
            inspector ? 'grid-cols-[minmax(0,1fr)_var(--desktop-inspector-width)]' : 'grid-cols-1',
            !sidebar && 'col-span-2',
          )}
        >
          <section className="min-h-0 min-w-0">{children}</section>
          {inspector ? <aside className="min-h-0 border-l border-violet-200/40 bg-[#f7f2ff]/[0.56] backdrop-blur-2xl">{inspector}</aside> : null}
        </main>
      </div>
    </div>
  )
}
