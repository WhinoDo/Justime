'use client'

import { useState, useEffect, useRef, useMemo, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import { Copy, Check, Bot, Brain, FileText } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Message, RagReference } from '@/types'
import { formatTime } from '@/lib/utils'

interface TypewriterMessageProps {
  content: string
  isStreaming?: boolean
  speed?: number // 毫秒/字符
  instant?: boolean // 是否跳过动画
  onContentChange?: (displayedContent: string) => void
  message?: Message // 完整消息对象，用于显示元数据
  onReferenceClick?: (reference: RagReference) => void
}

// 格式化任务类型
const formatTaskType = (taskType?: string) => {
  if (taskType === 'recitation') return '背诵任务'
  if (taskType === 'thinking') return '思考任务'
  return '通用任务'
}

// 格式化紧急程度
const formatUrgency = (urgency?: string) => {
  if (urgency === 'high') return '高紧急'
  if (urgency === 'low') return '低紧急'
  return '中紧急'
}

const TypewriterMessageInner = ({
  content,
  isStreaming = false,
  speed = 15,
  instant = false,
  onContentChange,
  message,
  onReferenceClick,
}: TypewriterMessageProps) => {
  const [displayedContent, setDisplayedContent] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const indexRef = useRef(0)
  const contentRef = useRef('')
  const { theme } = useTheme()

  // 同步 content 引用
  useEffect(() => {
    contentRef.current = content
  }, [content])

  // 打字机效果
  useEffect(() => {
    if (instant || !isStreaming) {
      setDisplayedContent(content)
      return
    }

    // 重置到当前内容
    if (displayedContent.length > content.length) {
      setDisplayedContent(content)
      indexRef.current = content.length
      return
    }

    // 如果显示内容已追上实际内容，停止
    if (displayedContent.length >= content.length) {
      return
    }

    const interval = setInterval(() => {
      if (indexRef.current < contentRef.current.length) {
        indexRef.current++
        const newContent = contentRef.current.slice(0, indexRef.current)
        setDisplayedContent(newContent)
        onContentChange?.(newContent)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [content, isStreaming, instant, speed])

  // 光标闪烁
  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false)
      return
    }

    const interval = setInterval(() => {
      setCursorVisible(prev => !prev)
    }, 530)

    return () => clearInterval(interval)
  }, [isStreaming])

  // 复制代码
  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // 自定义 Markdown 组件
  const components = useMemo(() => ({
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : ''
      const codeString = String(children).replace(/\n$/, '')

      if (!inline && language) {
        return (
          <div className="relative group/code">
            <div className="flex items-center justify-between bg-gray-800 text-gray-200 px-4 py-2 text-xs rounded-t-lg">
              <span className="font-medium">{language}</span>
              <button
                onClick={() => copyCode(codeString)}
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
              customStyle={{
                margin: 0,
                borderRadius: '0 0 0.5rem 0.5rem',
                fontSize: '0.875rem',
              }}
              {...props}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        )
      }

      return (
        <code
          className="px-1.5 py-0.5 rounded text-sm font-mono bg-muted/50 text-foreground/90"
          {...props}
        >
          {children}
        </code>
      )
    },
    p: ({ children }: any) => (
      <p className="mb-3 last:mb-0">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="ml-2">{children}</li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-border pl-4 py-2 my-2 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold mb-3">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg font-bold mb-2">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-bold mb-2">{children}</h3>
    ),
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
        {children}
      </a>
    ),
  }), [copiedCode, theme])

  // 提取消息元数据
  const taskAnalysis = message?.taskAnalysis
  const timingStrategy = message?.timingStrategy
  const ragReferences = message?.ragReferences
  const hasMetadata = (taskAnalysis?.taskType !== 'general' && timingStrategy?.taskType !== 'general') && (taskAnalysis || timingStrategy)

  return (
    <div className="group flex gap-3 max-w-[85%] mr-auto animate-in slide-in-from-bottom-1 duration-300">
      {/* AI 头像 */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-emerald-500 dark:text-emerald-100 shadow-md">
        <Bot size={16} />
      </div>

      {/* 消息内容 */}
      <div className="flex flex-col gap-2 min-w-0 flex-1 items-start">
        {/* 消息气泡 */}
        <div className="relative max-w-full rounded-2xl rounded-bl-md border border-border bg-muted/50 px-4 py-3 text-foreground/90 shadow-sm transition-all duration-200 hover:shadow-md">
          {/* 任务分析元数据 */}
          {hasMetadata && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-border pb-2 text-[10px] md:text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 font-medium text-foreground/80">
                <Brain className="w-3 h-3" />
                {formatTaskType(taskAnalysis?.taskType || timingStrategy?.taskType)}
              </span>
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-medium text-foreground/75">
                难度 {taskAnalysis?.difficultyLevel || timingStrategy?.difficultyLevel || 3}
              </span>
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-medium text-foreground/75">
                {formatUrgency(taskAnalysis?.urgency || timingStrategy?.urgency)}
              </span>
              {typeof taskAnalysis?.confidence === 'number' && (
                <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-medium text-foreground/75">
                  {Math.round(taskAnalysis.confidence * 100)}%
                </span>
              )}
            </div>
          )}

          {/* Markdown 渲染 */}
          <div className="prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/85 prose-strong:text-foreground prose-em:text-foreground/85">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {displayedContent || ''}
            </ReactMarkdown>
            {/* 流式光标 */}
            {isStreaming && cursorVisible && (
              <span className="inline-block w-2 h-4 bg-emerald-300 ml-0.5 align-middle" />
            )}
          </div>
        </div>

        {/* RAG 引用 */}
        {ragReferences && ragReferences.length > 0 && (
          <div className="w-fit max-w-[100%] rounded-xl border border-border bg-muted/50 p-3 backdrop-blur-sm">
            <div className="mb-2 text-xs font-medium text-foreground/80">
              引用文档
            </div>
            <div className="flex flex-wrap gap-2">
              {ragReferences.map((reference) => (
                <button
                  key={reference.referenceId}
                  type="button"
                  onClick={() => onReferenceClick?.(reference)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-accent/50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[180px] truncate">{reference.fileName || reference.docPath}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {reference.snippets?.length || 0} 段
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 时间戳 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
          {message?.created_at ? formatTime(message.created_at) : '生成中...'}
        </div>
      </div>
    </div>
  )
}

// 自定义比较函数：避免 token 更新触发不必要的重渲染
// 只在关键 props 变化时才重新渲染
const arePropsEqual = (prevProps: TypewriterMessageProps, nextProps: TypewriterMessageProps) => {
  // streaming 状态变化时必须更新
  if (prevProps.isStreaming !== nextProps.isStreaming) return false

  // instant 模式变化时必须更新
  if (prevProps.instant !== nextProps.instant) return false

  // 非流式状态下，比较完整内容
  if (!nextProps.isStreaming) {
    return prevProps.content === nextProps.content
  }

  // 流式状态下，允许每次 content 更新（打字机效果）
  // 但避免其他无关 props 变化触发重渲染
  if (prevProps.content !== nextProps.content) return false

  // 检查 message 的关键属性
  const prevMsg = prevProps.message
  const nextMsg = nextProps.message
  if (prevMsg !== nextMsg) {
    // 如果 message 引用相同，不需要更新
    if (prevMsg && nextMsg) {
      // 检查关键属性是否变化
      if (
        prevMsg.created_at !== nextMsg.created_at ||
        prevMsg.taskAnalysis !== nextMsg.taskAnalysis ||
        prevMsg.timingStrategy !== nextMsg.timingStrategy ||
        prevMsg.ragReferences !== nextMsg.ragReferences
      ) {
        return false
      }
    }
  }

  // 其他情况认为 props 相等，跳过重渲染
  return true
}

export const TypewriterMessage = memo(TypewriterMessageInner, arePropsEqual)

export default TypewriterMessage
