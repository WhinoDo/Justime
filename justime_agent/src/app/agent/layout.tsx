'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShieldAlert,
  ArrowLeft,
  Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { JustimeBackground } from '@/components/ui/JustimeBackground'

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useAuth()

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center text-foreground">
        <JustimeBackground blur="lg" opacity={0.6} />
        <div className="relative z-10 text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">访问被拒绝</h1>
          <p className="text-muted-foreground">仅管理员可访问此页面</p>
          <Link href="/">
            <Button variant="outline" className="border-ring bg-muted/50 text-foreground hover:bg-accent/50 hover:text-foreground">返回首页</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <JustimeBackground blur="lg" opacity={0.6} />

      {/* 顶部导航 */}
      <div className="relative z-10 bg-muted/50 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">管理后台</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-foreground">
              <Bot className="w-5 h-5" />
              <span className="font-semibold">Agent 管理</span>
            </div>
          </div>
        </div>
      </div>

      {/* 页面内容 */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {children}
      </main>
    </div>
  )
}
