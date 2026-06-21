'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
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
import { API_ENDPOINTS } from '@/lib/api/endpoints'

export default function ProfilePage() {
    const { user, isAuthenticated, logout, isLoading, updateUser } = useAuth()
    const router = useRouter()
    const [isHabitLoading, setIsHabitLoading] = useState(false)
    const [isHabitSaving, setIsHabitSaving] = useState(false)
    const [habitSaveMessage, setHabitSaveMessage] = useState<string | null>(null)
    const [profileForm, setProfileForm] = useState({
        displayName: '',
        bio: '',
        phone: '',
        location: '',
        website: '',
        department: '',
        jobTitle: '',
    })
    const [habitForm, setHabitForm] = useState({
        occupation: '',
        currentStudyFocus: '',
        highEfficiencyPeriods: '',
        lowEfficiencyPeriods: '',
        weeklyUnavailableSlots: '',
        preferredFocusMinutes: 45,
        preferredBreakMinutes: 10,
        maxFocusSessionsPerDay: 4,
        planningPreference: '',
        notes: ''
    })

    const handleLogout = async () => {
        await logout()
        router.push('/auth?mode=login')
    }

    const parseListInput = (value: string): string[] => {
        return value
            .split(/\n|,/g)
            .map(item => item.trim())
            .filter(Boolean)
    }

    const loadHabitProfile = async () => {
        if (!isAuthenticated || !user) return
        setIsHabitLoading(true)
        setHabitSaveMessage(null)
        try {
            const response = await fetch(API_ENDPOINTS.AUTH.PROFILE, { credentials: 'include' })
            const result = await response.json()
            if (!result.success) return

            const profile = result.data?.user?.profile || {}
            const habits = profile.habits || {}
            setProfileForm({
                displayName: profile.displayName || user.displayName || '',
                bio: profile.bio || '',
                phone: profile.phone || '',
                location: profile.location || '',
                website: profile.website || '',
                department: profile.department || '',
                jobTitle: profile.jobTitle || '',
            })
            setHabitForm({
                occupation: habits.occupation || '',
                currentStudyFocus: habits.currentStudyFocus || '',
                highEfficiencyPeriods: Array.isArray(habits.highEfficiencyPeriods) ? habits.highEfficiencyPeriods.join('\n') : '',
                lowEfficiencyPeriods: Array.isArray(habits.lowEfficiencyPeriods) ? habits.lowEfficiencyPeriods.join('\n') : '',
                weeklyUnavailableSlots: Array.isArray(habits.weeklyUnavailableSlots) ? habits.weeklyUnavailableSlots.join('\n') : '',
                preferredFocusMinutes: Number(habits.preferredFocusMinutes || 45),
                preferredBreakMinutes: Number(habits.preferredBreakMinutes || 10),
                maxFocusSessionsPerDay: Number(habits.maxFocusSessionsPerDay || 4),
                planningPreference: habits.planningPreference || '',
                notes: habits.notes || ''
            })
        } catch (error) {
            console.error('加载习惯画像失败:', error)
        } finally {
            setIsHabitLoading(false)
        }
    }

    const handleSaveHabits = async () => {
        if (!user) return
        setIsHabitSaving(true)
        setHabitSaveMessage(null)
        try {
            const payload = {
                profile: {
                    ...(user.profile || {}),
                    name: user.profile?.name || user.displayName || user.username || '用户',
                    displayName: profileForm.displayName.trim() || user.displayName,
                    email: user.email,
                    bio: profileForm.bio.trim(),
                    phone: profileForm.phone.trim(),
                    location: profileForm.location.trim(),
                    website: profileForm.website.trim(),
                    department: profileForm.department.trim(),
                    jobTitle: profileForm.jobTitle.trim(),
                    habits: {
                        occupation: habitForm.occupation.trim(),
                        currentStudyFocus: habitForm.currentStudyFocus.trim(),
                        highEfficiencyPeriods: parseListInput(habitForm.highEfficiencyPeriods),
                        lowEfficiencyPeriods: parseListInput(habitForm.lowEfficiencyPeriods),
                        weeklyUnavailableSlots: parseListInput(habitForm.weeklyUnavailableSlots),
                        preferredFocusMinutes: Math.max(15, Math.min(180, Number(habitForm.preferredFocusMinutes || 45))),
                        preferredBreakMinutes: Math.max(5, Math.min(60, Number(habitForm.preferredBreakMinutes || 10))),
                        maxFocusSessionsPerDay: Math.max(1, Math.min(12, Number(habitForm.maxFocusSessionsPerDay || 4))),
                        planningPreference: habitForm.planningPreference.trim(),
                        notes: habitForm.notes.trim()
                    }
                }
            }

            const response = await fetch(API_ENDPOINTS.AUTH.PROFILE, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const result = await response.json()
            if (!result.success) {
                throw new Error(result.error || '保存失败')
            }
            const savedUser = result.data?.user
            if (savedUser) {
                updateUser({
                    profile: savedUser.profile,
                    displayName: savedUser.displayName
                })
            }
            setHabitSaveMessage('已保存，后续任务安排将参考你的习惯。')
        } catch (error) {
            console.error('保存习惯画像失败:', error)
            setHabitSaveMessage('保存失败，请稍后重试。')
        } finally {
            setIsHabitSaving(false)
        }
    }

    useEffect(() => {
        if (isAuthenticated && user) {
            loadHabitProfile()
        }
    }, [isAuthenticated, user?.id])

    if (isLoading) {
        return (
            <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
                <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="h-10 w-10 border-2 border-border border-t-foreground rounded-full animate-spin" />
                    <p className="text-muted-foreground text-sm font-light tracking-widest uppercase">Loading Profile</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated || !user) {
        return (
            <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-background">
                <div className="relative z-10 w-full max-w-md bg-card/80 backdrop-blur-xl border border-border p-8 rounded-3xl text-center space-y-6 shadow-2xl">
                    <div className="h-20 w-20 bg-muted rounded-full mx-auto flex items-center justify-center">
                        <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">未登录</h2>
                        <p className="text-muted-foreground">请先登录以管理您的数字身份</p>
                    </div>
                    <Link href="/auth?mode=login" className="block">
                        <Button className="w-full bg-muted hover:bg-accent text-foreground border-0 backdrop-blur-md transition-all">
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
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden font-sans bg-background">

            {/* Main Glass Container - Identity Hub */}
            <div className="relative z-10 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-700">

                {/* Navigation Header */}
                <div className="flex items-center justify-between mb-6 px-2">
                    <Link href="/dashboard">
                        <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-accent transition-colors gap-2 pl-2">
                            <ChevronRight className="h-4 w-4 rotate-180" />
                            <span className="tracking-wide">Back to Dashboard</span>
                        </Button>
                    </Link>
                </div>

                <div className="bg-card/80 backdrop-blur-2xl border border-border shadow-2xl rounded-[2.5rem] overflow-hidden">

                    {/* Hero Section */}
                    <div className="relative pt-12 pb-8 px-8 flex flex-col items-center text-center">
                        {/* Ambient Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/20 blur-[60px] rounded-full pointer-events-none" />

                        {/* Avatar Ring */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full opacity-75 group-hover:opacity-100 blur transition duration-500 animate-tilt"></div>
                            <div className="relative h-28 w-28 rounded-full p-1 bg-muted backdrop-blur-md ring-1 ring-border">
                                <div className="h-full w-full rounded-full overflow-hidden bg-muted flex items-center justify-center relative">
                                    {/* Fallback Initials */}
                                    <span className="text-3xl font-bold text-foreground/80 tracking-widest">{initials}</span>
                                    {/* Image Overlay (if available) */}
                                    <img
                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                        alt={user.username}
                                        className="absolute inset-0 w-full h-full object-cover opacity-90 hover:scale-110 transition-transform duration-500"
                                    />
                                </div>
                            </div>
                            <div className="absolute bottom-1 right-1 h-6 w-6 bg-emerald-500 rounded-full border-2 border-card shadow-lg flex items-center justify-center" title="Active">
                                <Sparkles className="h-3 w-3 text-emerald-100" />
                            </div>
                        </div>

                        {/* Name & Role */}
                        <div className="mt-5 space-y-1">
                            <h1 className="text-3xl font-bold text-foreground tracking-tight drop-shadow-md">
                                {user.displayName || user.username}
                            </h1>
                            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                                <span className="font-mono tracking-wider dark:text-muted-foreground">@{user.username}</span>
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                <Badge variant="outline" className={`border-0 backdrop-blur-md bg-muted px-2 py-0.5 text-xs font-medium tracking-wide ${isAdmin ? 'text-purple-500 ring-1 ring-purple-500/30 dark:text-purple-300' : 'text-blue-500 ring-1 ring-blue-500/30 dark:text-blue-300'}`}>
                                    {isAdmin ? 'ADMINISTRATOR' : 'MEMBER'}
                                </Badge>
                            </div>
                        </div>

                        {/* Stats / Metadata Grid */}
                        <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-sm">
                            <div className="bg-muted/50 border border-border rounded-2xl p-3 flex flex-col items-center transition-colors hover:bg-accent/50">
                                <span className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Joined</span>
                                <div className="flex items-center gap-1.5 text-foreground/90">
                                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="font-medium text-sm">{new Date().toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="bg-muted/50 border border-border rounded-2xl p-3 flex flex-col items-center transition-colors hover:bg-accent/50">
                                <span className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Status</span>
                                <div className="flex items-center gap-1.5 text-foreground/90">
                                    <Shield className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="font-medium text-sm">Protected</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="px-6 pb-8 space-y-4">

                        {/* Account Details */}
                        <div className="bg-muted/50 rounded-2xl p-1">
                            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-accent/50 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Email Address</p>
                                        <p className="text-foreground font-medium">{user.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Profile Info */}
                        <div className="bg-muted/50 rounded-2xl p-4 border border-border space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-foreground font-semibold">个人信息</h3>
                                    <p className="text-muted-foreground text-xs">设置您的展示名称、联系方式等基本信息</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                    value={profileForm.displayName}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, displayName: e.target.value }))}
                                    placeholder="显示名称"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    value={profileForm.phone}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="手机号码"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    value={profileForm.location}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="所在位置"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    value={profileForm.website}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, website: e.target.value }))}
                                    placeholder="个人网站"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    value={profileForm.department}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, department: e.target.value }))}
                                    placeholder="部门"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    value={profileForm.jobTitle}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                                    placeholder="职位"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                            </div>

                            <textarea
                                value={profileForm.bio}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                                placeholder="个人简介"
                                className="w-full h-20 rounded-xl bg-muted/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-blue-400/40"
                            />
                        </div>

                        {/* Work/Study Habits */}
                        <div className="bg-muted/50 rounded-2xl p-4 border border-border space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-foreground font-semibold">工作与学习习惯</h3>
                                    <p className="text-muted-foreground text-xs">模型会在任务安排和拆解时参考这些偏好</p>
                                </div>
                                {isHabitLoading && (
                                    <span className="text-muted-foreground text-xs">加载中...</span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                    value={habitForm.occupation}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, occupation: e.target.value }))}
                                    placeholder="你的工作角色（如：后端工程师）"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    value={habitForm.currentStudyFocus}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, currentStudyFocus: e.target.value }))}
                                    placeholder="当前学习重点（如：算法/英语）"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    type="number"
                                    min={15}
                                    max={180}
                                    value={habitForm.preferredFocusMinutes}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, preferredFocusMinutes: Number(e.target.value || 45) }))}
                                    placeholder="偏好专注时长（分钟）"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    type="number"
                                    min={5}
                                    max={60}
                                    value={habitForm.preferredBreakMinutes}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, preferredBreakMinutes: Number(e.target.value || 10) }))}
                                    placeholder="偏好休息时长（分钟）"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={habitForm.maxFocusSessionsPerDay}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, maxFocusSessionsPerDay: Number(e.target.value || 4) }))}
                                    placeholder="每日深度任务上限"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                                <input
                                    value={habitForm.planningPreference}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, planningPreference: e.target.value }))}
                                    placeholder="计划偏好（如：先难后易）"
                                    className="h-10 rounded-xl bg-muted/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/40"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <textarea
                                    value={habitForm.highEfficiencyPeriods}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, highEfficiencyPeriods: e.target.value }))}
                                    placeholder="高效时段（每行一条，如 09:00-11:30）"
                                    className="h-24 rounded-xl bg-muted/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-blue-400/40"
                                />
                                <textarea
                                    value={habitForm.lowEfficiencyPeriods}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, lowEfficiencyPeriods: e.target.value }))}
                                    placeholder="低效时段（每行一条）"
                                    className="h-24 rounded-xl bg-muted/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-blue-400/40"
                                />
                                <textarea
                                    value={habitForm.weeklyUnavailableSlots}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, weeklyUnavailableSlots: e.target.value }))}
                                    placeholder="不可用时段（如 周三 14:00-17:00）"
                                    className="h-24 rounded-xl bg-muted/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-blue-400/40"
                                />
                            </div>

                            <textarea
                                value={habitForm.notes}
                                onChange={(e) => setHabitForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="补充说明（如：午休后30分钟不排高强度任务）"
                                className="w-full h-20 rounded-xl bg-muted/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-blue-400/40"
                            />

                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{habitSaveMessage || '保存后自动应用到聊天任务规划'}</span>
                                <Button
                                    onClick={handleSaveHabits}
                                    disabled={isHabitSaving || isHabitLoading}
                                    className="h-10 px-5 bg-blue-500/20 hover:bg-blue-500/30 text-foreground border border-blue-400/30 rounded-xl"
                                >
                                    {isHabitSaving ? '保存中...' : '保存习惯'}
                                </Button>
                            </div>
                        </div>

                        {/* Navigation Menu */}
                        <div className="grid gap-3">
                            <Link href="/model-config?from=/profile">
                                <div className="group flex items-center justify-between p-4 bg-muted/50 border border-border rounded-2xl hover:bg-accent/50 hover:border-border transition-all cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-300 shadow-inner ring-1 ring-indigo-500/30">
                                            <Bot className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-foreground font-semibold">LLM Configuration</h3>
                                            <p className="text-muted-foreground text-sm">Model API keys & Agent settings</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                            </Link>

                            {isAdmin && (
                                <Link href="/admin">
                                    <div className="group flex items-center justify-between p-4 bg-muted/50 border border-border rounded-2xl hover:bg-accent/50 hover:border-border transition-all cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 dark:text-purple-300 shadow-inner ring-1 ring-purple-500/30">
                                                <LayoutDashboard className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-foreground font-semibold">Admin Panel</h3>
                                                <p className="text-muted-foreground text-sm">System stats & User management</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </div>
                                </Link>
                            )}
                        </div>

                        {/* Logout */}
                        <div className="pt-4">
                            <Button
                                variant="destructive"
                                className="w-full h-12 bg-rose-500/20 hover:bg-rose-500/30 text-foreground border border-rose-500/30 rounded-xl backdrop-blur-sm transition-all"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                <span>Sign Out</span>
                            </Button>
                        </div>

                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-muted-foreground/50 text-xs tracking-widest uppercase">Justime Agent System v1.0</p>
                </div>
            </div>
        </div>
    )
}