'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Users,
    MessageSquare,
    Zap,
    Activity,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'

// Mock Data Types
interface Stats {
    total_users: number
    active_users: number
    total_tokens: number
    total_conversations: number
    version: string
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Fetch stats from backend
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/admin/stats')
                if (response.ok) {
                    const data = await response.json()
                    setStats(data)
                }
            } catch (error) {
                console.error('Failed to fetch stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    const StatCard = ({ title, value, icon: Icon, trend, trendValue, description }: any) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                    {title}
                </CardTitle>
                <Icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="flex items-center text-xs mt-1">
                    {trend === 'up' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span className={trend === 'up' ? 'text-green-500' : 'text-red-500'}>
                        {trendValue}
                    </span>
                    <span className="text-gray-500 ml-1">{description}</span>
                </div>
            </CardContent>
        </Card>
    )

    if (loading) {
        return <div className="p-8 text-center">加载中...</div>
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">概览仪表盘</h2>
                <p className="text-gray-500 mt-2">
                    欢迎回来，这里是系统的实时运行状态概览。
                </p>
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
                    title="Token消耗"
                    value={stats?.total_tokens ? `${(stats.total_tokens / 1000000).toFixed(1)}M` : '0'}
                    icon={Zap}
                    trend="down"
                    trendValue="-2.1%"
                    description="较上周"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-7">
                    <CardHeader>
                        <CardTitle>系统状态概览</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col space-y-2 p-4 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-500">后端版本</span>
                                <span className="text-lg font-bold text-gray-900">{stats?.version || 'Unknown'}</span>
                            </div>
                            <div className="flex flex-col space-y-2 p-4 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-500">数据库连接</span>
                                <span className="flex items-center text-lg text-green-600 font-semibold">
                                    <div className="w-2 h-2 rounded-full bg-green-600 mr-2" />
                                    正常
                                </span>
                            </div>
                            <div className="flex flex-col space-y-2 p-4 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-500">LLM服务</span>
                                <span className="flex items-center text-lg text-green-600 font-semibold">
                                    <div className="w-2 h-2 rounded-full bg-green-600 mr-2" />
                                    运行中
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
