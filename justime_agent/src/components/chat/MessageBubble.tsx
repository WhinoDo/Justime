'use client'

import { Message, RagReference } from '@/types'
import { formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { Copy, Check, User, Bot, Brain, FileText } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from 'next-themes'

interface MessageBubbleProps {
  message: Message
  onTaskCreate?: (task: any) => void
  onReferenceClick?: (reference: RagReference) => void
}

export function MessageBubble({ message, onTaskCreate, onReferenceClick }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const { theme } = useTheme()

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  const formatTaskType = (taskType?: string) => {
    if (taskType === 'recitation') return '背诵任务'
    if (taskType === 'thinking') return '思考任务'
    return '通用任务'
  }

  const formatUrgency = (urgency?: string) => {
    if (urgency === 'high') return '高紧急'
    if (urgency === 'low') return '低紧急'
    return '中紧急'
  }

  return (
    <div className={cn(
      "flex gap-2 max-w-[70%] animate-in slide-in-from-bottom-2 duration-200",
      isUser ? "ml-auto flex-row-reverse" : "mr-auto"
    )}>
      {/* 头像 */}
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-1",
        isUser
          ? "bg-purple-200 dark:bg-purple-800 text-purple-600 dark:text-purple-300"
          : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300"
      )}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* 消息内容 */}
      <div className={cn(
        "flex flex-col gap-1 min-w-0",
        isUser ? "items-end" : "items-start"
      )}>
        {/* 消息气泡 */}
        <div className={cn(
          'relative max-w-full px-4 py-2.5 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'bg-purple-600 text-white rounded-2xl rounded-br-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-foreground rounded-2xl rounded-bl-sm'
        )}>
          {/* 任务分析元数据 */}
          {(message.timingStrategy || message.taskAnalysis) &&
            (message.taskAnalysis?.taskType !== 'general' && message.timingStrategy?.taskType !== 'general') && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-white/20 dark:border-white/10 pb-2 text-[10px]">
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                  isUser ? "bg-white/20 text-white/90" : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                )}>
                  <Brain className="w-3 h-3" />
                  {formatTaskType(message.taskAnalysis?.taskType || message.timingStrategy?.taskType)}
                </span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  isUser ? "bg-white/20 text-white/90" : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                )}>
                  难度 {message.taskAnalysis?.difficultyLevel || message.timingStrategy?.difficultyLevel || 3}
                </span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 font-medium",
                  isUser ? "bg-white/20 text-white/90" : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                )}>
                  {formatUrgency(message.taskAnalysis?.urgency || message.timingStrategy?.urgency)}
                </span>
                {typeof message.taskAnalysis?.confidence === 'number' && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    isUser ? "bg-white/20 text-white/90" : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                  )}>
                    {Math.round(message.taskAnalysis.confidence * 100)}%
                  </span>
                )}
              </div>
            )}

          {/* Markdown 渲染 */}
          <div className={cn(
            'prose prose-sm max-w-none',
            isUser
              ? 'prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-white prose-code:text-white prose-code:bg-white/20'
              : 'prose-headings:text-foreground prose-p:text-foreground/85 prose-strong:text-foreground prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-code:text-foreground prose-code:bg-gray-200 dark:prose-code:bg-gray-600'
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const language = match ? match[1] : ''
                  const codeString = String(children).replace(/\n$/, '')
                  const inline = !language

                  if (!inline && language) {
                    return (
                      <div className="relative group/code my-2">
                        <div className="flex items-center justify-between bg-gray-800 text-gray-200 px-4 py-2 text-xs rounded-t-lg">
                          <span className="font-medium">{language}</span>
                          <button
                            onClick={() => handleCopyCode(codeString)}
                            className="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-gray-700"
                          >
                            {copiedCode === codeString ? (
                              <>
                                <Check size={12} />
                                <span>已复制</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>复制</span>
                              </>
                            )}
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={theme === 'dark' ? oneDark : oneLight}
                          language={language}
                          PreTag="div"
                          className="!mt-0 !rounded-t-none"
                          {...props}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    )
                  }

                  return (
                    <code
                      className={cn(
                        "px-1.5 py-0.5 rounded text-sm font-mono",
                        isUser
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-foreground'
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
                blockquote: ({ children }: any) => (
                  <blockquote className={cn(
                    "border-l-4 pl-4 py-2 my-2 italic",
                    isUser
                      ? 'border-white/30 text-white/85'
                      : 'border-gray-300 dark:border-gray-500 text-muted-foreground'
                  )}>
                    {children}
                  </blockquote>
                ),
                ul: ({ children }: any) => (
                  <ul className="list-disc list-inside space-y-1 my-2">
                    {children}
                  </ul>
                ),
                ol: ({ children }: any) => (
                  <ol className="list-decimal list-inside space-y-1 my-2">
                    {children}
                  </ol>
                ),
                table: ({ children }: any) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border-collapse border border-border">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }: any) => (
                  <th className={cn(
                    'border border-border px-3 py-2 text-left font-semibold',
                    isUser ? 'bg-white/10 text-white' : 'bg-muted text-foreground'
                  )}>
                    {children}
                  </th>
                ),
                td: ({ children }: any) => (
                  <td className="border border-border px-3 py-2 text-foreground/80">
                    {children}
                  </td>
                )
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* RAG 引用文档 */}
        {!isUser && message.ragReferences && message.ragReferences.length > 0 && (
          <div className="max-w-full rounded-xl border border-border bg-background p-3 shadow-sm">
            <div className="mb-2 text-xs font-medium text-foreground/80">
              引用文档
            </div>
            <div className="flex flex-wrap gap-2">
              {message.ragReferences.map((reference) => (
                <button
                  key={reference.referenceId}
                  type="button"
                  onClick={() => onReferenceClick?.(reference)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-accent"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[180px] truncate">{reference.fileName || reference.docPath}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {reference.snippets?.length || 0} 段
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 时间戳 */}
        <div className={cn(
          "flex items-center gap-2 px-1",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="text-[11px] text-muted-foreground/60">
            {formatTime(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}
