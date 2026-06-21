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
    Loader2
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { cn } from '@/lib/utils'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

export default function ProfilePage() {
    const { isDesktop } = useDesktopRuntime()
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

    const [feishuOpenIdInput, setFeishuOpenIdInput] = useState('')
    const [isFeishuBinding, setIsFeishuBinding] = useState(false)
    const [feishuMessage, setFeishuMessage] = useState<string | null>(null)

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

    const handleBindFeishu = async () => {
        if (!feishuOpenIdInput.trim()) return
        setIsFeishuBinding(true)
        setFeishuMessage(null)
        try {
            const response = await fetch(API_ENDPOINTS.AUTH.FEISHU_BIND, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feishuOpenId: feishuOpenIdInput.trim() })
            })
            const result = await response.json()
            if (!result.success) {
                throw new Error(result.message || '绑定失败')
            }
            if (result.data?.user) {
                updateUser({
                    feishuBinding: result.data.user.feishuBinding,
                    feishuOpenId: result.data.user.feishuOpenId
                })
            }
            setFeishuMessage('飞书绑定成功！')
            setFeishuOpenIdInput('')
        } catch (error) {
            console.error('绑定飞书失败:', error)
            setFeishuMessage(error instanceof Error ? error.message : '绑定失败，请稍后重试。')
        } finally {
            setIsFeishuBinding(false)
        }
    }

    const handleUnbindFeishu = async () => {
        setIsFeishuBinding(true)
        setFeishuMessage(null)
        try {
            const response = await fetch(API_ENDPOINTS.AUTH.FEISHU_BIND, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feishuOpenId: null })
            })
            const result = await response.json()
            if (!result.success) {
                throw new Error(result.message || '解绑失败')
            }
            if (result.data?.user) {
                updateUser({
                    feishuBinding: false,
                    feishuOpenId: undefined
                })
            }
            setFeishuMessage('已成功解除绑定。')
        } catch (error) {
            console.error('解绑飞书失败:', error)
            setFeishuMessage(error instanceof Error ? error.message : '解绑失败，请稍后重试。')
        } finally {
            setIsFeishuBinding(false)
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
            </JustimePageShell>
        )
    }

    // Initials
    const initials = user.username?.slice(0, 2).toUpperCase() || 'U'
    const isAdmin = user.role === 'admin'

    if (isDesktop) {
        return (
            <JustimePageShell variant="desktop" blur="none" opacity={0} contentClassName="min-h-screen py-8 px-6 flex items-center justify-center">
                <div className="w-full max-w-2xl animate-in fade-in duration-700">
                    {/* Navigation Header */}
                    <div className="flex items-center justify-between mb-6 px-2">
                        <Link href="/dashboard">
                            <Button variant="ghost" className="text-[#6d6680] hover:text-[#171421] hover:bg-violet-50 transition-colors gap-2 pl-2">
                                <ChevronRight className="h-4 w-4 rotate-180" />
                                <span className="tracking-wide">Back to Dashboard</span>
                            </Button>
                        </Link>
                    </div>

                    <div className="bg-white/[0.68] border border-violet-200/[0.45] shadow-[0_24px_80px_rgba(112,77,171,0.12)] rounded-3xl overflow-hidden backdrop-blur-2xl text-[#171421]">
                        {/* Hero Section */}
                        <div className="relative pt-12 pb-8 px-8 flex flex-col items-center text-center">
                            {/* Ambient Glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-violet-500/10 blur-[60px] rounded-full pointer-events-none" />

                            {/* Avatar Ring */}
                            <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-full opacity-75 group-hover:opacity-100 blur transition duration-500 animate-tilt"></div>
                                <div className="relative h-28 w-28 rounded-full p-1 bg-white/40 backdrop-blur-md ring-1 ring-violet-200/30">
                                    <div className="h-full w-full rounded-full overflow-hidden bg-violet-100 flex items-center justify-center relative">
                                        <span className="text-3xl font-bold text-violet-700 tracking-widest">{initials}</span>
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                            alt={user.username}
                                            className="absolute inset-0 w-full h-full object-cover opacity-90 hover:scale-110 transition-transform duration-500"
                                        />
                                    </div>
                                </div>
                                <div className="absolute bottom-1 right-1 h-6 w-6 bg-emerald-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center" title="Active">
                                    <Sparkles className="h-3 w-3 text-emerald-100" />
                                </div>
                            </div>

                            {/* Name & Role */}
                            <div className="mt-5 space-y-1">
                                <h1 className="text-3xl font-bold text-[#171421] tracking-tight">
                                    {user.displayName || user.username}
                                </h1>
                                <div className="flex items-center justify-center gap-2 text-[#6d6680] text-sm">
                                    <span className="font-mono tracking-wider">@{user.username}</span>
                                    <span className="w-1 h-1 rounded-full bg-violet-300" />
                                    <Badge variant="outline" className={`border-0 bg-violet-100/80 px-2 py-0.5 text-xs font-semibold tracking-wide ${isAdmin ? 'text-violet-700 ring-1 ring-violet-300/50' : 'text-blue-700 ring-1 ring-blue-300/50'}`}>
                                        {isAdmin ? 'ADMINISTRATOR' : 'MEMBER'}
                                    </Badge>
                                </div>
                            </div>

                            {/* Stats / Metadata Grid */}
                            <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-sm">
                                <div className="bg-white/60 border border-violet-200/40 rounded-2xl p-3 flex flex-col items-center transition-colors hover:bg-violet-50/50">
                                    <span className="text-[#8b7aa8] text-xs uppercase tracking-widest mb-1">Joined</span>
                                    <div className="flex items-center gap-1.5 text-[#171421]">
                                        <Clock className="h-3.5 w-3.5 text-violet-500" />
                                        <span className="font-semibold text-sm">{new Date().toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="bg-white/60 border border-violet-200/40 rounded-2xl p-3 flex flex-col items-center transition-colors hover:bg-violet-50/50">
                                    <span className="text-[#8b7aa8] text-xs uppercase tracking-widest mb-1">Status</span>
                                    <div className="flex items-center gap-1.5 text-[#171421]">
                                        <Shield className="h-3.5 w-3.5 text-emerald-500" />
                                        <span className="font-semibold text-sm">Protected</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="px-6 pb-8 space-y-4">

                            {/* Account Details */}
                            <div className="bg-white/40 border border-violet-200/30 rounded-2xl p-1">
                                <div className="flex items-center justify-between p-4 rounded-xl hover:bg-violet-50/30 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 group-hover:text-violet-700 group-hover:bg-violet-200 transition-all">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs text-[#8b7aa8] uppercase tracking-wider">Email Address</p>
                                            <p className="text-[#171421] font-semibold">{user.email}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feishu Account Binding */}
                            <div className="bg-white/60 rounded-2xl p-6 border border-violet-200/40 space-y-4">
                                <div>
                                    <h3 className="text-[#171421] font-bold flex items-center gap-2">
                                        <Shield className="h-5 w-5 text-violet-600" />
                                        飞书账号绑定
                                    </h3>
                                    <p className="text-[#8b7aa8] text-xs mt-1">绑定飞书账号以通过飞书机器人使用 AI 助理与同步日历日程</p>
                                </div>

                                {user.feishuBinding ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                                            <div className="flex flex-col">
                                                <span className="text-emerald-800 font-semibold text-sm">已绑定飞书账号</span>
                                                <span className="text-[10px] text-emerald-600 font-mono mt-0.5">OpenID: {user.feishuOpenId || '已关联'}</span>
                                            </div>
                                            <Badge variant="outline" className="bg-emerald-100 border-emerald-300 text-emerald-700 font-medium">
                                                已激活
                                            </Badge>
                                        </div>
                                        <Button
                                            onClick={handleUnbindFeishu}
                                            disabled={isFeishuBinding}
                                            className="h-10 px-5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl w-full font-medium"
                                        >
                                            {isFeishuBinding ? '解绑中...' : '解除绑定'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="text-xs text-[#6d6680] space-y-2 bg-violet-50/50 p-4 rounded-xl border border-violet-100 leading-relaxed">
                                            <p className="font-semibold text-[#171421]">👉 快速绑定流程：</p>
                                            <ol className="list-decimal pl-4 space-y-1">
                                                <li>在飞书客户端搜索并添加机器人客户 <b>“矩时日程助手”</b> (由系统管理员创建)；</li>
                                                <li>给机器人发送任意文字（如 <code>绑定</code>），机器人将回复您的 <b>OpenID</b>；</li>
                                                <li>将该 OpenID 复制并粘贴到下方输入框，点击绑定即可。</li>
                                            </ol>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                value={feishuOpenIdInput}
                                                onChange={(e) => setFeishuOpenIdInput(e.target.value)}
                                                placeholder="请输入飞书 OpenID (如 ou_xxx)"
                                                className="flex-1 h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                                disabled={isFeishuBinding}
                                            />
                                            <Button
                                                onClick={handleBindFeishu}
                                                disabled={isFeishuBinding || !feishuOpenIdInput.trim()}
                                                className="h-10 px-5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium border-0"
                                            >
                                                {isFeishuBinding ? '绑定中...' : '绑定'}
                                            </Button>
                                        </div>
                                        {feishuMessage && (
                                            <p className={`text-xs ${feishuMessage.includes('成功') ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {feishuMessage}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Profile Info */}
                            <div className="bg-white/60 rounded-2xl p-4 border border-violet-200/40 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-[#171421] font-bold">个人信息</h3>
                                        <p className="text-[#8b7aa8] text-xs">设置您的展示名称、联系方式等基本信息</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input
                                        value={profileForm.displayName}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, displayName: e.target.value }))}
                                        placeholder="显示名称"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        value={profileForm.phone}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="手机号码"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        value={profileForm.location}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, location: e.target.value }))}
                                        placeholder="所在位置"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        value={profileForm.website}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, website: e.target.value }))}
                                        placeholder="个人网站"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        value={profileForm.department}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, department: e.target.value }))}
                                        placeholder="部门"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        value={profileForm.jobTitle}
                                        onChange={(e) => setProfileForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                                        placeholder="职位"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                </div>

                                <textarea
                                    value={profileForm.bio}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                                    placeholder="个人简介"
                                    className="w-full h-20 rounded-xl bg-white border border-violet-200 px-3 py-2 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 resize-none focus:outline-none focus:border-violet-400"
                                />
                            </div>

                            {/* Work/Study Habits */}
                            <div className="bg-white/60 rounded-2xl p-4 border border-violet-200/40 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-[#171421] font-bold">工作与学习习惯</h3>
                                        <p className="text-[#8b7aa8] text-xs">模型会在任务安排和拆解时参考这些偏好</p>
                                    </div>
                                    {isHabitLoading && (
                                        <span className="text-[#8b7aa8] text-xs">加载中...</span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input
                                        value={habitForm.occupation}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, occupation: e.target.value }))}
                                        placeholder="你的工作角色（如：后端工程师）"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        value={habitForm.currentStudyFocus}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, currentStudyFocus: e.target.value }))}
                                        placeholder="当前学习重点（如：算法/英语）"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        type="number"
                                        min={15}
                                        max={180}
                                        value={habitForm.preferredFocusMinutes}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, preferredFocusMinutes: Number(e.target.value || 45) }))}
                                        placeholder="偏好专注时长（分钟）"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        type="number"
                                        min={5}
                                        max={60}
                                        value={habitForm.preferredBreakMinutes}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, preferredBreakMinutes: Number(e.target.value || 10) }))}
                                        placeholder="偏好休息时长（分钟）"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        type="number"
                                        min={1}
                                        max={12}
                                        value={habitForm.maxFocusSessionsPerDay}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, maxFocusSessionsPerDay: Number(e.target.value || 4) }))}
                                        placeholder="每日深度任务上限"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                    <input
                                        value={habitForm.planningPreference}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, planningPreference: e.target.value }))}
                                        placeholder="计划偏好（如：先难后易）"
                                        className="h-10 rounded-xl bg-white border border-violet-200 px-3 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 focus:outline-none focus:border-violet-400"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <textarea
                                        value={habitForm.highEfficiencyPeriods}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, highEfficiencyPeriods: e.target.value }))}
                                        placeholder="高效时段（每行一条，如 09:00-11:30）"
                                        className="h-24 rounded-xl bg-white border border-violet-200 px-3 py-2 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 resize-none focus:outline-none focus:border-violet-400"
                                    />
                                    <textarea
                                        value={habitForm.lowEfficiencyPeriods}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, lowEfficiencyPeriods: e.target.value }))}
                                        placeholder="低效时段（每行一条）"
                                        className="h-24 rounded-xl bg-white border border-violet-200 px-3 py-2 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 resize-none focus:outline-none focus:border-violet-400"
                                    />
                                    <textarea
                                        value={habitForm.weeklyUnavailableSlots}
                                        onChange={(e) => setHabitForm(prev => ({ ...prev, weeklyUnavailableSlots: e.target.value }))}
                                        placeholder="不可用时段（如 周三 14:00-17:00）"
                                        className="h-24 rounded-xl bg-white border border-violet-200 px-3 py-2 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 resize-none focus:outline-none focus:border-violet-400"
                                    />
                                </div>

                                <textarea
                                    value={habitForm.notes}
                                    onChange={(e) => setHabitForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="补充说明（如：午休后30分钟不排高强度任务）"
                                    className="w-full h-20 rounded-xl bg-white border border-violet-200 px-3 py-2 text-sm text-[#171421] placeholder:text-[#8b7aa8]/60 resize-none focus:outline-none focus:border-violet-400"
                                />

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-[#8b7aa8]">{habitSaveMessage || '保存后自动应用到聊天任务规划'}</span>
                                    <Button
                                        onClick={handleSaveHabits}
                                        disabled={isHabitSaving || isHabitLoading}
                                        className="h-10 px-5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium border-0"
                                    >
                                        {isHabitSaving ? '保存中...' : '保存习惯'}
                                    </Button>
                                </div>
                            </div>

                            {/* Navigation Menu */}
                            <div className="grid gap-3">
                                <Link href="/model-config?from=/profile">
                                    <div className="group flex items-center justify-between p-4 bg-white/60 border border-violet-200/40 rounded-2xl hover:bg-violet-50/50 hover:border-violet-300/60 transition-all cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 shadow-inner border border-violet-200/50">
                                                <Bot className="h-6 w-6" />
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-[#171421] font-bold">LLM Configuration</h3>
                                                <p className="text-[#6d6680] text-sm">Model API keys & Agent settings</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-violet-400 group-hover:text-violet-600 transition-colors" />
                                    </div>
                                </Link>

                                {isAdmin && (
                                    <Link href="/admin">
                                        <div className="group flex items-center justify-between p-4 bg-white/60 border border-violet-200/40 rounded-2xl hover:bg-violet-50/50 hover:border-violet-300/60 transition-all cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-inner border border-purple-200/50">
                                                    <LayoutDashboard className="h-6 w-6" />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="text-[#171421] font-bold">Admin Panel</h3>
                                                    <p className="text-[#6d6680] text-sm">System stats & User management</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-violet-400 group-hover:text-violet-600 transition-colors" />
                                        </div>
                                    </Link>
                                )}
                            </div>

                            {/* Logout */}
                            <div className="pt-4">
                                <Button
                                    variant="destructive"
                                    className="w-full h-12 bg-rose-600 hover:bg-rose-500 text-white font-medium border-0 shadow-sm rounded-xl transition-all"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    <span>Sign Out</span>
                                </Button>
                            </div>

                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <p className="text-[#8b7aa8] text-xs tracking-widest uppercase">Justime Agent System v1.0</p>
                    </div>
                </div>
            </JustimePageShell>
        )
    }

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

                        {/* Feishu Account Binding */}
                        <div className="bg-black/20 rounded-2xl p-6 border border-white/10 space-y-4">
                            <div>
                                <h3 className="text-white font-semibold flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-indigo-300" />
                                    飞书账号绑定
                                </h3>
                                <p className="text-white/40 text-xs mt-1">绑定飞书账号以通过飞书机器人使用 AI 助理与同步日历日程</p>
                            </div>

                            {user.feishuBinding ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                        <div className="flex flex-col">
                                            <span className="text-emerald-300 font-medium text-sm">已绑定飞书账号</span>
                                            <span className="text-[10px] text-white/50 font-mono mt-0.5">OpenID: {user.feishuOpenId || '已关联'}</span>
                                        </div>
                                        <Badge variant="outline" className="bg-emerald-500/20 border-emerald-400/30 text-emerald-100">
                                            已激活
                                        </Badge>
                                    </div>
                                    <Button
                                        onClick={handleUnbindFeishu}
                                        disabled={isFeishuBinding}
                                        variant="destructive"
                                        className="h-10 px-5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border border-rose-500/30 rounded-xl w-full"
                                    >
                                        {isFeishuBinding ? '解绑中...' : '解除绑定'}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-xs text-white/60 space-y-2 bg-white/5 p-4 rounded-xl border border-white/5 leading-relaxed">
                                        <p className="font-semibold text-white/90">👉 快速绑定流程：</p>
                                        <ol className="list-decimal pl-4 space-y-1">
                                            <li>在飞书客户端搜索并添加机器人客户 <b>“矩时日程助手”</b> (由系统管理员创建)；</li>
                                            <li>给机器人发送任意文字（如 <code>绑定</code>），机器人将回复您的 <b>OpenID</b>；</li>
                                            <li>将该 OpenID 复制并粘贴到下方输入框，点击绑定即可。</li>
                                        </ol>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={feishuOpenIdInput}
                                            onChange={(e) => setFeishuOpenIdInput(e.target.value)}
                                            placeholder="请输入飞书 OpenID (如 ou_xxx)"
                                            className="flex-1 h-10 rounded-xl bg-white/5 border border-white/[0.15] px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/40"
                                            disabled={isFeishuBinding}
                                        />
                                        <Button
                                            onClick={handleBindFeishu}
                                            disabled={isFeishuBinding || !feishuOpenIdInput.trim()}
                                            className="h-10 px-5 bg-indigo-500/30 hover:bg-indigo-500/40 text-indigo-100 border border-indigo-400/30 rounded-xl"
                                        >
                                            {isFeishuBinding ? '绑定中...' : '绑定'}
                                        </Button>
                                    </div>
                                    {feishuMessage && (
                                        <p className={`text-xs ${feishuMessage.includes('成功') ? 'text-emerald-300' : 'text-rose-300'}`}>
                                            {feishuMessage}
                                        </p>
                                    )}
                                </div>
                            )}
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