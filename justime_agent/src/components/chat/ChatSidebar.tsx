'use client'

import { Button } from '@/components/ui/button'
import { Plus, MessageSquare, Search } from 'lucide-react'
import { useChatSessions } from '@/hooks/useChatSessions'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ChatSidebarProps {
    userId: string
    currentSessionId: string | null
    onSelectSession: (sessionId: string | null) => void
    className?: string
    autoSelectLatest?: boolean
    variant?: 'glass' | 'desktop'
}

export function ChatSidebar({
    userId,
    currentSessionId,
    onSelectSession,
    className,
    autoSelectLatest = false,
    variant = 'glass',
}: ChatSidebarProps) {
    const { sessions, loading } = useChatSessions({
        userId,
        autoSelectLatest,
        currentSessionId,
        onAutoSelect: onSelectSession,
    })
    const [searchQuery, setSearchQuery] = useState('')

    const filteredSessions = sessions.filter(s =>
        !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const isDesktop = variant === 'desktop'

    return (
        <div className={cn("flex h-full flex-col bg-white dark:bg-gray-900", className)}>
            {/* macOS 风格搜索框 */}
            <div className="px-3 pt-3 pb-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索会话..."
                        className="w-full h-9 rounded-lg border border-input bg-secondary pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                    />
                </div>
            </div>

            {/* macOS 风格新建会话按钮 */}
            <div className="px-3 pb-2">
                <Button
                    className="w-full justify-start gap-2 rounded-lg border border-white/10 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => onSelectSession(null)}
                >
                    <Plus className="h-4 w-4" />
                    新会话
                </Button>
            </div>

            {/* macOS 风格会话列表 */}
            <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
                {filteredSessions.map((session) => (
                    <button
                        key={session._id}
                        type="button"
                        className={cn(
                            "group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-[13px] transition-all duration-150",
                            "hover:bg-white/10",
                            currentSessionId === session._id
                                ? "border-blue-400/30 bg-blue-500/20"
                                : "bg-transparent"
                        )}
                        onClick={() => onSelectSession(session._id)}
                    >
                        <div className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                            currentSessionId === session._id
                                ? "bg-blue-400/20"
                                : "bg-white/10"
                        )}>
                            <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{session.title}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground/70">继续之前的对话</div>
                        </div>
                    </button>
                ))}

                {loading && sessions.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                        正在加载会话...
                    </div>
                )}

                {filteredSessions.length === 0 && !loading && (
                    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-xs text-muted-foreground">
                        {searchQuery ? '未找到匹配的会话' : '暂无历史会话'}
                    </div>
                )}
            </div>

            {/* 底部模型信息和 token 用量 */}
            <div className="border-t border-border px-3 py-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Token 用量</span>
                    <span className="font-mono">—</span>
                </div>
            </div>
        </div>
    )
}
