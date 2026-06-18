'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Library,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: '仪表盘', href: '/dashboard', icon: LayoutDashboard },
  { label: 'AI 对话', href: '/chat', icon: MessageSquare },
  { label: '日程管理', href: '/calendar', icon: Calendar },
  { label: '知识库', href: '/knowledge', icon: Library },
  { label: '书籍分析', href: '/materials', icon: BookOpen },
  { label: '设置', href: '/profile', icon: Settings },
]

interface MacSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function MacSidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: MacSidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'flex flex-col bg-gray-100/80 backdrop-blur-xl dark:bg-gray-900/60 border-r border-gray-200/60 dark:border-gray-700/40 transition-all duration-300 ease-mac',
          'fixed md:relative z-50 h-full',
          collapsed ? 'w-[64px]' : 'w-[220px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'flex items-center justify-center h-10 mx-2 mt-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700/40 transition-colors',
            collapsed ? 'w-10 mx-auto' : 'w-10 ml-auto'
          )}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 px-[12px] py-2 space-y-[2px] overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg transition-colors duration-150',
                  'px-[12px] py-[8px]',
                  active
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-700/40 hover:text-gray-900 dark:hover:text-gray-200',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
                {!collapsed && (
                  <span className="text-[13px] font-medium truncate">{item.label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User info */}
        <div
          className={cn(
            'border-t border-gray-200/60 dark:border-gray-700/40 py-3',
            collapsed ? 'px-0 flex justify-center' : 'px-[12px]'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg',
              !collapsed && 'px-[12px] py-[8px]'
            )}
          >
            <div className="h-7 w-7 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-purple-500" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate">
                  {user?.displayName || user?.username || '用户'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
