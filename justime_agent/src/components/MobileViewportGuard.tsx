'use client'

import { useEffect } from 'react'

/**
 * On mobile/narrow screens, we add maximum-scale=1 and user-scalable=no
 * to prevent accidental double-tap zoom. On desktop, we leave the viewport
 * unconstrained so Cmd/Ctrl+scroll zoom works (WCAG 1.4.4 compliance).
 */
export function MobileViewportGuard() {
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]')
    if (!viewportMeta) return

    const applyMobileConstraint = () => {
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        const current = viewportMeta.getAttribute('content') || ''
        if (!current.includes('maximum-scale')) {
          viewportMeta.setAttribute(
            'content',
            current + ', maximum-scale=1, user-scalable=no'
          )
        }
      } else {
        // Remove mobile-only constraints on desktop
        const current = viewportMeta.getAttribute('content') || ''
        const cleaned = current
          .replace(/,\s*maximum-scale=[^,]+/g, '')
          .replace(/,\s*user-scalable=[^,]+/g, '')
        viewportMeta.setAttribute('content', cleaned)
      }
    }

    applyMobileConstraint()
    window.addEventListener('resize', applyMobileConstraint)
    return () => window.removeEventListener('resize', applyMobileConstraint)
  }, [])

  return null
}