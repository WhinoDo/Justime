'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Users,
    ServerCog,
    KeyRound,
    Settings,
    LogOut,
    Menu,
    X,
    ShieldAlert,
    ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const { user, logout } = useAuth()
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)

    const menuItems = [
        { title: '概览仪表盘', icon: LayoutDashboard, href: '/admin' },
        { title: '用户管理', icon: Users, href: '/admin/users' },
        { title: '模型管理', icon: ServerCog, href: '/admin/models' },
        { title: 'API Key 管理', icon: KeyRound, href: '/admin/apikeys' },
        { title: '系统设置', icon: Settings, href: '/admin/settings' }
    ]

    if (!user || user.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
                <div className="text-center space-y-4">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">访问被拒绝</h1>
                    <p className="text-gray-500 dark:text-gray-400">仅管理员可访问此页面</p>
                    <Link href="/">
                        <Button variant="outline" className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">返回首页</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950 flex text-gray-900 dark:text-white">
            {/* Sidebar - macOS Preferences style */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-all duration-300 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
                        <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">聚时管理后台</span>
                        <button className="ml-auto lg:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => setIsSidebarOpen(false)}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                            return (
                                <Link key={item.href} href={item.href}>
                                    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                        isActive
                                            ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}>
                                        <item.icon className={`w-4 h-4 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`} />
                                        <span>{item.title}</span>
                                    </div>
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Back link */}
                    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800">
                        <Link href="/dashboard">
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                                <ArrowLeft className="w-4 h-4 text-gray-400" />
                                <span>返回普通控制台</span>
                            </div>
                        </Link>
                    </div>

                    {/* User Profile */}
                    <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-700 dark:text-purple-300 text-sm font-bold">
                                {user.displayName?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.displayName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                            </div>
                            <button onClick={logout} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="退出登录">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <div className="lg:hidden h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="ml-3 text-base font-semibold text-gray-900 dark:text-white">管理后台</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto animate-mac-fade-in">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}
