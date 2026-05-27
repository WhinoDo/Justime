'use client'

import { useMemo } from 'react'
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

interface AdminChartsProps {
    stats: Stats | null
}

export function AdminCharts({ stats }: AdminChartsProps) {
    const trendData = useMemo(() => buildMockTrendData(stats), [stats])

    return (
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
    )
}
