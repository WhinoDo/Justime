'use client'

import { Button } from '@/components/ui/button'
import { Plus, MessageSquare } from 'lucide-react'
import { useChatSessions } from '@/hooks/useChatSessions'
import { cn } from '@/lib/utils'

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

    const isDesktop = variant === 'desktop'

    return (
        <div className={cn(
            "flex h-full flex-col",
            isDesktop ? "bg-white/50 text-[#171421] backdrop-blur-2xl" : "text-white",
            className
        )}>
            <div className={cn("p-4", isDesktop ? "border-b border-violet-200/40" : "border-b border-white/10")}>
                <Button
                    className={cn(
                        "w-full justify-start gap-2 text-left",
                        isDesktop
                            ? "rounded-xl border border-violet-200/60 bg-white/[0.72] text-[#5a4c73] hover:bg-white/[0.82] hover:text-[#171421] shadow-sm"
                            : "rounded-2xl border border-white/[0.15] bg-white/10 text-white shadow-lg shadow-black/10 hover:bg-white/[0.15]"
                    )}
                    onClick={() => onSelectSession(null)}
                    variant="ghost"
                >
                    <Plus className="h-4 w-4" />
                    新会话
                </Button>
            </div>

            <div className={cn("flex-1 space-y-2 overflow-y-auto px-3 py-4", isDesktop && "desktop-scrollbar")}>
                {sessions.map((session) => {
                    const active = currentSessionId === session._id
                    return (
                        <button
                            key={session._id}
                            type="button"
                            className={cn(
                                "group flex w-full items-center gap-3 border border-transparent px-3 py-3 text-left text-sm transition-all duration-200",
                                isDesktop
                                    ? "rounded-xl hover:border-violet-200/60 hover:bg-white/[0.72]"
                                    : "rounded-2xl hover:border-white/10 hover:bg-white/10",
                                active
                                    ? isDesktop
                                        ? "border-violet-300/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(238,231,255,0.76))] shadow-[0_16px_44px_rgba(112,77,171,0.12)]"
                                        : "border-white/20 bg-white/[0.15] shadow-lg shadow-black/10"
                                    : isDesktop
                                        ? "bg-transparent"
                                        : "bg-white/5"
                            )}
                            onClick={() => onSelectSession(session._id)}
                        >
                            <div className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                                isDesktop
                                    ? "border-violet-200/50 bg-white/70 text-violet-600"
                                    : "border-white/10 bg-white/10 text-white/70",
                                active && !isDesktop && "bg-white/20"
                            )}>
                                <MessageSquare className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className={cn(
                                    "truncate text-sm font-medium",
                                    isDesktop ? "text-[#171421]" : "text-white/90"
                                )}>{session.title}</div>
                                <div className={cn(
                                    "mt-1 text-xs",
                                    isDesktop ? "text-[#8b7aa8]" : "text-white/[0.45]"
                                )}>继续之前的对话</div>
                            </div>
                        </button>
                    )
                })}

                {loading && sessions.length === 0 && (
                    <div className={cn("py-8 text-center text-xs", isDesktop ? "text-[#8b7aa8]" : "text-white/[0.45]")}>
                        正在加载会话...
                    </div>
                )}

                {sessions.length === 0 && !loading && (
                    <div className={cn(
                        "px-4 py-8 text-center text-xs",
                        isDesktop
                            ? "rounded-xl border border-dashed border-violet-200/60 bg-white/[0.48] text-[#8b7aa8]"
                            : "rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-white/[0.45]"
                    )}>
                        暂无历史会话
                    </div>
                )}
            </div>
        </div>
    )
}
