'use client'

import { FileText, Layers3, Bot } from 'lucide-react'
import type { RagReference } from '@/types'
import { cn } from '@/lib/utils'
import {
  RagReferencePreviewPanel,
  RagFullContentState,
  RagPreviewTab,
} from './RagReferencePreviewPanel'

interface ChatContextInspectorProps {
  currentTaskLabel?: string | null
  selectedModel?: string
  selectedReference?: RagReference | null
  previewOpen?: boolean
  activeTab?: RagPreviewTab
  fullContentState?: RagFullContentState
  isFullContentLoading?: boolean
  onPreviewClose?: () => void
  onTabChange?: (tab: RagPreviewTab) => void
  className?: string
}

export function ChatContextInspector({
  currentTaskLabel,
  selectedModel,
  selectedReference,
  previewOpen = false,
  activeTab = 'snippets',
  fullContentState,
  isFullContentLoading = false,
  onPreviewClose,
  onTabChange,
  className,
}: ChatContextInspectorProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(244,237,255,0.78))] text-[#171421] backdrop-blur-2xl', className)}>
      <div className="border-b border-violet-200/40 px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">
          Context
        </div>
        <h2 className="mt-1 text-sm font-semibold text-[#171421]">上下文检查器</h2>
      </div>

      <div className="desktop-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <section className="rounded-xl border border-violet-200/[0.45] bg-white/[0.68] p-3 shadow-[0_16px_48px_rgba(112,77,171,0.10)] backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-[#5a4c73]">
              <Layers3 className="h-3.5 w-3.5 text-violet-500" />
              当前任务
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-[#171421]">
              {currentTaskLabel || '未绑定 TaskProcess'}
            </p>
          </section>

          <section className="rounded-xl border border-violet-200/[0.45] bg-white/[0.62] p-3 shadow-[0_16px_48px_rgba(112,77,171,0.08)] backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-[#5a4c73]">
              <Bot className="h-3.5 w-3.5 text-sky-500" />
              模型
            </div>
            <p className="mt-2 truncate text-sm text-[#171421]">
              {selectedModel || '未配置模型'}
            </p>
          </section>

          {previewOpen && selectedReference ? (
            <section className="overflow-hidden rounded-xl border border-violet-200/[0.45] bg-white/[0.68] shadow-[0_18px_60px_rgba(112,77,171,0.12)] backdrop-blur-2xl">
              <RagReferencePreviewPanel
                open={previewOpen}
                reference={selectedReference}
                activeTab={activeTab}
                onTabChange={onTabChange || (() => {})}
                fullContentState={fullContentState}
                isFullContentLoading={isFullContentLoading}
                onClose={onPreviewClose}
                className="h-[520px] border-none bg-transparent"
              />
            </section>
          ) : (
            <section className="rounded-xl border border-dashed border-violet-200/60 bg-white/50 p-4 text-sm text-[#6d6680] backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#5a4c73]">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                引用预览
              </div>
              点击回答中的 RAG 引用后，会在这里检查来源片段和全文。
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
