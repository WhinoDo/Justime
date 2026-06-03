'use client'

import { memo, ReactNode } from 'react'
import { Send, Bot, Brain } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { RagReference } from '@/types'
import { RagReferencePreviewPanel, RagPreviewTab, RagFullContentState } from './RagReferencePreviewPanel'

export interface ModelOption {
  id: string
  name: string
}

export interface ChatInputAreaProps {
  /** Current input text value */
  input: string
  /** Whether a message is being sent */
  isLoading: boolean
  /** Whether web search is enabled */
  useWebSearch: boolean
  /** Currently selected model ID */
  selectedModel?: string
  /** List of available models */
  availableModels: ModelOption[]
  /** Error message for model loading */
  modelError?: string | null
  /** Callback when input value changes */
  onInputChange: (value: string) => void
  /** Callback for keyboard events */
  onKeyPress: (e: React.KeyboardEvent) => void
  /** Callback when send button is clicked */
  onSend: () => void
  /** Callback when web search is toggled */
  onToggleWebSearch: () => void
  /** Callback when model selection changes */
  onModelChange: (modelId: string) => void
  /** Ref for the textarea element */
  textareaRef?: React.RefObject<HTMLTextAreaElement>
  /** RAG preview panel state */
  previewOpen?: boolean
  selectedReference?: RagReference | null
  activeTab?: RagPreviewTab
  fullContentState?: RagFullContentState
  isFullContentLoading?: boolean
  onPreviewClose?: () => void
  onTabChange?: (tab: RagPreviewTab) => void
  /** Optional children to render above the input (e.g., time helper) */
  children?: ReactNode
}

export const ChatInputArea = memo(function ChatInputArea({
  input,
  isLoading,
  useWebSearch,
  selectedModel,
  availableModels,
  modelError,
  onInputChange,
  onKeyPress,
  onSend,
  onToggleWebSearch,
  onModelChange,
  textareaRef,
  previewOpen = false,
  selectedReference,
  activeTab = 'snippets',
  fullContentState,
  isFullContentLoading = false,
  onPreviewClose,
  onTabChange,
  children,
}: ChatInputAreaProps) {
  return (
    <>
      {/* Optional children (e.g., time helper) */}
      {children}

      {/* Main input area container */}
      <div className="relative shrink-0 p-4 transition-all duration-300 md:px-6 md:pb-6">
        {/* Floating RAG preview panel */}
        {previewOpen && selectedReference && (
          <div className="absolute bottom-[calc(100%-1rem)] left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="h-[400px] overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-2xl backdrop-blur-2xl">
              <RagReferencePreviewPanel
                open={previewOpen}
                reference={selectedReference}
                activeTab={activeTab}
                onTabChange={onTabChange || (() => {})}
                fullContentState={fullContentState}
                isFullContentLoading={isFullContentLoading}
                onClose={onPreviewClose}
                className="h-full border-none bg-transparent"
              />
            </div>
          </div>
        )}

        {/* Input container with glassmorphism */}
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-white/15 bg-white/10 shadow-2xl shadow-black/15 backdrop-blur-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-white/20">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder={`输入 "@" 唤起常用语，或粘贴代码快速提问`}
            className="h-32 resize-none overflow-y-auto border-0 bg-transparent px-6 py-4 text-base text-white placeholder:text-white/45 focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isLoading}
          />

          <div className="flex flex-col gap-3 border-t border-white/10 px-4 pb-4 pt-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedModel}
                onValueChange={onModelChange}
              >
                <SelectTrigger className="h-9 min-w-[150px] rounded-xl border-white/10 bg-white/5 px-3 text-white shadow-none hover:bg-white/10 focus:ring-0">
                  <div className="flex items-center gap-1.5 text-xs text-white/75">
                    <Bot className={modelError ? 'h-4 w-4 text-red-300' : 'h-4 w-4 text-blue-200'} />
                    <SelectValue placeholder={modelError ? '模型拉取失败' : '加载模型中...'} />
                  </div>
                </SelectTrigger>
                <SelectContent className="bottom-full left-0 mb-1 origin-bottom">
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="text-xs">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onToggleWebSearch}
                className={`rounded-xl border border-white/10 px-3 ${useWebSearch ? 'bg-white/15 text-sky-100 hover:bg-white/20' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                title="启用深度思考"
              >
                <Brain className="mr-1.5 h-4 w-4" />
                <span>深度思考</span>
              </Button>
            </div>

            <Button
              type="button"
              onClick={onSend}
              disabled={isLoading || !input.trim()}
              className={`rounded-xl px-4 ${input.trim()
                ? 'bg-white text-gray-900 hover:bg-white/90'
                : 'bg-white/10 text-white/35 hover:bg-white/10'}`}
            >
              {isLoading ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-400/40 border-t-gray-900" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              发送消息
            </Button>
          </div>
        </div>
        <div className="mt-2 text-center">
          <p className="text-xs text-white/40">
            内容由 AI 生成，请仔细甄别
          </p>
        </div>
      </div>
    </>
  )
})
