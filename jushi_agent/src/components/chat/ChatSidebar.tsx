'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Plus, MessageSquare, Trash2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ChatSession {
    _id: string
    title: string
    updatedAt: string
}

interface ChatSidebarProps {
    userId: string
    currentSessionId: string | null
    onSelectSession: (sessionId: string | null) => void
    className?: string
    autoSelectLatest?: boolean
}

export function ChatSidebar({ userId, currentSessionId, onSelectSession, className, autoSelectLatest = false }: ChatSidebarProps) {
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [loading, setLoading] = useState(false)



    // 加载会话列表
    const loadSessions = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/chat/sessions')

            const data = await res.json()
            if (data.sessions) {
                setSessions(data.sessions)

                // 如果需要自动选择最近的会话且当前没有选中会话且有会话存在
                if (autoSelectLatest && currentSessionId === null && data.sessions.length > 0) {
                    // 假设后端返回的 sessions 已经是按时间倒序排列 (通常是最近更新在前)
                    onSelectSession(data.sessions[0]._id)
                }
            }
        } catch (error) {
            console.error('加载会话列表失败:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (userId) {
            loadSessions()
        }
    }, [userId])

    // 对外暴露刷新方法 (通过 ref 或 context更好，这里先简单处理，依赖父组件 trigger)
    // 暂时在 select session 时不刷新，只有 mount 时刷新
    // 可以在新建会话后手动刷新，这里简化处理

    return (
        <div className={cn("flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r dark:border-gray-800", className)}>
            <div className="p-4 border-b dark:border-gray-800">
                <Button
                    className="w-full justify-start gap-2"
                    onClick={() => onSelectSession(null)}
                    variant={currentSessionId === null ? "secondary" : "outline"}
                >
                    <Plus className="h-4 w-4" />
                    新会话
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.map((session) => (
                    <div
                        key={session._id}
                        className={cn(
                            "group flex items-center justify-between p-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors",
                            currentSessionId === session._id && "bg-gray-200 dark:bg-gray-800 font-medium"
                        )}
                        onClick={() => onSelectSession(session._id)}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <MessageSquare className="h-4 w-4 shrink-0 text-gray-500" />
                            <span className="truncate">{session.title}</span>
                        </div>

                        {/* 更多操作 (后续可支持删除等) */}
                        {/* <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu> */}
                    </div>
                ))}

                {sessions.length === 0 && !loading && (
                    <div className="text-center py-8 text-xs text-gray-400">
                        暂无历史会话
                    </div>
                )}
            </div>
        </div>
    )
}
