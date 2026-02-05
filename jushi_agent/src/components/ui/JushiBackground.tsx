import React from 'react'
import { cn } from '@/lib/utils'

interface JushiBackgroundProps {
    className?: string
    blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    opacity?: number
}

export function JushiBackground({
    className,
    blur = 'md',
    opacity = 0.4
}: JushiBackgroundProps) {
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
            {/* Main Background Image */}
            <img
                src="/images/jushi_login_bg.png"
                alt="Jushi Background"
                className="w-full h-full object-cover scale-105"
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
