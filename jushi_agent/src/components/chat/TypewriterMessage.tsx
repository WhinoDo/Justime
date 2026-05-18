'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'

interface TypewriterMessageProps {
  content: string
  isStreaming?: boolean
  speed?: number // 毫秒/字符
  instant?: boolean // 是否跳过动画
  onContentChange?: (displayedContent: string) => void
}

export function TypewriterMessage({
  content,
  isStreaming = false,
  speed = 15,
  instant = false,
  onContentChange,
}: TypewriterMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const indexRef = useRef(0)
  const contentRef = useRef('')

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

  // 自定义组件
  const components = useMemo(() => ({
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : ''
      const codeString = String(children).replace(/\n$/, '')

      if (!inline && language) {
        return (
          <div className="relative group">
            <button
              onClick={() => copyCode(codeString)}
              className="absolute right-2 top-2 p-1.5 rounded-md bg-gray-700/50 hover:bg-gray-600/50 transition-colors opacity-0 group-hover:opacity-100"
              title="复制代码"
            >
              {copiedCode === codeString ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-300" />
              )}
            </button>
            <SyntaxHighlighter
              style={oneDark}
              language={language}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: '0.5rem',
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
          className={`${className || ''} bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm`}
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
      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400">
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
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
        {children}
      </a>
    ),
  }), [copiedCode])

  return (
    <div className="typewriter-message">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown components={components}>
          {displayedContent || ''}
        </ReactMarkdown>
      </div>
      {isStreaming && cursorVisible && (
        <span className="inline-block w-2 h-4 bg-current animate-pulse ml-0.5" />
      )}
    </div>
  )
}
