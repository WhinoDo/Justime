'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UseAuthRedirectOptions {
  isLoading: boolean
  isAuthenticated: boolean
  redirectTo: string
  mode?: 'push' | 'replace' | 'href'
}

export function useAuthRedirect({
  isLoading,
  isAuthenticated,
  redirectTo,
  mode = 'href',
}: UseAuthRedirectOptions) {
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return
    }

    if (mode === 'push') {
      router.push(redirectTo)
      return
    }

    if (mode === 'replace') {
      router.replace(redirectTo)
      return
    }

    window.location.href = redirectTo
  }, [isLoading, isAuthenticated, redirectTo, mode, router])
}
