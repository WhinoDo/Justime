'use client'

import { Send, Bot, Brain } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ModelOption {
  id: string
  name: string
}

interface ChatInputAreaProps {
  input: string
  isLoading: boolean
  useWebSearch: boolean
  selectedModel?: string
  availableModels: ModelOption[]
  modelError?: string | null
  onInputChange: (value: string) => void
  onKeyPress: (e: React.KeyboardEvent) => void
  onSend: () => void
  onToggleWebSearch: () => void
  onModelChange: (modelId: string) => void
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

export function ChatInputArea({
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
  textareaRef
}: ChatInputAreaProps) {
  return (
    <div className="p-4 shrink-0 transition-all duration-300 relative">
      <div className="max-w-3xl mx-auto relative rounded-2xl bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 shadow-sm backdrop-blur-sm overflow-hidden transition-all duration-300 focus-within:ring-2 focus-within:ring-blue-500/20">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={`输入 "@" 唤起常用语，或粘贴代码快速提问`}
          className="w-full h-32 px-6 py-4 bg-transparent text-gray-800 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 text-base resize-none focus:outline-none overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent"
          disabled={isLoading}
        />

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-2">
            {/* 模型选择下拉框 */}
            <Select
              value={selectedModel}
              onValueChange={onModelChange}
            >
              <SelectTrigger className="h-8 border-0 bg-transparent shadow-none hover:bg-black/5 dark:hover:bg-white/5 data-[state=open]:bg-black/5 dark:data-[state=open]:bg-white/5 focus:ring-0 px-2 w-auto min-w-[120px]">
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <Bot className={modelError ? "w-4 h-4 text-red-500" : "w-4 h-4 text-blue-600 dark:text-blue-400"} />
                  <SelectValue placeholder={modelError ? "模型拉取失败" : "加载模型中..."} />
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

            {/* 分割线 */}
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

            {/* 深度思考 (Toggle) */}
            <button
              onClick={onToggleWebSearch}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${useWebSearch ? 'text-blue-600 bg-blue-500/10 dark:text-blue-400' : 'text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5'}`}
              title="启用深度思考"
            >
              <Brain className="w-4 h-4" />
              <span>深度思考</span>
            </button>
          </div>

          {/* 发送按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSend}
              disabled={isLoading || !input.trim()}
              className={`p-2 rounded-full transition-all duration-200 ${input.trim()
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 hover:scale-105'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="text-center mt-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          内容由 AI 生成，请仔细甄别
        </p>
      </div>
    </div>
  )
}
