'use client'

import Link from 'next/link'
import { ArrowRight, BookOpenCheck, Clock3, FileText, MessageSquareMore, Pencil, Sparkles } from 'lucide-react'
import type { Evidence, KnowledgeOutput, PreparationItem, TaskProcess } from '@/types/taskProcess'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TaskDetailActions, type TaskDetailActionsProps } from './TaskDetailActions'
import { BeforeWorkspace } from './BeforeWorkspace'
import { EvidenceTimeline } from './EvidenceTimeline'
import { BlockerPanel } from './BlockerPanel'
import { SuggestionPanel } from './SuggestionPanel'

interface TaskPhaseDetailProps {
  task: TaskProcess
  evidence: Evidence[]
  outputs: KnowledgeOutput[]
  onEditTask: () => void
  onCreateEvidence: TaskDetailActionsProps['onCreateEvidence']
  onCreateTimeLog: TaskDetailActionsProps['onCreateTimeLog']
  onGenerateKnowledge: TaskDetailActionsProps['onGenerateKnowledge']
  onUpdatePreparationItems: (items: PreparationItem[]) => Promise<{ success: boolean; error?: string }>
}

export function TaskPhaseDetail({
  task,
  evidence,
  outputs,
  onEditTask,
  onCreateEvidence,
  onCreateTimeLog,
  onGenerateKnowledge,
  onUpdatePreparationItems,
}: TaskPhaseDetailProps) {
  return (
    <div className="space-y-6">
      <JustimeGlassPanel className="rounded-[32px] p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-white/60">
              <Sparkles className="h-4 w-4 text-amber-200" />
              <span className="text-xs uppercase tracking-[0.28em]">Task Detail</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-white">{task.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">{task.goal}</p>
          </div>
          <Link
            href={`/chat?taskId=${encodeURIComponent(task.id)}&taskTitle=${encodeURIComponent(task.title)}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.15] bg-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.15] hover:text-white"
          >
            打开任务对话
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="ghost" className="rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white" onClick={onEditTask}>
            <Pencil className="mr-2 h-4 w-4" />
            编辑任务
          </Button>
        </div>
      </JustimeGlassPanel>

      <TaskDetailActions
        taskId={task.id}
        onCreateEvidence={onCreateEvidence}
        onCreateTimeLog={onCreateTimeLog}
        onGenerateKnowledge={onGenerateKnowledge}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
        {[
          {
            key: 'before',
            title: 'Before',
            subtitle: '目标、里程碑与前置准备',
            active: task.phase === 'before',
            content: (
              <BeforeWorkspace task={task} onUpdatePreparationItems={onUpdatePreparationItems} />
            ),
          },
          {
            key: 'during',
            title: 'During',
            subtitle: 'Evidence、执行与阻塞',
            active: task.phase === 'during',
            content: (
              <div className="space-y-6">
                <EvidenceTimeline evidence={evidence} />
                <BlockerPanel blockers={task.blockers} />
                <SuggestionPanel suggestions={task.ai_suggestions} />
              </div>
            ),
          },
          {
            key: 'after',
            title: 'After',
            subtitle: '沉淀策略与输出准备',
            active: task.phase === 'after',
            content: (
              <div className="space-y-3">
                <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                  <p className="text-sm font-medium text-white">已生成 {outputs.length} 份知识产出</p>
                  <p className="mt-2 text-sm text-white/[0.55]">
                    产出编辑、版本回滚和 Vault 发布已移到下方独立面板，避免阶段卡片继续承载过多操作。
                  </p>
                </div>
              </div>
            ),
          },
        ].map((panel) => (
          <JustimeGlassPanel key={panel.key} className={cn('rounded-[32px] p-6 transition', panel.active ? 'border-white/25 bg-white/[0.12]' : 'bg-white/[0.08]')}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">{panel.title}</h2>
              <p className="text-sm text-white/[0.55]">{panel.subtitle}</p>
            </div>
            {panel.content}
          </JustimeGlassPanel>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Clock3, label: 'Actual Hours', value: `${task.actual_hours}h` },
          { icon: FileText, label: 'Evidence', value: String(task.evidence_count) },
          { icon: BookOpenCheck, label: 'Outputs', value: String(task.knowledge_output_count) },
          { icon: MessageSquareMore, label: 'Chat Sessions', value: String(task.related_chat_session_ids.length) },
        ].map((item) => (
          <JustimeGlassPanel key={item.label} className="rounded-[28px] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
              </div>
              <item.icon className="h-5 w-5 text-white/[0.65]" />
            </div>
          </JustimeGlassPanel>
        ))}
      </div>
    </div>
  )
}
