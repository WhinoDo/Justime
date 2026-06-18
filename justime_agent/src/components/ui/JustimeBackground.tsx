import React from 'react'
import { cn } from '@/lib/utils'

interface JustimeBackgroundProps {
    className?: string
    blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    opacity?: number
}

export function JustimeBackground({
    className,
}: JustimeBackgroundProps) {
    return (
        <div className={cn("absolute inset-0 z-0 bg-background", className)} />
    )
}
