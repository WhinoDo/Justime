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
        {
            title: '概览仪表盘',
            icon: LayoutDashboard,
            href: '/admin'
        },
        {
            title: '用户管理',
            icon: Users,
            href: '/admin/users'
        },
        {
            title: '模型管理',
            icon: ServerCog,
            href: '/admin/models'
        },
        {
            title: 'API Key 管理',
            icon: KeyRound,
            href: '/admin/apikeys'
        },
        {
            title: '系统设置',
            icon: Settings,
            href: '/admin/settings'
        }
    ]

    if (!user || user.role !== 'admin') {
        return (
            <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-background">
                <div className="relative z-10 text-center space-y-4">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
                    <h1 className="text-2xl font-bold text-white">访问被拒绝</h1>
                    <p className="text-white/70">仅管理员可访问此页面</p>
                    <Link href="/">
                        <Button variant="outline" className="border-white/30 bg-black/20 text-white hover:bg-white/10 hover:text-white">返回首页</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen relative overflow-hidden font-sans flex bg-background">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-black/20 backdrop-blur-xl border-r border-white/10 transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } lg:relative lg:translate-x-0`}
            >
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-6 border-b border-white/10">
                        <span className="text-xl font-bold text-white drop-shadow-md">
                            聚时管理后台
                        </span>
                        <button
                            className="ml-auto lg:hidden text-white/70 hover:text-white transition-colors"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                            return (
                                <Link key={item.href} href={item.href}>
                                    <div
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                                ? 'bg-white/20 text-white shadow-inner'
                                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/50'}`} />
                                        <span className="font-medium">{item.title}</span>
                                    </div>
                                </Link>
                            )
                        })}
                    </nav>

                    {/* 返回控制台 */}
                    <div className="px-4 py-2 border-t border-white/10">
                        <Link href="/dashboard">
                            <div className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-white/70 hover:bg-white/10 hover:text-white cursor-pointer">
                                <ArrowLeft className="w-5 h-5 text-white/50" />
                                <span className="font-medium text-sm">返回普通控制台</span>
                            </div>
                        </Link>
                    </div>

                    {/* User Profile */}
                    <div className="p-4 border-t border-white/10">
                        <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                                {user.displayName?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {user.displayName}
                                </p>
                                <p className="text-xs text-white/70 truncate">
                                    {user.email}
                                </p>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 text-white/60 hover:text-red-300 transition-colors"
                                title="退出登录"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <div className="lg:hidden h-16 bg-black/20 backdrop-blur-xl border-b border-white/10 flex items-center px-4 relative z-20">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-white/70"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="ml-4 text-lg font-semibold text-white">管理后台</span>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}
