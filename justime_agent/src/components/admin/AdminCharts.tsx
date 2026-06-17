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
import { cn } from '@/lib/utils'

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
    isDesktop?: boolean
}

export function AdminCharts({ stats, isDesktop }: AdminChartsProps) {
    const trendData = useMemo(() => buildMockTrendData(stats), [stats])

    return (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className={cn(
                "xl:col-span-3 rounded-2xl border p-4 lg:p-6",
                isDesktop
                    ? "bg-white/[0.68] border-violet-200/[0.45] shadow-[0_12px_40px_rgba(112,77,171,0.06)]"
                    : "border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl"
            )}>
                <div className="mb-4">
                    <h3 className={cn("text-lg font-semibold", isDesktop ? "text-[#171421]" : "text-white")}>近 7 天 Token 消耗趋势</h3>
                    <p className={cn("text-xs mt-1", isDesktop ? "text-[#6d6680]" : "text-white/60")}>基于当前总量推演 of 日级趋势，用于可视化预览</p>
                </div>
                <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={isDesktop ? "#7c3aed" : "#3b82f6"} stopOpacity={0.55} />
                                    <stop offset="100%" stopColor={isDesktop ? "#7c3aed" : "#3b82f6"} stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke={isDesktop ? "rgba(112, 77, 171, 0.1)" : "rgba(255,255,255,0.12)"} strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fill: isDesktop ? "#6d6680" : "rgba(255,255,255,0.72)", fontSize: 12 }} axisLine={{ stroke: isDesktop ? "rgba(112, 77, 171, 0.15)" : "rgba(255,255,255,0.18)" }} tickLine={false} />
                            <YAxis tickFormatter={(v) => formatTokens(v)} tick={{ fill: isDesktop ? "#6d6680" : "rgba(255,255,255,0.72)", fontSize: 12 }} axisLine={{ stroke: isDesktop ? "rgba(112, 77, 171, 0.15)" : "rgba(255,255,255,0.18)" }} tickLine={false} />
                            <Tooltip
                                formatter={(value: number) => [value.toLocaleString(), 'Token']}
                                contentStyle={{
                                    backgroundColor: isDesktop ? 'rgba(255,255,255,0.96)' : 'rgba(17,24,39,0.96)',
                                    border: isDesktop ? '1px solid rgba(112,77,171,0.18)' : '1px solid rgba(255,255,255,0.16)',
                                    borderRadius: '10px',
                                    color: isDesktop ? '#171421' : '#fff'
                                }}
                                labelStyle={{ color: isDesktop ? '#6d6680' : 'rgba(255,255,255,0.88)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="tokens"
                                stroke={isDesktop ? "#8b5cf6" : "#60a5fa"}
                                strokeWidth={2}
                                fill="url(#tokenGradient)"
                                activeDot={{ r: 4, stroke: isDesktop ? '#c084fc' : '#93c5fd', fill: isDesktop ? '#faf5ff' : '#dbeafe' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className={cn(
                "xl:col-span-2 rounded-2xl border p-4 lg:p-6",
                isDesktop
                    ? "bg-white/[0.68] border-violet-200/[0.45] shadow-[0_12px_40px_rgba(112,77,171,0.06)]"
                    : "border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl"
            )}>
                <div className="mb-4">
                    <h3 className={cn("text-lg font-semibold", isDesktop ? "text-[#171421]" : "text-white")}>用户增长与活跃</h3>
                    <p className={cn("text-xs mt-1", isDesktop ? "text-[#6d6680]" : "text-white/60")}>近 7 天新增用户与活跃用户对比</p>
                </div>
                <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendData}>
                            <CartesianGrid stroke={isDesktop ? "rgba(112, 77, 171, 0.1)" : "rgba(255,255,255,0.12)"} strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fill: isDesktop ? "#6d6680" : "rgba(255,255,255,0.72)", fontSize: 12 }} axisLine={{ stroke: isDesktop ? "rgba(112, 77, 171, 0.15)" : "rgba(255,255,255,0.18)" }} tickLine={false} />
                            <YAxis tick={{ fill: isDesktop ? "#6d6680" : "rgba(255,255,255,0.72)", fontSize: 12 }} axisLine={{ stroke: isDesktop ? "rgba(112, 77, 171, 0.15)" : "rgba(255,255,255,0.18)" }} tickLine={false} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: isDesktop ? 'rgba(255,255,255,0.96)' : 'rgba(17,24,39,0.96)',
                                    border: isDesktop ? '1px solid rgba(112,77,171,0.18)' : '1px solid rgba(255,255,255,0.16)',
                                    borderRadius: '10px',
                                    color: isDesktop ? '#171421' : '#fff'
                                }}
                                labelStyle={{ color: isDesktop ? '#6d6680' : 'rgba(255,255,255,0.88)' }}
                            />
                            <Bar dataKey="newUsers" name="新增用户" fill={isDesktop ? "#7c3aed" : "#34d399"} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="activeUsers" name="活跃用户" fill={isDesktop ? "#c084fc" : "#38bdf8"} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
