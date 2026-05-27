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
      "group flex gap-3 max-w-[85%] animate-in slide-in-from-bottom-1 duration-300",
      isUser ? "ml-auto flex-row-reverse" : "mr-auto"
    )}>
      {/* 头像 */}
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 shadow-md",
        isUser
          ? "bg-white/15 text-white"
          : "bg-white/10 text-emerald-100"
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* 消息内容 */}
      <div className={cn(
        "flex flex-col gap-2 min-w-0 flex-1",
        isUser ? "items-end" : "items-start"
      )}>
        {/* 消息气泡 */}
        <div className={cn(
          'relative max-w-full rounded-2xl border px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md',
          isUser
            ? 'rounded-br-md border-white/10 bg-white/15 text-white'
            : 'rounded-bl-md border-white/10 bg-white/10 text-white/90'
        )}>
          {/* 任务分析元数据（仅对非通用对话展示） */}
          {(message.timingStrategy || message.taskAnalysis) &&
            (message.taskAnalysis?.taskType !== 'general' && message.timingStrategy?.taskType !== 'general') && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-2 text-[10px] md:text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-medium text-white/80">
                  <Brain className="w-3 h-3" />
                  {formatTaskType(message.taskAnalysis?.taskType || message.timingStrategy?.taskType)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-medium text-white/75">
                  难度 {message.taskAnalysis?.difficultyLevel || message.timingStrategy?.difficultyLevel || 3}
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-medium text-white/75">
                  {formatUrgency(message.taskAnalysis?.urgency || message.timingStrategy?.urgency)}
                </span>
                {typeof message.taskAnalysis?.confidence === 'number' && (
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 font-medium text-white/75">
                    {Math.round(message.taskAnalysis.confidence * 100)}%
                  </span>
                )}
              </div>
            )}
          {/* Markdown 渲染 */}
          <div className={cn(
            'prose prose-sm max-w-none',
            isUser
              ? 'prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-white prose-code:text-white prose-code:bg-white/10'
              : 'prose-invert prose-headings:text-white prose-p:text-white/85 prose-strong:text-white prose-em:text-white/85 prose-code:text-white prose-code:bg-white/10'
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
                      <div className="relative group/code">
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
                          ? 'bg-white/10 text-white'
                          : 'bg-white/10 text-white/90'
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
                      : 'border-white/20 text-white/70'
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
                    <table className="min-w-full border-collapse border border-white/10">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }: any) => (
                  <th className={cn(
                    'border border-white/10 px-3 py-2 text-left font-semibold',
                    isUser
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 text-white/85'
                  )}>
                    {children}
                  </th>
                ),
                td: ({ children }: any) => (
                  <td className="border border-white/10 px-3 py-2 text-white/80">
                    {children}
                  </td>
                )
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {!isUser && message.ragReferences && message.ragReferences.length > 0 && (
          <div className="w-fit max-w-[100%] rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
            <div className="mb-2 text-xs font-medium text-white/80">
              引用文档
            </div>
            <div className="flex flex-wrap gap-2">
              {message.ragReferences.map((reference) => (
                <button
                  key={reference.referenceId}
                  type="button"
                  onClick={() => onReferenceClick?.(reference)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-2.5 py-1.5 text-xs text-white/80 transition-colors hover:bg-white/15"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[180px] truncate">{reference.fileName || reference.docPath}</span>
                  <span className="text-[10px] text-white/45">
                    {reference.snippets?.length || 0} 段
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 元信息 */}
        <div className={cn(
          "flex items-center gap-2 text-xs",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          {/* 时间戳 */}
          <span className="text-white/40">
            {formatTime(message.created_at)}
          </span>

          {/* 情绪评分 */}
          {/* Emotion score display removed */}
        </div>
      </div>
    </div>
  )
} 
