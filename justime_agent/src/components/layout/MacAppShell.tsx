'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MacTitleBar } from '@/components/layout/MacTitleBar'
import { MacSidebar } from '@/components/layout/MacSidebar'
import { useDefaultGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { Menu } from 'lucide-react'

interface MacAppShellProps {
  children: React.ReactNode
}

// Routes that should NOT be wrapped in the macOS shell
const publicRoutes = ['/', '/auth', '/login', '/forgot-password', '/reset-password']

export function MacAppShell({ children }: MacAppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Register global keyboard shortcuts (Cmd+K, Cmd+N, Cmd+,)
  useDefaultGlobalShortcuts()

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Check if current route is a public route (no shell)
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === '/') return pathname === '/'
    return pathname.startsWith(route)
  })

  // For public routes (landing, auth), render children directly
  if (isPublicRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-950 dark:to-gray-900 p-0 md:p-4">
      <div
        className={cn(
          'flex flex-col h-screen md:h-[calc(100vh-32px)] w-full md:rounded-xl overflow-hidden',
          'bg-white dark:bg-gray-950',
          'shadow-mac'
        )}
      >
        {/* Title Bar with hamburger menu for mobile */}
        <div className="relative">
          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-gray-500 hover:bg-gray-200/60 dark:hover:bg-gray-700/40 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            aria-label="打开菜单"
          >
            <Menu className="h-4 w-4" />
          </button>
          <MacTitleBar />
        </div>

        {/* Body: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          <MacSidebar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
