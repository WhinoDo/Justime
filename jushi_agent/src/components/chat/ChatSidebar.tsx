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
}

export function ChatSidebar({ userId, currentSessionId, onSelectSession, className, autoSelectLatest = false }: ChatSidebarProps) {
    const { sessions, loading } = useChatSessions({
        userId,
        autoSelectLatest,
        currentSessionId,
        onAutoSelect: onSelectSession,
    })

    return (
        <div className={cn("flex h-full flex-col text-white", className)}>
            <div className="border-b border-white/10 p-4">
                <Button
                    className="w-full justify-start gap-2 rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg shadow-black/10 hover:bg-white/15"
                    onClick={() => onSelectSession(null)}
                    variant="ghost"
                >
                    <Plus className="h-4 w-4" />
                    新会话
                </Button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
                {sessions.map((session) => (
                    <button
                        key={session._id}
                        type="button"
                        className={cn(
                            "group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-sm transition-all duration-200",
                            "hover:border-white/10 hover:bg-white/10",
                            currentSessionId === session._id
                                ? "border-white/20 bg-white/15 shadow-lg shadow-black/10"
                                : "bg-white/5"
                        )}
                        onClick={() => onSelectSession(session._id)}
                    >
                        <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10",
                            currentSessionId === session._id && "bg-white/20"
                        )}>
                            <MessageSquare className="h-4 w-4 text-white/70" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-white/90">{session.title}</div>
                            <div className="mt-1 text-xs text-white/45">继续之前的对话</div>
                        </div>
                    </button>
                ))}

                {loading && sessions.length === 0 && (
                    <div className="py-8 text-center text-xs text-white/45">
                        正在加载会话...
                    </div>
                )}

                {sessions.length === 0 && !loading && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-xs text-white/45">
                        暂无历史会话
                    </div>
                )}
            </div>
        </div>
    )
}
