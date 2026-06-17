'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    MessageSquare,
    Users,
    Zap,
    Loader2
} from 'lucide-react'
import { API_ENDPOINTS } from '@/lib/api/endpoints'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { cn } from '@/lib/utils'

interface Stats {
    total_users: number
    active_users: number
    total_tokens: number
    total_conversations: number
    version: string
}

const AdminCharts = dynamic(
    () => import('@/components/admin/AdminCharts').then((mod) => mod.AdminCharts),
    {
        ssr: false,
        loading: () => (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-3 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl p-4 lg:p-6">
                    <div className="h-[280px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                    </div>
                </div>
                <div className="xl:col-span-2 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl p-4 lg:p-6">
                    <div className="h-[280px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                    </div>
                </div>
            </div>
        )
    }
)

interface StatCardProps {
    title: string
    value: string | number
    trend: 'up' | 'down'
    trendValue: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    isDesktop?: boolean
}

function StatCard({ title, value, icon: Icon, trend, trendValue, description, isDesktop }: StatCardProps) {
    return (
        <div className={cn(
            "p-6 rounded-2xl border transition-all",
            isDesktop
                ? "bg-white/[0.68] border-violet-200/[0.45] shadow-[0_12px_40px_rgba(112,77,171,0.06)] hover:bg-white/80 hover:border-violet-300/60"
                : "bg-white/10 backdrop-blur-md border border-white/20 shadow-xl hover:bg-white/20 hover:border-white/30"
        )}>
            <div className="flex flex-row items-center justify-between pb-2">
                <p className={cn("text-sm font-medium", isDesktop ? "text-[#6d6680]" : "text-white/70")}>{title}</p>
                <Icon className={cn("h-4 w-4", isDesktop ? "text-violet-500" : "text-white/50")} />
            </div>
            <div>
                <div className={cn("text-2xl font-bold", isDesktop ? "text-[#171421]" : "text-white")}>{value}</div>
                <div className="flex items-center text-xs mt-1">
                    {trend === 'up' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-400 mr-1" />
                    ) : (
                        <ArrowDownRight className={cn("h-4 w-4 mr-1", isDesktop ? "text-red-500" : "text-red-300")} />
                    )}
                    <span className={cn(trend === 'up' ? 'text-green-500 font-semibold' : (isDesktop ? 'text-red-500 font-semibold' : 'text-red-300'))}>{trendValue}</span>
                    <span className={cn("ml-1", isDesktop ? "text-[#8b7aa8]" : "text-white/60")}>{description}</span>
                </div>
            </div>
        </div>
    )
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { isDesktop } = useDesktopRuntime()

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch(API_ENDPOINTS.ADMIN.STATS)
                const result = await response.json()
                if (!response.ok) {
                    throw new Error(result.error || result.message || '获取统计失败')
                }

                if (result?.success) {
                    setStats(result.data)
                } else {
                    setStats(result)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : '获取统计失败')
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className={cn("p-8 text-center", isDesktop ? "text-[#8b7aa8]" : "text-white/70")}>
                {isDesktop ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                        <p className="text-sm font-medium tracking-wide">加载中...</p>
                    </div>
                ) : (
                    "加载中..."
                )}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className={cn("text-3xl font-bold tracking-tight", isDesktop ? "text-[#171421]" : "text-white")}>概览仪表盘</h2>
                <p className={cn("mt-2", isDesktop ? "text-[#6d6680]" : "text-white/70")}>欢迎回来，这里是系统的实时运行状态与趋势分析。</p>
                {error && <p className={cn("text-sm mt-2", isDesktop ? "text-red-500 font-semibold" : "text-red-300")}>{error}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="总用户数"
                    value={stats?.total_users || 0}
                    icon={Users}
                    trend="up"
                    trendValue="+12.5%"
                    description="较上月"
                    isDesktop={isDesktop}
                />
                <StatCard
                    title="活跃用户"
                    value={stats?.active_users || 0}
                    icon={Activity}
                    trend="up"
                    trendValue="+4.3%"
                    description="较上周"
                    isDesktop={isDesktop}
                />
                <StatCard
                    title="总对话数"
                    value={stats?.total_conversations?.toLocaleString() || 0}
                    icon={MessageSquare}
                    trend="up"
                    trendValue="+28.4%"
                    description="较昨日"
                    isDesktop={isDesktop}
                />
                <StatCard
                    title="Token 消耗"
                    value={stats?.total_tokens ? `${(stats.total_tokens / 1_000_000).toFixed(1)}M` : '0'}
                    icon={Zap}
                    trend="down"
                    trendValue="-2.1%"
                    description="较上周"
                    isDesktop={isDesktop}
                />
            </div>

            <AdminCharts stats={stats} isDesktop={isDesktop} />

            <div className={cn(
                "rounded-2xl border p-4 lg:p-6",
                isDesktop
                    ? "bg-white/[0.68] border-violet-200/[0.45] shadow-[0_12px_40px_rgba(112,77,171,0.06)]"
                    : "border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl"
            )}>
                <h3 className={cn("text-lg font-semibold", isDesktop ? "text-[#171421]" : "text-white")}>系统状态概览</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className={cn(
                        "flex flex-col space-y-2 p-4 border rounded-lg",
                        isDesktop ? "bg-violet-50/40 border-violet-100/50" : "bg-white/10 border-white/[0.15]"
                    )}>
                        <span className={cn("text-sm font-medium", isDesktop ? "text-[#6d6680]" : "text-white/70")}>后端版本</span>
                        <span className={cn("text-lg font-bold", isDesktop ? "text-[#171421]" : "text-white")}>{stats?.version || 'Unknown'}</span>
                    </div>
                    <div className={cn(
                        "flex flex-col space-y-2 p-4 border rounded-lg",
                        isDesktop ? "bg-violet-50/40 border-violet-100/50" : "bg-white/10 border-white/[0.15]"
                    )}>
                        <span className={cn("text-sm font-medium", isDesktop ? "text-[#6d6680]" : "text-white/70")}>数据库连接</span>
                        <span className={cn("flex items-center text-lg font-semibold", isDesktop ? "text-emerald-600" : "text-green-400")}>
                            <div className={cn("w-2 h-2 rounded-full mr-2", isDesktop ? "bg-emerald-500" : "bg-green-400")} />
                            正常
                        </span>
                    </div>
                    <div className={cn(
                        "flex flex-col space-y-2 p-4 border rounded-lg",
                        isDesktop ? "bg-violet-50/40 border-violet-100/50" : "bg-white/10 border-white/[0.15]"
                    )}>
                        <span className={cn("text-sm font-medium", isDesktop ? "text-[#6d6680]" : "text-white/70")}>LLM 服务</span>
                        <span className={cn("flex items-center text-lg font-semibold", isDesktop ? "text-emerald-600" : "text-green-400")}>
                            <div className={cn("w-2 h-2 rounded-full mr-2", isDesktop ? "bg-emerald-500" : "bg-green-400")} />
                            运行中
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
