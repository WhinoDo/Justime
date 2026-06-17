'use client'

import { useEffect } from 'react'
import { readDesktopRuntime } from '@/hooks/useDesktopRuntime'

interface DesktopRuntimeProviderProps {
  children: React.ReactNode
}

export function DesktopRuntimeProvider({ children }: DesktopRuntimeProviderProps) {
  useEffect(() => {
    const runtime = readDesktopRuntime()
    if (!runtime.isDesktop) {
      return
    }

    document.documentElement.dataset.justimeRuntime = 'desktop'
    document.documentElement.dataset.justimePlatform = runtime.platform
    document.documentElement.classList.add('desktop-runtime')

    return () => {
      document.documentElement.classList.remove('desktop-runtime')
    }
  }, [])

  return <>{children}</>
}
