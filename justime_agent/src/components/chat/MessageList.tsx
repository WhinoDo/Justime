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
import { cn } from '@/lib/utils'

const MessageBubble = dynamic(
  () => import('./MessageBubble').then((mod) => mod.MessageBubble),
  {
    ssr: false,
    loading: () => (
      <div className="flex gap-3 max-w-[70%] mr-auto animate-pulse">
        <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2 py-2">
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    ),
  }
)

export interface MessageListProps {
  density?: 'comfortable' | 'desktop'
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
  density = 'comfortable',
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
  const isDesktop = density === 'desktop'

  if (isEmpty && !streamingContent) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 scroll-smooth">
        <div className="flex h-full flex-col items-center justify-center space-y-5 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-900/20">
            <MessageCircle className="h-10 w-10 text-purple-400" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-foreground">
              开始对话
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              告诉我你现在的任务或感受，我会根据你的情绪状态提供个性化的帮助和任务拆解建议
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
              情绪感知
            </span>
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
              任务拆解
            </span>
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
              智能陪伴
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 scroll-smooth space-y-2">
      {messages.map((message, index) => (
        <div key={message.id || `msg-${index}`}>
          <MessageBubble
            message={message}
            onTaskCreate={onTaskCreate}
            onReferenceClick={onReferenceClick}
          />
          {/* Task selector for this message */}
          {taskMessageId === message.id && pendingTasks.length > 0 && (
            <div className="ml-10 mt-2">
              <TaskSelector
                tasks={pendingTasks}
                onTaskAdded={onTaskAdded}
              />
            </div>
          )}
          {/* Suggested events cards */}
          {message.suggestedEvents && message.suggestedEvents.length > 0 && (
            <div className="ml-10 mt-2 space-y-2">
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
        <div className="flex gap-3 max-w-[70%] mr-auto animate-slide-in">
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
      <div className="ml-10 mt-2">
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
    <div className="ml-10 mt-2">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg border border-border bg-muted p-2">
            <svg className="h-5 w-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">
              {decomp.project?.name || '任务分解方案'}
            </h4>
            <p className="text-xs text-muted-foreground">
              AI 已生成概要时间表
            </p>
          </div>
        </div>

        {decomp.project?.description && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {decomp.project.description}
          </p>
        )}

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/50 p-2 text-center">
            <div className="text-lg font-bold text-foreground">
              {(decomp.subtasks || []).length}
            </div>
            <div className="text-xs text-muted-foreground">子任务</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-2 text-center">
            <div className="text-lg font-bold text-foreground">
              {decomp.project?.total_days || '—'}
            </div>
            <div className="text-xs text-muted-foreground">天</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-2 text-center">
            <div className="text-lg font-bold text-foreground">
              {totalHours}
            </div>
            <div className="text-xs text-muted-foreground">总工时</div>
          </div>
        </div>

        <div className="mb-4 space-y-1.5">
          {(decomp.subtasks || []).slice(0, 4).map((task: SubtaskItem, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-foreground/80">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {task.order || idx + 1}
              </span>
              <span className="flex-1 truncate">{task.title}</span>
              <span className="text-xs text-muted-foreground">{task.duration_hours}h</span>
            </div>
          ))}
          {(decomp.subtasks || []).length > 4 && (
            <div className="text-center text-xs text-muted-foreground/60">
              ... 还有 {(decomp.subtasks || []).length - 4} 个子任务
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onExpandDecomposition(message.id)}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 flex items-center justify-center"
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
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            忽略
          </button>
        </div>
      </div>
    </div>
  )
})
