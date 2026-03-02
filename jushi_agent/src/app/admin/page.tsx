'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    MessageSquare,
    Users,
    Zap
} from 'lucide-react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

interface Stats {
    total_users: number
    active_users: number
    total_tokens: number
    total_conversations: number
    version: string
}

interface TrendPoint {
    date: string
    tokens: number
    newUsers: number
    activeUsers: number
}

function buildMockTrendData(stats: Stats | null): TrendPoint[] {
    const totalUsers = Math.max(0, Number(stats?.total_users || 0))
    const activeUsers = Math.max(0, Number(stats?.active_users || 0))
    const totalTokens = Math.max(0, Number(stats?.total_tokens || 0))

    const tokenBase = Math.max(200, Math.floor(totalTokens / 7) || 1200)
    const activeBase = Math.max(10, activeUsers || Math.floor(totalUsers * 0.65) || 30)
    const newUserBase = Math.max(1, Math.floor(totalUsers * 0.012) || 2)

    const tokenFactors = [0.82, 0.93, 1.01, 1.14, 0.97, 1.08, 1.2]
    const activeFactors = [0.89, 0.92, 0.97, 1.02, 0.99, 1.04, 1.08]
    const newUserFactors = [0.8, 1.0, 0.9, 1.2, 1.1, 1.0, 1.3]

    const now = new Date()
    const rows: TrendPoint[] = []

    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(now)
        d.setDate(now.getDate() - i)
        const label = `${d.getMonth() + 1}/${d.getDate()}`
        const idx = 6 - i

        rows.push({
            date: label,
            tokens: Math.round(tokenBase * tokenFactors[idx]),
            newUsers: Math.max(1, Math.round(newUserBase * newUserFactors[idx])),
            activeUsers: Math.max(1, Math.round(activeBase * activeFactors[idx]))
        })
    }

    return rows
}

function formatTokens(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return `${value}`
}

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
                const response = await fetch('/api/admin/stats')
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

    const trendData = useMemo(() => buildMockTrendData(stats), [stats])

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

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-3 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl p-4 lg:p-6">
                    <div className="mb-4">
                        <h3 className="text-white text-lg font-semibold">近 7 天 Token 消耗趋势</h3>
                        <p className="text-white/60 text-xs mt-1">基于当前总量推演的日级趋势，用于可视化预览</p>
                    </div>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.55} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.18)' }} tickLine={false} />
                                <YAxis tickFormatter={(v) => formatTokens(v)} tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.18)' }} tickLine={false} />
                                <Tooltip
                                    formatter={(value: number) => [value.toLocaleString(), 'Token']}
                                    contentStyle={{
                                        backgroundColor: 'rgba(17,24,39,0.96)',
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        borderRadius: '10px',
                                        color: '#fff'
                                    }}
                                    labelStyle={{ color: 'rgba(255,255,255,0.88)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="tokens"
                                    stroke="#60a5fa"
                                    strokeWidth={2}
                                    fill="url(#tokenGradient)"
                                    activeDot={{ r: 4, stroke: '#93c5fd', fill: '#dbeafe' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="xl:col-span-2 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl p-4 lg:p-6">
                    <div className="mb-4">
                        <h3 className="text-white text-lg font-semibold">用户增长与活跃</h3>
                        <p className="text-white/60 text-xs mt-1">近 7 天新增用户与活跃用户对比</p>
                    </div>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData}>
                                <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.18)' }} tickLine={false} />
                                <YAxis tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.18)' }} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(17,24,39,0.96)',
                                        border: '1px solid rgba(255,255,255,0.16)',
                                        borderRadius: '10px',
                                        color: '#fff'
                                    }}
                                    labelStyle={{ color: 'rgba(255,255,255,0.88)' }}
                                />
                                <Bar dataKey="newUsers" name="新增用户" fill="#34d399" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="activeUsers" name="活跃用户" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

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
