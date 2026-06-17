'use client'

import Link from 'next/link'
import { ArrowRight, BookOpenCheck, Clock3, FileText, MessageSquareMore, Pencil, Upload } from 'lucide-react'
import type { Evidence, KnowledgeOutput, TaskProcess } from '@/types/taskProcess'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TaskDetailActions, type TaskDetailActionsProps } from './TaskDetailActions'

interface TaskDetailWorkbenchProps {
  task: TaskProcess
  evidence: Evidence[]
  outputs: KnowledgeOutput[]
  onEditTask: () => void
  onEditOutput: (output: KnowledgeOutput) => void
  onPublishOutput: (outputId: string) => Promise<void>
  onCreateEvidence: TaskDetailActionsProps['onCreateEvidence']
  onCreateTimeLog: TaskDetailActionsProps['onCreateTimeLog']
  onGenerateKnowledge: TaskDetailActionsProps['onGenerateKnowledge']
}

const phases = [
  { key: 'before', label: 'Before', description: '规划和前置准备' },
  { key: 'during', label: 'During', description: '执行、证据和阻塞' },
  { key: 'after', label: 'After', description: '总结、发布和复盘' },
] as const

export function TaskDetailWorkbench({
  task,
  evidence,
  outputs,
  onEditTask,
  onEditOutput,
  onPublishOutput,
  onCreateEvidence,
  onCreateTimeLog,
  onGenerateKnowledge,
}: TaskDetailWorkbenchProps) {
  const activePhase = phases.find((phase) => phase.key === task.phase)

  return (
    <div data-testid="task-detail-workbench" className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)_360px] bg-transparent text-[#171421]">
      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-r border-violet-200/40 bg-white/50 p-4 backdrop-blur-2xl">
        <div className="mb-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Task Detail</div>
          <h1 className="mt-1 line-clamp-3 text-lg font-semibold text-[#171421]">{task.title}</h1>
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#6d6680]">{task.goal}</p>
        </div>

        <div className="space-y-2">
          {phases.map((phase) => {
            const active = phase.key === task.phase
            return (
              <div
                key={phase.key}
                className={cn(
                  'rounded-xl border p-3 backdrop-blur-xl',
                  active
                    ? 'border-violet-300/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(238,231,255,0.78))] shadow-[0_16px_48px_rgba(112,77,171,0.14)]'
                    : 'border-violet-200/40 bg-white/[0.52]',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#171421]">{phase.label}</span>
                  {active ? <span className="text-[10px] uppercase tracking-[0.16em] text-violet-600">Active</span> : null}
                </div>
                <p className="mt-1 text-xs text-[#8b7aa8]">{phase.description}</p>
              </div>
            )
          })}
        </div>
      </aside>

      <main className="desktop-scrollbar min-h-0 overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">{activePhase?.label}</div>
            <h2 className="mt-1 text-xl font-semibold text-[#171421]">{activePhase?.description}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="h-8 rounded-lg border border-violet-200/50 bg-white/[0.64] px-3 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/[0.84] hover:text-[#171421]" onClick={onEditTask}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              编辑
            </Button>
            <Link href={`/chat?taskId=${encodeURIComponent(task.id)}&taskTitle=${encodeURIComponent(task.title)}`}>
              <Button type="button" variant="ghost" className="h-8 rounded-lg border border-violet-200/50 bg-white/[0.64] px-3 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/[0.84] hover:text-[#171421]">
                打开任务对话
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <section className="rounded-2xl border border-violet-200/40 bg-white/[0.78] p-4 shadow-[0_24px_80px_rgba(112,77,171,0.10)] backdrop-blur-2xl">
          <TaskDetailActions
            taskId={task.id}
            onCreateEvidence={onCreateEvidence}
            onCreateTimeLog={onCreateTimeLog}
            onGenerateKnowledge={onGenerateKnowledge}
          />
        </section>
      </main>

      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-l border-violet-200/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(244,237,255,0.78))] p-4 backdrop-blur-2xl">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Inspector</div>
        <div className="grid gap-2">
          {[
            { icon: Clock3, label: 'Actual Hours', value: `${task.actual_hours}h` },
            { icon: FileText, label: 'Evidence', value: String(task.evidence_count) },
            { icon: BookOpenCheck, label: 'Outputs', value: String(task.knowledge_output_count) },
            { icon: MessageSquareMore, label: 'Chat Sessions', value: String(task.related_chat_session_ids?.length || 0) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-violet-200/[0.45] bg-white/[0.64] p-3 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between text-xs text-[#8b7aa8]">
                <span>{item.label}</span>
                <item.icon className="h-3.5 w-3.5" />
              </div>
              <div className="mt-2 text-lg font-semibold text-[#171421]">{item.value}</div>
            </div>
          ))}
        </div>

        <section className="mt-4 rounded-xl border border-violet-200/[0.45] bg-white/[0.62] p-3 shadow-sm backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-[#171421]">Recent Evidence</h3>
          <div className="mt-3 space-y-2">
            {evidence.length === 0 ? (
              <p className="text-sm text-[#6d6680]">还没有 Evidence。</p>
            ) : evidence.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg border border-violet-200/40 bg-white/[0.64] p-2">
                <p className="truncate text-sm text-[#171421]">{item.title || '未命名 Evidence'}</p>
                <p className="mt-1 line-clamp-2 text-xs text-[#6d6680]">{item.content}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-violet-200/[0.45] bg-[linear-gradient(135deg,rgba(255,255,255,0.70),rgba(238,231,255,0.70))] p-3 shadow-sm backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-[#171421]">Knowledge Outputs</h3>
          <div className="mt-3 space-y-2">
            {outputs.length === 0 ? (
              <p className="text-sm text-[#6d6680]">还没有知识产出。</p>
            ) : outputs.slice(0, 5).map((output) => (
              <div key={output.id} className="rounded-lg border border-violet-200/40 bg-white/[0.64] p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#171421]">{output.title}</p>
                    <p className="mt-1 text-xs text-[#8b7aa8]">{output.status} · v{output.version}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-violet-200/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#8b7aa8]">
                    {output.format}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" className="h-7 rounded-lg border border-violet-200/50 bg-white/[0.64] px-2 text-xs text-[#5a4c73] hover:bg-white/[0.84] hover:text-[#171421]" onClick={() => onEditOutput(output)}>
                    <Pencil className="mr-1 h-3 w-3" />
                    编辑
                  </Button>
                  <Button type="button" variant="ghost" className="h-7 rounded-lg border border-emerald-200/30 bg-emerald-50/50 px-2 text-xs text-emerald-700 hover:bg-emerald-100/80" onClick={() => { void onPublishOutput(output.id) }}>
                    <Upload className="mr-1 h-3 w-3" />
                    发布
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}
