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
}

function StatCard({ title, value, icon: Icon, trend, trendValue, description }: StatCardProps) {
    return (
        <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl transition-all hover:bg-white/20 hover:border-white/30">
            <div className="flex flex-row items-center justify-between pb-2">
                <p className="text-sm font-medium text-white/70">{title}</p>
                <Icon className="h-4 w-4 text-white/50" />
            </div>
            <div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="flex items-center text-xs mt-1">
                    {trend === 'up' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-400 mr-1" />
                    ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-300 mr-1" />
                    )}
                    <span className={trend === 'up' ? 'text-green-400' : 'text-red-300'}>{trendValue}</span>
                    <span className="text-white/60 ml-1">{description}</span>
                </div>
            </div>
        </div>
    )
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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
        return <div className="p-8 text-center text-white/70">加载中...</div>
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-white">概览仪表盘</h2>
                <p className="text-white/70 mt-2">欢迎回来，这里是系统的实时运行状态与趋势分析。</p>
                {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="总用户数"
                    value={stats?.total_users || 0}
                    icon={Users}
                    trend="up"
                    trendValue="+12.5%"
                    description="较上月"
                />
                <StatCard
                    title="活跃用户"
                    value={stats?.active_users || 0}
                    icon={Activity}
                    trend="up"
                    trendValue="+4.3%"
                    description="较上周"
                />
                <StatCard
                    title="总对话数"
                    value={stats?.total_conversations?.toLocaleString() || 0}
                    icon={MessageSquare}
                    trend="up"
                    trendValue="+28.4%"
                    description="较昨日"
                />
                <StatCard
                    title="Token 消耗"
                    value={stats?.total_tokens ? `${(stats.total_tokens / 1_000_000).toFixed(1)}M` : '0'}
                    icon={Zap}
                    trend="down"
                    trendValue="-2.1%"
                    description="较上周"
                />
            </div>

            <AdminCharts stats={stats} />

            <div className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl p-4 lg:p-6">
                <h3 className="text-white text-lg font-semibold">系统状态概览</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="flex flex-col space-y-2 p-4 bg-white/10 border border-white/15 rounded-lg">
                        <span className="text-sm font-medium text-white/70">后端版本</span>
                        <span className="text-lg font-bold text-white">{stats?.version || 'Unknown'}</span>
                    </div>
                    <div className="flex flex-col space-y-2 p-4 bg-white/10 border border-white/15 rounded-lg">
                        <span className="text-sm font-medium text-white/70">数据库连接</span>
                        <span className="flex items-center text-lg text-green-400 font-semibold">
                            <div className="w-2 h-2 rounded-full bg-green-400 mr-2" />
                            正常
                        </span>
                    </div>
                    <div className="flex flex-col space-y-2 p-4 bg-white/10 border border-white/15 rounded-lg">
                        <span className="text-sm font-medium text-white/70">LLM 服务</span>
                        <span className="flex items-center text-lg text-green-400 font-semibold">
                            <div className="w-2 h-2 rounded-full bg-green-400 mr-2" />
                            运行中
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
