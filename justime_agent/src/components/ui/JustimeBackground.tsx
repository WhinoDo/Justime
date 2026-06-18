import React from 'react'
import { cn } from '@/lib/utils'

interface JustimeBackgroundProps {
    className?: string
    blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    opacity?: number
}

export function JustimeBackground({
    className,
    blur = 'md',
    opacity = 0.4
}: JustimeBackgroundProps) {
    // Map blur values to tailwind classes
    const blurClass = {
        'none': '',
        'sm': 'backdrop-blur-sm',
        'md': 'backdrop-blur-md',
        'lg': 'backdrop-blur-lg',
        'xl': 'backdrop-blur-xl',
        '2xl': 'backdrop-blur-2xl',
        '3xl': 'backdrop-blur-3xl',
    }[blur]

    return (
        <div className={cn("absolute inset-0 z-0 overflow-hidden", className)}>
            {/* macOS 风格渐变背景 — Light */}
            <div
                className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:hidden"
            />

            {/* macOS 风格渐变背景 — Dark */}
            <div
                className="absolute inset-0 bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-900 hidden dark:block"
            />

            {/* Color Overlay / Tint */}
            <div
                className="absolute inset-0 bg-black"
                style={{ opacity: opacity }}
            />

            {/* Blur Layer */}
            <div className={cn("absolute inset-0", blurClass)} />

            {/* Gradient Overlay for Depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
        </div>
    )
}
