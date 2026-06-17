'use client'

import { useEffect, useState } from 'react'

interface DesktopRuntimeState {
  isDesktop: boolean
  isMac: boolean
  platform: string
  versions: {
    chrome?: string
    electron?: string
    node?: string
  }
}

const initialState: DesktopRuntimeState = {
  isDesktop: false,
  isMac: false,
  platform: 'web',
  versions: {},
}

export function readDesktopRuntime(): DesktopRuntimeState {
  if (typeof window === 'undefined') {
    return initialState
  }

  const bridge = window.justimeDesktop
  const runtimeDataset = document.documentElement.dataset.justimeRuntime
  const platformDataset = document.documentElement.dataset.justimePlatform
  const isDesktop = Boolean(bridge?.isDesktop) || runtimeDataset === 'desktop'
  const platform = bridge?.platform || platformDataset || 'web'

  return {
    isDesktop,
    isMac: Boolean(bridge?.isMac) || platform === 'darwin',
    platform,
    versions: bridge?.versions || {},
  }
}

export function useDesktopRuntime() {
  const [runtime, setRuntime] = useState<DesktopRuntimeState>(initialState)

  useEffect(() => {
    setRuntime(readDesktopRuntime())
  }, [])

  return runtime
}
