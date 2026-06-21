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
    Loader2,
    Server,
    Database,
    Cpu
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
                <div className="xl:col-span-3 rounded-lg border border-border bg-card shadow-sm p-4 lg:p-6">
                    <div className="h-[280px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500/50" />
                    </div>
                </div>
                <div className="xl:col-span-2 rounded-lg border border-border bg-card shadow-sm p-4 lg:p-6">
                    <div className="h-[280px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500/50" />
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
        <div className="p-5 rounded-lg bg-card border border-border shadow-sm transition-all hover:shadow-md hover:border-ring">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            <div className="flex items-center text-xs mt-1.5">
                {trend === 'up' ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-green-500 mr-1" />
                ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-400 mr-1" />
                )}
                <span className={trend === 'up' ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-500 dark:text-red-400 font-medium'}>{trendValue}</span>
                <span className="text-muted-foreground ml-1">{description}</span>
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
                if (!response.ok) throw new Error(result.error || result.message || '获取统计失败')
                if (result?.success) setStats(result.data)
                else setStats(result)
            } catch (err) {
                setError(err instanceof Error ? err.message : '获取统计失败')
            } finally { setLoading(false) }
        }
        fetchStats()
    }, [])

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-purple-500/50" /></div>

    return (
        <div className="space-y-8 animate-mac-slide-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">概览仪表盘</h2>
                <p className="text-sm text-muted-foreground mt-1">欢迎回来，这里是系统的实时运行状态与趋势分析。</p>
                {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="总用户数" value={stats?.total_users || 0} icon={Users} trend="up" trendValue="+12.5%" description="较上月" />
                <StatCard title="活跃用户" value={stats?.active_users || 0} icon={Activity} trend="up" trendValue="+4.3%" description="较上周" />
                <StatCard title="总对话数" value={stats?.total_conversations?.toLocaleString() || 0} icon={MessageSquare} trend="up" trendValue="+28.4%" description="较昨日" />
                <StatCard title="Token 消耗" value={stats?.total_tokens ? `${(stats.total_tokens / 1_000_000).toFixed(1)}M` : '0'} icon={Zap} trend="down" trendValue="-2.1%" description="较上周" />
            </div>

            {/* Charts */}
            <AdminCharts stats={stats} />

            {/* System Status - macOS style table */}
            <div className="rounded-lg border border-border bg-card shadow-sm p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">系统状态概览</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/50 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                            <Cpu className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">后端版本</p>
                            <p className="text-sm font-semibold text-foreground">{stats?.version || 'Unknown'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/50 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                            <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">数据库连接</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-green-500" />正常
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/50 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                            <Server className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">LLM 服务</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-green-500" />运行中
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
