'use client'

import Link from 'next/link'
import { ServerCog, KeyRound, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminSettingsPage() {
    const settingsGroups = [
        {
            title: '模型配置',
            description: '管理系统全局 LLM 模型，配置服务地址、API Key 和能力标签。',
            icon: ServerCog,
            href: '/admin/models',
            color: 'text-indigo-300',
            bg: 'bg-indigo-500/20',
            ring: 'ring-indigo-500/30',
        },
        {
            title: 'API Key 管理',
            description: '管理可复用的系统 API Key，供模型配置统一引用。',
            icon: KeyRound,
            href: '/admin/apikeys',
            color: 'text-violet-300',
            bg: 'bg-violet-500/20',
            ring: 'ring-violet-500/30',
        },
        {
            title: '用户管理',
            description: '管理用户账户、角色、状态和模型访问权限。',
            icon: Shield,
            href: '/admin/users',
            color: 'text-emerald-300',
            bg: 'bg-emerald-500/20',
            ring: 'ring-emerald-500/30',
        },
    ]

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">系统设置</h2>
                <p className="text-muted-foreground mt-2">管理平台的全局配置项。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {settingsGroups.map((group) => (
                    <Link key={group.href} href={group.href}>
                        <div className="group p-6 rounded-2xl bg-muted/30 backdrop-blur-md border border-border shadow-xl transition-all hover:bg-accent/50 hover:border-ring cursor-pointer">
                            <div className={`h-12 w-12 rounded-xl ${group.bg} ring-1 ${group.ring} flex items-center justify-center ${group.color} mb-4`}>
                                <group.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">{group.title}</h3>
                            <p className="text-sm text-muted-foreground">{group.description}</p>
                            <div className="mt-4">
                                <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                                    前往配置 →
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}