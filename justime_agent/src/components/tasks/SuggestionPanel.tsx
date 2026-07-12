import { BellRing, BookOpen, CheckCheck, Lightbulb, ListChecks, Sparkles } from 'lucide-react'
import type { AISuggestion } from '@/types/taskProcess'

interface SuggestionPanelProps {
  suggestions: AISuggestion[]
}

const suggestionLabels: Record<AISuggestion['type'], string> = {
  next_step: '下一步',
  resource: '资源',
  review: '复盘',
  alert: '提醒',
  optimization: '优化',
}

const suggestionIcons: Record<AISuggestion['type'], typeof Lightbulb> = {
  next_step: ListChecks,
  resource: BookOpen,
  review: CheckCheck,
  alert: BellRing,
  optimization: Sparkles,
}

export function SuggestionPanel({ suggestions }: SuggestionPanelProps) {
  return (
    <section aria-labelledby="suggestion-panel-title" className="space-y-4">
      <div>
        <h3 id="suggestion-panel-title" className="text-sm font-semibold text-white">下一步建议</h3>
        <p className="mt-1 text-xs text-white/50">AI assessment 返回的只读建议</p>
      </div>

      {suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/10 p-4 text-sm text-white/50">
          当前没有下一步建议。
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => {
            const Icon = suggestionIcons[suggestion.type]

            return (
              <article key={suggestion.id} className="rounded-lg border border-white/10 bg-black/10 p-4">
                <div className="flex items-center gap-2 text-xs text-violet-100">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{suggestionLabels[suggestion.type]}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">{suggestion.content || '未提供建议内容'}</p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
