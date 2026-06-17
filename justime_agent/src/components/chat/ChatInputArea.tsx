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
import { cn } from '@/lib/utils'

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
  /** UI density variant */
  density?: 'comfortable' | 'desktop'
  /** Placement configuration of RAG previews */
  previewPlacement?: 'floating' | 'inspector'
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
  density = 'comfortable',
  previewPlacement = 'floating',
}: ChatInputAreaProps) {
  const isDesktop = density === 'desktop'

  return (
    <>
      {/* Optional children (e.g., time helper) */}
      {children}

      {/* Main input area container */}
      <div className="relative shrink-0 p-4 transition-all duration-300 md:px-6 md:pb-6">
        {/* Floating RAG preview panel */}
        {previewPlacement === 'floating' && previewOpen && selectedReference && (
          <div className="absolute bottom-[calc(100%-1rem)] left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="h-[400px] overflow-hidden rounded-2xl border border-white/[0.15] bg-black/40 shadow-2xl backdrop-blur-2xl">
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
        <div className={cn(
          "relative mx-auto overflow-hidden transition-all duration-300",
          isDesktop
            ? "max-w-4xl rounded-2xl border border-violet-200/50 bg-white/[0.72] shadow-[0_24px_72px_rgba(112,77,171,0.14)] backdrop-blur-2xl focus-within:border-violet-400/[0.55] focus-within:bg-white/[0.82]"
            : "max-w-3xl rounded-3xl border border-white/10 dark:border-white/10 bg-white/5 dark:bg-black/20 shadow-lg shadow-black/10 backdrop-blur-xl focus-within:border-white/20 focus-within:bg-white/[0.08] dark:focus-within:bg-black/30 focus-within:ring-1 focus-within:ring-white/10"
        )}>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder={`输入 "@" 唤起常用语，或粘贴代码快速提问`}
            className={cn(
              "resize-none overflow-y-auto border-0 bg-transparent px-6 focus-visible:ring-0 focus-visible:ring-offset-0",
              isDesktop
                ? "text-[#171421] placeholder:text-[#8b7aa8] h-24 py-3 text-sm"
                : "text-white placeholder:text-white/[0.35] h-32 py-4 text-base"
            )}
            disabled={isLoading}
          />

          <div className={cn(
            "flex flex-col gap-3 border-t px-4 pb-4 pt-3 md:flex-row md:items-center md:justify-between",
            isDesktop ? "border-violet-200/40" : "border-white/10"
          )}>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedModel}
                onValueChange={onModelChange}
              >
                <SelectTrigger className={cn(
                  "h-9 min-w-[150px] rounded-xl shadow-none focus:ring-0 focus:outline-none",
                  isDesktop
                    ? "border border-violet-200/60 bg-white/60 text-[#171421] hover:bg-white/80"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                )}>
                  <div className={cn("flex items-center gap-1.5 text-xs", isDesktop ? "text-[#5a4c73]" : "text-white/75")}>
                    <Bot className={modelError ? 'h-4 w-4 text-red-500' : 'h-4 w-4 ' + (isDesktop ? 'text-violet-500' : 'text-blue-200')} />
                    <SelectValue placeholder={modelError ? '模型拉取失败' : '加载模型中...'} />
                  </div>
                </SelectTrigger>
                <SelectContent className={cn(
                  "bottom-full left-0 mb-1 origin-bottom shadow-2xl",
                  isDesktop
                    ? "border border-violet-200/50 bg-white/95 text-[#171421] backdrop-blur-2xl"
                    : "border border-white/10 bg-black/60 text-white backdrop-blur-xl"
                )}>
                  {availableModels.map((model) => (
                    <SelectItem
                      key={model.id}
                      value={model.id}
                      className={cn(
                        "text-xs rounded-lg py-1.5 px-3 transition-colors cursor-pointer",
                        isDesktop
                          ? "text-[#34303f] hover:bg-violet-50 focus:bg-violet-50 focus:text-violet-900"
                          : "text-white/80 hover:bg-white/10 focus:bg-white/10",
                        selectedModel === model.id
                          ? isDesktop
                            ? "bg-violet-100/70 text-violet-900 font-medium"
                            : "bg-white/[0.15] text-white"
                          : ""
                      )}
                    >
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
                className={cn(
                  "rounded-xl border px-3 transition-colors",
                  isDesktop
                    ? useWebSearch
                      ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                      : "border-violet-200/50 bg-white/60 text-[#5a4c73] hover:bg-white/80 hover:text-[#171421]"
                    : useWebSearch
                      ? "bg-white/[0.15] text-sky-100 border-white/10 hover:bg-white/20"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                )}
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
              className={cn(
                "rounded-xl px-4 transition-all duration-200",
                isDesktop
                  ? input.trim()
                    ? "bg-violet-600 text-white shadow-[0_12px_32px_rgba(126,87,194,0.28)] hover:bg-violet-500"
                    : "bg-violet-100 text-violet-300"
                  : input.trim()
                    ? "bg-white text-gray-900 hover:bg-white/90"
                    : "bg-white/10 text-white/[0.35] hover:bg-white/10"
              )}
            >
              {isLoading ? (
                <div className={cn(
                  "mr-2 h-4 w-4 animate-spin rounded-full border-2",
                  isDesktop
                    ? "border-violet-300 border-t-white"
                    : "border-gray-400/40 border-t-gray-900"
                )} />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              发送消息
            </Button>
          </div>
        </div>
        <div className="mt-2 text-center">
          <p className={cn("text-xs", isDesktop ? "text-[#8b7aa8]" : "text-white/40")}>
            内容由 AI 生成，请仔细甄别
          </p>
        </div>
      </div>
    </>
  )
})
