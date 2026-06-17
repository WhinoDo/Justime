'use client'

import { BookOpenCheck, Pencil, Upload } from 'lucide-react'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { Button } from '@/components/ui/button'
import type { KnowledgeOutput } from '@/types/taskProcess'

interface KnowledgeOutputPanelProps {
  outputs: KnowledgeOutput[]
  onEditOutput: (output: KnowledgeOutput) => void
  onPublishOutput: (outputId: string) => Promise<void>
}

export function KnowledgeOutputPanel({ outputs, onEditOutput, onPublishOutput }: KnowledgeOutputPanelProps) {
  return (
    <JustimeGlassPanel className="rounded-[32px] p-6">
      <div className="mb-4 flex items-center gap-2">
        <BookOpenCheck className="h-4 w-4 text-emerald-200" />
        <div>
          <h2 className="text-lg font-semibold text-white">Knowledge Outputs</h2>
          <p className="text-sm text-white/[0.55]">独立管理知识产出，避免 After 卡片继续堆叠操作。</p>
        </div>
      </div>
      {outputs.length === 0 ? (
        <div className="rounded-3xl bg-black/10 p-4 text-sm text-white/50">还没有知识产出。</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {outputs.map((output) => (
            <div key={output.id} className="rounded-3xl border border-white/10 bg-black/10 p-4">
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-white/[0.45]">
                <span>{output.format}</span>
                <span>{output.status}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-white">{output.title}</p>
              <p className="mt-2 line-clamp-5 text-sm text-white/[0.55]">{output.markdown}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-white/40">
                <span>v{output.version}</span>
                <span>{output.vault_relative_path}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="ghost" className="h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-white/80 hover:bg-white/10 hover:text-white" onClick={() => onEditOutput(output)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  编辑
                </Button>
                <Button type="button" variant="ghost" className="h-9 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-3 text-xs text-emerald-100 hover:bg-emerald-300/20" onClick={() => onPublishOutput(output.id)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  发布
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </JustimeGlassPanel>
  )
}
