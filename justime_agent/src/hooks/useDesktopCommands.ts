'use client'

import { useEffect } from 'react'
import type { JustimeDesktopCommand } from '@/types/desktop'

export function useDesktopCommands(
  handler: (command: JustimeDesktopCommand) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const unsubscribe = window.justimeDesktop?.onCommand?.((command) => {
      handler(command)
    })

    return () => {
      unsubscribe?.()
    }
  }, [enabled, handler])
}
