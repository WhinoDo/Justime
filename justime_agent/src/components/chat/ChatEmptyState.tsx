'use client'

import { memo } from 'react'
import { MessageCircle } from 'lucide-react'

export interface ChatEmptyStateProps {
  /** Optional custom title */
  title?: string
  /** Optional custom description */
  description?: string
}

export const ChatEmptyState = memo(function ChatEmptyState({
  title = '开始对话',
  description = '告诉我你现在的任务或感受，我会根据你的情绪状态提供个性化的帮助和任务拆解建议',
}: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/[0.15] bg-white/10 shadow-2xl shadow-black/10">
        <MessageCircle className="h-12 w-12 text-white/80" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">
          {title}
        </h3>
        <p className="max-w-md text-white/60">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/75">
          情绪感知
        </span>
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/75">
          任务拆解
        </span>
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/75">
          智能陪伴
        </span>
      </div>
    </div>
  )
})
