'use client'

import { RagReference } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, FileText, Loader2, Search, X } from 'lucide-react'

export type RagPreviewTab = 'snippets' | 'full'

export interface RagFullContentState {
  content: string
  truncated: boolean
  charCount: number
  maxChars: number
  error?: string
}

interface RagReferencePreviewPanelProps {
  open: boolean
  reference: RagReference | null
  activeTab: RagPreviewTab
  onTabChange: (tab: RagPreviewTab) => void
  fullContentState?: RagFullContentState
  isFullContentLoading: boolean
  onClose?: () => void
  className?: string
}

export function RagReferencePreviewPanel({
  open,
  reference,
  activeTab,
  onTabChange,
  fullContentState,
  isFullContentLoading,
  onClose,
  className,
}: RagReferencePreviewPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl',
        'animate-in fade-in slide-in-from-right-3 duration-200 motion-reduce:animate-none',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-gray-700 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">RAG 引用预览</p>
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {reference?.fileName || '未选择文档'}
          </h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!reference ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500 dark:text-gray-400">
          点击回答下方的“引用文档”以在这里查看片段和全文。
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => onTabChange(value as RagPreviewTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="snippets" className="text-xs">引用片段</TabsTrigger>
              <TabsTrigger value="full" className="text-xs">全文预览</TabsTrigger>
            </TabsList>

            <TabsContent value="snippets" className="mt-3 min-h-0 flex-1 overflow-auto">
              <div className="space-y-3">
                {reference.queries.length > 0 && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                    <div className="mb-1 flex items-center gap-1">
                      <Search className="h-3.5 w-3.5" />
                      <span className="font-medium">检索问题</span>
                    </div>
                    <div className="space-y-1">
                      {reference.queries.map((query, index) => (
                        <div key={`${reference.referenceId}-query-${index}`}>{query}</div>
                      ))}
                    </div>
                  </div>
                )}

                {reference.snippets.length > 0 ? (
                  reference.snippets.map((snippet, index) => (
                    <div
                      key={`${reference.referenceId}-snippet-${index}`}
                      className="rounded-md border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    >
                      <div className="mb-1 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <FileText className="h-3.5 w-3.5" />
                        片段 {index + 1}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{snippet}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    没有可展示的引用片段。
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="full" className="mt-3 min-h-0 flex-1 overflow-auto">
              {isFullContentLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载全文...
                </div>
              ) : fullContentState?.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  <div className="mb-1 flex items-center gap-1 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    文档预览失败
                  </div>
                  {fullContentState.error}
                </div>
              ) : (
                <div className="space-y-2">
                  {fullContentState?.truncated && (
                    <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300">
                      内容过长，当前仅显示前 {fullContentState.maxChars} 字符（原文 {fullContentState.charCount} 字符）。
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {fullContentState?.content || '暂无全文内容。'}
                  </pre>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
