'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    User,
    Settings,
    LogOut,
    Mail,
    Shield,
    Bot,
    ChevronRight,
    Clock,
    Sparkles,
    LayoutDashboard
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
    const { user, isAuthenticated, logout, isLoading } = useAuth()
    const router = useRouter()

    const handleLogout = async () => {
        await logout()
        router.push('/auth?mode=login')
    }

    if (isLoading) {
        return (
            <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img src="/images/jushi_login_bg.png" alt="Background" className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl" />
                </div>
                <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="h-10 w-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <p className="text-white/60 text-sm font-light tracking-widest uppercase">Loading Profile</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated || !user) {
        return (
            <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img src="/images/jushi_login_bg.png" alt="Background" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                </div>
                <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl text-center space-y-6 shadow-2xl">
                    <div className="h-20 w-20 bg-white/10 rounded-full mx-auto flex items-center justify-center">
                        <User className="h-10 w-10 text-white/70" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">未登录</h2>
                        <p className="text-white/60">请先登录以管理您的数字身份</p>
                    </div>
                    <Link href="/auth?mode=login" className="block">
                        <Button className="w-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md transition-all">
                            前往登录
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    // Initials
    const initials = user.username?.slice(0, 2).toUpperCase() || 'U'
    const isAdmin = user.role === 'admin'

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden font-sans">
            {/* Full Screen Background */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/images/jushi_login_bg.png"
                    alt="Jushi Background"
                    className="w-full h-full object-cover scale-105"
                />
                {/* Overlay for better text contrast */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            </div>

            {/* Main Glass Container - Identity Hub */}
            <div className="relative z-10 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-700">

                {/* Navigation Header */}
                <div className="flex items-center justify-between mb-6 px-2">
                    <Link href="/dashboard">
                        <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 transition-colors gap-2 pl-2">
                            <ChevronRight className="h-4 w-4 rotate-180" />
                            <span className="tracking-wide">Back to Dashboard</span>
                        </Button>
                    </Link>
                </div>

                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-[2.5rem] overflow-hidden">

                    {/* Hero Section */}
                    <div className="relative pt-12 pb-8 px-8 flex flex-col items-center text-center">
                        {/* Ambient Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/20 blur-[60px] rounded-full pointer-events-none" />

                        {/* Avatar Ring */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full opacity-75 group-hover:opacity-100 blur transition duration-500 animate-tilt"></div>
                            <div className="relative h-28 w-28 rounded-full p-1 bg-black/20 backdrop-blur-md ring-1 ring-white/30">
                                <div className="h-full w-full rounded-full overflow-hidden bg-white/10 flex items-center justify-center relative">
                                    {/* Fallback Initials */}
                                    <span className="text-3xl font-bold text-white/80 tracking-widest">{initials}</span>
                                    {/* Image Overlay (if available) */}
                                    <img
                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                        alt={user.username}
                                        className="absolute inset-0 w-full h-full object-cover opacity-90 hover:scale-110 transition-transform duration-500"
                                    />
                                </div>
                            </div>
                            <div className="absolute bottom-1 right-1 h-6 w-6 bg-emerald-500 rounded-full border-2 border-white/10 shadow-lg flex items-center justify-center" title="Active">
                                <Sparkles className="h-3 w-3 text-emerald-100" />
                            </div>
                        </div>

                        {/* Name & Role */}
                        <div className="mt-5 space-y-1">
                            <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">
                                {user.displayName || user.username}
                            </h1>
                            <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                                <span className="font-mono tracking-wider">@{user.username}</span>
                                <span className="w-1 h-1 rounded-full bg-white/30" />
                                <Badge variant="outline" className={`border-0 backdrop-blur-md bg-white/10 px-2 py-0.5 text-xs font-medium tracking-wide ${isAdmin ? 'text-purple-200 ring-1 ring-purple-500/30' : 'text-blue-200 ring-1 ring-blue-500/30'}`}>
                                    {isAdmin ? 'ADMINISTRATOR' : 'MEMBER'}
                                </Badge>
                            </div>
                        </div>

                        {/* Stats / Metadata Grid */}
                        <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-sm">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center transition-colors hover:bg-white/10">
                                <span className="text-white/40 text-xs uppercase tracking-widest mb-1">Joined</span>
                                <div className="flex items-center gap-1.5 text-white/90">
                                    <Clock className="h-3.5 w-3.5 text-blue-400" />
                                    <span className="font-medium text-sm">{new Date().toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center transition-colors hover:bg-white/10">
                                <span className="text-white/40 text-xs uppercase tracking-widest mb-1">Status</span>
                                <div className="flex items-center gap-1.5 text-white/90">
                                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="font-medium text-sm">Protected</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="px-6 pb-8 space-y-4">

                        {/* Account Details */}
                        <div className="bg-black/20 rounded-2xl p-1">
                            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 group-hover:text-blue-300 group-hover:bg-blue-500/20 transition-all">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-white/40 uppercase tracking-wider">Email Address</p>
                                        <p className="text-white/90 font-medium">{user.email}</p>
                                    </div>
                                </div>
                                {/* <Button size="sm" variant="ghost" className="text-white/40 hover:text-white hover:bg-white/10 h-8 text-xs">Edit</Button> */}
                            </div>
                        </div>

                        {/* Navigation Menu */}
                        <div className="grid gap-3">
                            <Link href="/model-config?from=/profile">
                                <div className="group flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] transition-all cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 shadow-inner ring-1 ring-indigo-500/30">
                                            <Bot className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-semibold">LLM Configuration</h3>
                                            <p className="text-white/40 text-sm">Model API keys & Agent settings</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-white/60 transition-colors" />
                                </div>
                            </Link>

                            {isAdmin && (
                                <Link href="/admin">
                                    <div className="group flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] transition-all cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 shadow-inner ring-1 ring-purple-500/30">
                                                <LayoutDashboard className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-semibold">Admin Panel</h3>
                                                <p className="text-white/40 text-sm">System stats & User management</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-white/60 transition-colors" />
                                    </div>
                                </Link>
                            )}
                        </div>

                        {/* Logout */}
                        <div className="pt-4">
                            <Button
                                variant="destructive"
                                className="w-full h-12 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-xl backdrop-blur-sm transition-all"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                <span>Sign Out</span>
                            </Button>
                        </div>

                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-white/20 text-xs tracking-widest uppercase">Jushi Agent System v1.0</p>
                </div>
            </div>
        </div>
    )
}
