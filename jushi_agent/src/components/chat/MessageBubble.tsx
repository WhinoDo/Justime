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

  const getEmotionColor = (score?: number) => {
    if (!score) return ''
    if (score <= 3) return 'text-red-500'
    if (score <= 6) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getEmotionLabel = (score?: number) => {
    if (!score) return ''
    if (score <= 3) return '重度焦虑'
    if (score <= 6) return '中度焦虑'
    return '状态良好'
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
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md",
        isUser
          ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
          : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
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
          "relative rounded-2xl px-4 py-3 shadow-sm border max-w-full",
          "transition-all duration-200 hover:shadow-md",
          isUser
            ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-md"
            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-md border-gray-200 dark:border-gray-700"
        )}>
          {/* 任务分析元数据（仅对非通用对话展示） */}
          {(message.timingStrategy || message.taskAnalysis) &&
            (message.taskAnalysis?.taskType !== 'general' && message.timingStrategy?.taskType !== 'general') && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px] md:text-xs border-b border-gray-100 dark:border-gray-700/50 pb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                  <Brain className="w-3 h-3" />
                  {formatTaskType(message.taskAnalysis?.taskType || message.timingStrategy?.taskType)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-medium">
                  难度 {message.taskAnalysis?.difficultyLevel || message.timingStrategy?.difficultyLevel || 3}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
                  {formatUrgency(message.taskAnalysis?.urgency || message.timingStrategy?.urgency)}
                </span>
                {typeof message.taskAnalysis?.confidence === 'number' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium">
                    {Math.round(message.taskAnalysis.confidence * 100)}%
                  </span>
                )}
              </div>
            )}
          {/* Markdown 渲染 */}
          <div className={cn(
            "prose prose-sm max-w-none",
            isUser
              ? "prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-white prose-code:text-blue-100 prose-code:bg-blue-600/30"
              : "prose-gray dark:prose-invert prose-headings:text-gray-800 dark:prose-headings:text-gray-100"
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
                            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
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
                          ? "bg-blue-600/30 text-blue-100"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
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
                      ? "border-blue-300 text-blue-100"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
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
                    <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }: any) => (
                  <th className={cn(
                    "border border-gray-300 dark:border-gray-600 px-3 py-2 font-semibold text-left",
                    isUser
                      ? "bg-blue-600/20 text-white"
                      : "bg-gray-50 dark:bg-gray-700"
                  )}>
                    {children}
                  </th>
                ),
                td: ({ children }: any) => (
                  <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
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
          <div className="w-fit max-w-[100%] rounded-xl border border-blue-200/80 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-900/20">
            <div className="mb-2 text-xs font-medium text-blue-700 dark:text-blue-300">
              引用文档
            </div>
            <div className="flex flex-wrap gap-2">
              {message.ragReferences.map((reference) => (
                <button
                  key={reference.referenceId}
                  type="button"
                  onClick={() => onReferenceClick?.(reference)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-blue-900/40"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[180px] truncate">{reference.fileName || reference.docPath}</span>
                  <span className="text-[10px] text-blue-500 dark:text-blue-400">
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
          <span className="text-gray-500 dark:text-gray-400">
            {formatTime(message.created_at)}
          </span>

          {/* 情绪评分 */}
          {/* Emotion score display removed */}
        </div>
      </div>
    </div>
  )
} 
