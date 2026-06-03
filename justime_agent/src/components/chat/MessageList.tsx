'use client'

import { useRef, useEffect, memo } from 'react'
import { MessageCircle } from 'lucide-react'
import { Message, RagReference, TaskDecomposition, SuggestedCalendarEvent, SubtaskItem } from '@/types'
import { TaskItem } from '@/lib/ai/task-planner'
import dynamic from 'next/dynamic'
import { TaskSelector } from './TaskSelector'
import { SuggestedEventCard } from './SuggestedEventCard'
import { EditableTaskPlan } from './EditableTaskPlan'
import { ThinkingLoader } from './ThinkingLoader'
import { TypewriterMessage } from './TypewriterMessage'

const MessageBubble = dynamic(
  () => import('./MessageBubble').then((mod) => mod.MessageBubble),
  {
    ssr: false,
    loading: () => (
      <div className="flex gap-3 max-w-[85%] mr-auto animate-pulse">
        <div className="h-8 w-8 rounded-full bg-white/10" />
        <div className="flex-1 space-y-2 py-2">
          <div className="h-4 w-3/4 rounded bg-white/10" />
          <div className="h-4 w-1/2 rounded bg-white/10" />
        </div>
      </div>
    ),
  }
)

export interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  streamingMessage: Message | null
  streamingContent: string
  /** Callback when a reference is clicked */
  onReferenceClick: (reference: RagReference) => void
  /** Callback when a task is created */
  onTaskCreate?: (task: SubtaskItem) => void
  /** Task selector state */
  pendingTasks: TaskItem[]
  taskMessageId: string | null
  onTaskAdded: (task: TaskItem) => void
  /** Suggested events state */
  onConfirmEvent: (event: SuggestedCalendarEvent, messageId?: string) => Promise<void>
  onDismissEvent: (event: SuggestedCalendarEvent, messageId?: string) => void
  /** Task decomposition state */
  taskDecomposition: TaskDecomposition | null
  decompositionMessageId: string | null
  multiTaskDecompositions: TaskDecomposition[] | null
  expandedDecompositionId: string | null
  onConfirmDecomposition: (project: { name?: string; description?: string; start_date?: string }, selectedTasks: SubtaskItem[], messageId?: string) => Promise<void>
  onExpandDecomposition: (messageId: string | null) => void
  onCancelDecomposition: (messageId: string) => void
  /** User ID for message attribution */
  authUserId?: string
}

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  streamingMessage,
  streamingContent,
  onReferenceClick,
  onTaskCreate,
  pendingTasks,
  taskMessageId,
  onTaskAdded,
  onConfirmEvent,
  onDismissEvent,
  taskDecomposition,
  decompositionMessageId,
  multiTaskDecompositions,
  expandedDecompositionId,
  onConfirmDecomposition,
  onExpandDecomposition,
  onCancelDecomposition,
  authUserId,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const isEmpty = messages.length === 0

  if (isEmpty && !streamingContent) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 scroll-smooth">
        <div className="flex h-full flex-col items-center justify-center space-y-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/15 bg-white/10 shadow-2xl shadow-black/10">
            <MessageCircle className="h-12 w-12 text-white/80" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">
              开始对话
            </h3>
            <p className="max-w-md text-white/60">
              告诉我你现在的任务或感受，我会根据你的情绪状态提供个性化的帮助和任务拆解建议
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
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 scroll-smooth">
      {messages.map((message, index) => (
        <div key={message.id || `msg-${index}`}>
          <MessageBubble
            message={message}
            onTaskCreate={onTaskCreate}
            onReferenceClick={onReferenceClick}
          />
          {/* Task selector for this message */}
          {taskMessageId === message.id && pendingTasks.length > 0 && (
            <TaskSelector
              tasks={pendingTasks}
              onTaskAdded={onTaskAdded}
            />
          )}
          {/* Suggested events cards */}
          {message.suggestedEvents && message.suggestedEvents.length > 0 && (
            <div className="ml-11 mt-2 space-y-2">
              {message.suggestedEvents.map((event, eventIndex) => (
                <SuggestedEventCard
                  key={`${event.title}-${eventIndex}`}
                  event={event}
                  onConfirm={(e) => onConfirmEvent(e, message.id)}
                  onDismiss={() => onDismissEvent(event, message.id)}
                />
              ))}
            </div>
          )}
          {/* Task decomposition card */}
          {((message.taskDecomposition?.project) || (decompositionMessageId === message.id && taskDecomposition?.project)) && (
            <TaskDecompositionCard
              message={message}
              taskDecomposition={taskDecomposition}
              multiTaskDecompositions={multiTaskDecompositions}
              expandedDecompositionId={expandedDecompositionId}
              onConfirmDecomposition={onConfirmDecomposition}
              onExpandDecomposition={onExpandDecomposition}
              onCancelDecomposition={onCancelDecomposition}
            />
          )}
        </div>
      ))}

      {/* Streaming message with typewriter effect */}
      {streamingMessage && streamingContent && (
        <TypewriterMessage
          content={streamingContent}
          isStreaming={isLoading}
          speed={15}
          message={streamingMessage}
          onReferenceClick={onReferenceClick}
        />
      )}

      {/* Non-streaming loading indicator */}
      {isLoading && !streamingContent && (
        <div className="flex gap-3 max-w-[85%] mr-auto animate-slide-in">
          <ThinkingLoader input={messages[messages.length - 1]?.content || ''} />
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
})

/** Internal component for task decomposition card display */
interface TaskDecompositionCardProps {
  message: Message
  taskDecomposition: TaskDecomposition | null
  multiTaskDecompositions: TaskDecomposition[] | null
  expandedDecompositionId: string | null
  onConfirmDecomposition: (project: { name?: string; description?: string; start_date?: string }, selectedTasks: SubtaskItem[], messageId?: string) => Promise<void>
  onExpandDecomposition: (messageId: string | null) => void
  onCancelDecomposition: (messageId: string) => void
}

const TaskDecompositionCard = memo(function TaskDecompositionCard({
  message,
  taskDecomposition,
  multiTaskDecompositions,
  expandedDecompositionId,
  onConfirmDecomposition,
  onExpandDecomposition,
  onCancelDecomposition,
}: TaskDecompositionCardProps) {
  const decomp = message.taskDecomposition || taskDecomposition
  if (!decomp) return null

  const isExpanded = expandedDecompositionId === message.id
  const totalHours = (decomp.subtasks || []).reduce((sum: number, t: { duration_hours?: number }) => sum + (t.duration_hours || 0), 0)

  if (isExpanded) {
    return (
      <div className="ml-11 mt-2">
        <EditableTaskPlan
          decomposition={decomp}
          alternatives={message.multiTaskDecompositions || multiTaskDecompositions || undefined}
          onConfirm={(project, tasks) => onConfirmDecomposition(project, tasks, message.id)}
          onCancel={() => onExpandDecomposition(null)}
        />
      </div>
    )
  }

  return (
    <div className="ml-11 mt-2">
      <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-xl shadow-black/10 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-white/10 p-2">
            <svg className="h-5 w-5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-white">
              {decomp.project?.name || '任务分解方案'}
            </h4>
            <p className="text-xs text-white/50">
              AI 已生成概要时间表
            </p>
          </div>
        </div>

        {decomp.project?.description && (
          <p className="mb-3 line-clamp-2 text-sm text-white/65">
            {decomp.project.description}
          </p>
        )}

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/10 p-2 text-center">
            <div className="text-lg font-bold text-white">
              {(decomp.subtasks || []).length}
            </div>
            <div className="text-xs text-white/45">子任务</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/10 p-2 text-center">
            <div className="text-lg font-bold text-white">
              {decomp.project?.total_days || '—'}
            </div>
            <div className="text-xs text-white/45">天</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/10 p-2 text-center">
            <div className="text-lg font-bold text-white">
              {totalHours}
            </div>
            <div className="text-xs text-white/45">总工时</div>
          </div>
        </div>

        <div className="mb-4 space-y-1.5">
          {(decomp.subtasks || []).slice(0, 4).map((task: SubtaskItem, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-white/80">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-white/10 text-xs font-medium text-white/80">
                {task.order || idx + 1}
              </span>
              <span className="flex-1 truncate">{task.title}</span>
              <span className="text-xs text-white/45">{task.duration_hours}h</span>
            </div>
          ))}
          {(decomp.subtasks || []).length > 4 && (
            <div className="text-center text-xs text-white/40">
              ... 还有 {(decomp.subtasks || []).length - 4} 个子任务
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onExpandDecomposition(message.id)}
            className="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-white/90 flex items-center justify-center"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            查看详细日程安排
            <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => onCancelDecomposition(message.id)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            忽略
          </button>
        </div>
      </div>
    </div>
  )
})
