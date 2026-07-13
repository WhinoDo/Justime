'use client'

import { cn } from '@/lib/utils'

interface MacTitleBarProps {
  title?: string
  className?: string
}

export function MacTitleBar({ title = 'Justime', className }: MacTitleBarProps) {
  return (
    <div
      className={cn(
        'mac-titlebar relative flex h-[52px] items-center justify-center',
        'bg-white/80 backdrop-blur-2xl dark:bg-gray-900/80',
        'border-b border-gray-200/60 dark:border-gray-700/40',
        'select-none',
        className
      )}
      style={
        { WebkitAppRegion: 'drag' } as React.CSSProperties
      }
    >
      {/* Traffic Light Buttons */}
      <div
        className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-[8px] mac-traffic-lights"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Red - Close */}
        <div className="group relative flex items-center justify-center">
          <div
            className="h-3 w-3 rounded-full bg-[#FF5F57] transition-shadow duration-150 group-hover:shadow-[0_0_4px_rgba(255,95,87,0.6)]"
          />
          <svg
            className="absolute inset-0 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            viewBox="0 0 12 12"
            fill="none"
            stroke="#4A1A1A"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" />
            <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" />
          </svg>
        </div>

        {/* Yellow - Minimize */}
        <div className="group relative flex items-center justify-center">
          <div
            className="h-3 w-3 rounded-full bg-[#FEBC2E] transition-shadow duration-150 group-hover:shadow-[0_0_4px_rgba(254,188,46,0.6)]"
          />
          <svg
            className="absolute inset-0 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            viewBox="0 0 12 12"
            fill="none"
            stroke="#4A3A00"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="9" y2="6" />
          </svg>
        </div>

        {/* Green - Maximize / Zoom */}
        <div className="group relative flex items-center justify-center">
          <div
            className="h-3 w-3 rounded-full bg-[#28C840] transition-shadow duration-150 group-hover:shadow-[0_0_4px_rgba(40,200,64,0.6)]"
          />
          <svg
            className="absolute inset-0 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            viewBox="0 0 12 12"
            fill="none"
            stroke="#003A10"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2.5" y="2.5" width="7" height="7" rx="0.5" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
        {title}
      </span>
    </div>
  )
}
