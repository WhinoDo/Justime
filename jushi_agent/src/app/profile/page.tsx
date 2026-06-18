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
    LayoutDashboard,
    Save,
    Loader2,
    ArrowLeft,
    BookOpen,
    Brain,
    Sun,
    Moon
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

export default function ProfilePage() {
    const { user, isAuthenticated, logout, isLoading, updateUser } = useAuth()
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'profile' | 'habits'>('profile')
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
        return value.split(/\n|,/g).map(item => item.trim()).filter(Boolean)
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
        } finally { setIsHabitLoading(false) }
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
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const result = await response.json()
            if (!result.success) throw new Error(result.error || '保存失败')
            const savedUser = result.data?.user
            if (savedUser) updateUser({ profile: savedUser.profile, displayName: savedUser.displayName })
            setHabitSaveMessage('已保存，后续任务安排将参考你的习惯。')
        } catch (error) {
            console.error('保存习惯画像失败:', error)
            setHabitSaveMessage('保存失败，请稍后重试。')
        } finally { setIsHabitSaving(false) }
    }

    useEffect(() => { if (isAuthenticated && user) loadHabitProfile() }, [isAuthenticated, user?.id])

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500/70" />
                    <p className="text-gray-400 dark:text-gray-500 text-sm font-light tracking-widest uppercase">Loading Profile</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
                <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 rounded-2xl text-center space-y-6 shadow-sm">
                    <div className="h-20 w-20 bg-purple-100 dark:bg-purple-500/10 rounded-full mx-auto flex items-center justify-center">
                        <User className="h-10 w-10 text-purple-500" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">未登录</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">请先登录以管理您的数字身份</p>
                    </div>
                    <Link href="/auth?mode=login">
                        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl">前往登录</Button>
                    </Link>
                </div>
            </div>
        )
    }

    const initials = user.username?.slice(0, 2).toUpperCase() || 'U'
    const isAdmin = user.role === 'admin'

    const tabItems = [
        { id: 'profile' as const, label: '个人信息', icon: User },
        { id: 'habits' as const, label: '工作习惯', icon: Brain },
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
            <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10 animate-mac-fade-in">
                {/* macOS-style nav bar */}
                <div className="flex items-center justify-between mb-6">
                    <Link href="/dashboard">
                        <Button variant="ghost" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800 gap-2 pl-2 rounded-lg">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="text-sm">Back to Dashboard</span>
                        </Button>
                    </Link>
                </div>

                {/* macOS Preferences-like layout: left sidebar + right content */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                    {/* Left sidebar - macOS System Preferences style */}
                    <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                        {/* Profile card in sidebar */}
                        <div className="p-6 flex flex-col items-center text-center border-b border-gray-200 dark:border-gray-800">
                            <div className="relative mb-4">
                                <div className="h-20 w-20 rounded-full ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900 overflow-hidden bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{initials}</span>
                                    <img
                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                        alt={user.username}
                                        className="absolute inset-0 w-full h-full object-cover opacity-90"
                                    />
                                </div>
                                <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
                                    <Sparkles className="h-2.5 w-2.5 text-white" />
                                </div>
                            </div>
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{user.displayName || user.username}</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">@{user.username}</p>
                            <Badge variant="outline" className={`mt-2 border-0 text-[10px] font-medium px-2 py-0.5 ${isAdmin ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'}`}>
                                {isAdmin ? 'ADMIN' : 'MEMBER'}
                            </Badge>
                        </div>

                        {/* Sidebar tabs - macOS Preferences style */}
                        <nav className="p-3 space-y-1">
                            {tabItems.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    <tab.icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>

                        {/* Quick links */}
                        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
                            <Link href="/model-config?from=/profile">
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                                    <Bot className="h-4 w-4" />
                                    <span>模型配置</span>
                                </div>
                            </Link>
                            {isAdmin && (
                                <Link href="/admin">
                                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                                        <LayoutDashboard className="h-4 w-4" />
                                        <span>管理后台</span>
                                    </div>
                                </Link>
                            )}
                            <div className="pt-2">
                                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                    <LogOut className="h-4 w-4" />
                                    <span>退出登录</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right content area - macOS Preferences style */}
                    <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                        {activeTab === 'profile' && (
                            <div className="space-y-6 animate-mac-slide-in">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">个人信息</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">设置您的展示名称、联系方式等基本信息</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">显示名称</label>
                                        <input
                                            value={profileForm.displayName}
                                            onChange={(e) => setProfileForm(prev => ({ ...prev, displayName: e.target.value }))}
                                            placeholder="显示名称"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">手机号码</label>
                                        <input
                                            value={profileForm.phone}
                                            onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                                            placeholder="手机号码"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">所在位置</label>
                                        <input
                                            value={profileForm.location}
                                            onChange={(e) => setProfileForm(prev => ({ ...prev, location: e.target.value }))}
                                            placeholder="所在位置"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">个人网站</label>
                                        <input
                                            value={profileForm.website}
                                            onChange={(e) => setProfileForm(prev => ({...prev, website: e.target.value }))}
                                            placeholder="个人网站"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">部门</label>
                                        <input
                                            value={profileForm.department}
                                            onChange={(e) => setProfileForm(prev => ({ ...prev, department: e.target.value }))}
                                            placeholder="部门"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">职位</label>
                                        <input
                                            value={profileForm.jobTitle}
                                            onChange={(e) => setProfileForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                                            placeholder="职位"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">个人简介</label>
                                    <textarea
                                        value={profileForm.bio}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                                        placeholder="个人简介"
                                        className="w-full h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                    />
                                </div>

                                {/* Email (readonly) */}
                                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">邮箱地址</p>
                                            <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{user.email}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'habits' && (
                            <div className="space-y-6 animate-mac-slide-in">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">工作与学习习惯</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">模型会在任务安排和拆解时参考这些偏好</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">工作角色</label>
                                        <input
                                            value={habitForm.occupation}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, occupation: e.target.value }))}
                                            placeholder="如：后端工程师"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">当前学习重点</label>
                                        <input
                                            value={habitForm.currentStudyFocus}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, currentStudyFocus: e.target.value }))}
                                            placeholder="如：算法/英语"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">偏好专注时长（分钟）</label>
                                        <input
                                            type="number" min={15} max={180}
                                            value={habitForm.preferredFocusMinutes}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, preferredFocusMinutes: Number(e.target.value || 45) }))}
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">偏好休息时长（分钟）</label>
                                        <input
                                            type="number" min={5} max={60}
                                            value={habitForm.preferredBreakMinutes}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, preferredBreakMinutes: Number(e.target.value || 10) }))}
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">每日深度任务上限</label>
                                        <input
                                            type="number" min={1} max={12}
                                            value={habitForm.maxFocusSessionsPerDay}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, maxFocusSessionsPerDay: Number(e.target.value || 4) }))}
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">计划偏好</label>
                                        <input
                                            value={habitForm.planningPreference}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, planningPreference: e.target.value }))}
                                            placeholder="如：先难后易"
                                            className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">高效时段</label>
                                        <textarea
                                            value={habitForm.highEfficiencyPeriods}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, highEfficiencyPeriods: e.target.value }))}
                                            placeholder="每行一条，如 09:00-11:30"
                                            className="w-full h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">低效时段</label>
                                        <textarea
                                            value={habitForm.lowEfficiencyPeriods}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, lowEfficiencyPeriods: e.target.value }))}
                                            placeholder="每行一条"
                                            className="w-full h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">不可用时段</label>
                                        <textarea
                                            value={habitForm.weeklyUnavailableSlots}
                                            onChange={(e) => setHabitForm(prev => ({ ...prev, weeklyUnavailableSlots: e.target.value }))}
                                            placeholder="如 周三 14:00-17:00"
                                            className="w-full h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">补充说明</label>
                                    <textarea
                                        value={habitForm.notes}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="如：午休后30分钟不排高强度任务"
                                        className="w-full h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-xs text-gray-400">{habitSaveMessage || '保存后自动应用到聊天任务规划'}</span>
                                    <Button
                                        onClick={handleSaveHabits}
                                        disabled={isHabitSaving || isHabitLoading}
                                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm"
                                    >
                                        {isHabitSaving ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</>
                                        ) : (
                                            <><Save className="mr-2 h-4 w-4" />保存习惯</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
