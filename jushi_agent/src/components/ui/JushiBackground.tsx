import React from 'react'
import { cn } from '@/lib/utils'

interface JushiBackgroundProps {
    className?: string
    blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    opacity?: number
}

export function JushiBackground({
    className,
}: JushiBackgroundProps) {
    return (
        <div className={cn("absolute inset-0 z-0 bg-background", className)} />
    )
}
