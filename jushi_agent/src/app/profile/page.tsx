'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    User,
    Settings,
    LogOut,
    Mail,
    Shield,
    Bot,
    ChevronRight,
    Clock
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
    const { user, isAuthenticated, logout, isLoading } = useAuth()
    const router = useRouter()

    const handleLogout = async () => {
        await logout()
        router.push('/auth?mode=login')
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-900">加载中...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated || !user) {
        // Redirect handled by protected route usually, but for safe rendering:
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6 text-center">
                        <p className="mb-4">请先登录查看个人资料</p>
                        <Link href="/auth?mode=login">
                            <Button>前往登录</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Get initials for Avatar
    const initials = user.username?.slice(0, 2).toUpperCase() || 'U'

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Return Button */}
                <div className="flex items-center justify-start mb-2">
                    <Link href="/dashboard">
                        <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-black hover:text-black hover:bg-transparent">
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            返回控制台
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">个人中心</h1>
                        <p className="text-gray-500 mt-1">管理您的账户信息和偏好设置</p>
                    </div>
                </div>

                {/* User Card */}
                <Card className="bg-white shadow-lg border-2 border-blue-200 overflow-hidden">
                    <div className="h-24 bg-gradient-to-r from-blue-500 to-purple-500" />
                    <CardContent className="-mt-12">
                        <div className="flex flex-col items-center">
                            <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} />
                                <AvatarFallback className="bg-blue-100 text-blue-600 text-xl font-bold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>

                            <h2 className="mt-4 text-2xl font-bold text-gray-900">{user.displayName || user.username}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-gray-500">@{user.username}</span>
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                                    {user.role === 'admin' ? '管理员' : '普通用户'}
                                </Badge>
                            </div>

                            <div className="w-full mt-6 grid grid-cols-2 gap-4">
                                <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-500">注册时间</span>
                                    <span className="font-semibold text-gray-900 flex items-center mt-1">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {new Date().toLocaleDateString()} {/* Placeholder for created_at if not in user object */}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-500">账户状态</span>
                                    <span className="font-semibold text-green-600 flex items-center mt-1">
                                        <Shield className="h-3 w-3 mr-1" />
                                        活跃
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Settings Links */}
                <div className="grid gap-4">
                    <Link href="/model-config?from=/profile">
                        <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-100">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                                        <Bot className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">LLM 模型配置</h3>
                                        <p className="text-sm text-gray-500">配置 OpenAI Key、模型代理地址等</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/admin">
                        {user.role === 'admin' && (
                            <Card className="hover:shadow-md transition-shadow cursor-pointer border-purple-100">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                                            <Settings className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">系统管理</h3>
                                            <p className="text-sm text-gray-500">查看系统状态、用户统计</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-gray-400" />
                                </CardContent>
                            </Card>
                        )}
                    </Link>
                </div>

                {/* Info Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">账户信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">电子邮箱</p>
                                    <p className="text-sm text-gray-500">{user.email}</p>
                                </div>
                            </div>
                            {/* <Button variant="outline" size="sm">修改</Button> */}
                        </div>
                    </CardContent>
                </Card>

                {/* Logout */}
                <Button
                    variant="destructive"
                    className="w-full"
                    size="lg"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    退出登录
                </Button>

            </div>
        </div>
    )
}
