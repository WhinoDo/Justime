'use client'

import { MessageCircle } from 'lucide-react'

export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
        <MessageCircle className="w-12 h-12 text-blue-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          开始对话
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          告诉我你现在的任务或感受，我会根据你的情绪状态提供个性化的帮助和任务拆解建议
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
          情绪感知
        </span>
        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
          任务拆解
        </span>
        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
          智能陪伴
        </span>
      </div>
    </div>
  )
}
