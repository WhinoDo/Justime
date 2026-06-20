'use client'

import { useEffect } from 'react'

/**
 * On mobile/narrow screens, we add maximum-scale=1 and user-scalable=no
 * to prevent accidental double-tap zoom. On desktop, we leave the viewport
 * unconstrained so Cmd/Ctrl+scroll zoom works (WCAG 1.4.4 compliance).
 *
 * Uses matchMedia instead of the resize event — more efficient and
 * semantically correct for breakpoint-driven behaviour.
 */
export function MobileViewportGuard() {
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]')
    if (!viewportMeta) return

    // matchMedia fires once immediately and then on every breakpoint change,
    // which is exactly the signal we need — no debounce required.
    const mql = window.matchMedia('(min-width: 768px)')

    const apply = (isDesktop: boolean) => {
      const current = viewportMeta.getAttribute('content') || ''
      if (isDesktop) {
        // Remove mobile-only constraints on desktop
        const cleaned = current
          .replace(/,\s*maximum-scale=[^,]+/g, '')
          .replace(/,\s*user-scalable=[^,]+/g, '')
        viewportMeta.setAttribute('content', cleaned)
      } else {
        if (!current.includes('maximum-scale')) {
          viewportMeta.setAttribute(
            'content',
            current + ', maximum-scale=1, user-scalable=no'
          )
        }
      }
    }

    // Apply for the current state
    apply(mql.matches)

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return null
}