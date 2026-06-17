'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { useToast } from '@/components/ui/use-toast'
import { KnowledgeOutputEditorDialog } from '@/components/tasks/KnowledgeOutputEditorDialog'
import { KnowledgeOutputPanel } from '@/components/tasks/KnowledgeOutputPanel'
import { TaskPhaseDetail } from '@/components/tasks/TaskPhaseDetail'
import { TaskProcessFormDialog } from '@/components/tasks/TaskProcessFormDialog'
import { useTaskProcessDetail } from '@/hooks/useTaskProcesses'
import type { KnowledgeOutput } from '@/types/taskProcess'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { DesktopAppFrame } from '@/components/layout/DesktopAppFrame'
import { TaskDetailWorkbench } from '@/components/tasks/TaskDetailWorkbench'

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>()
  const taskId = String(params?.id || '')
  const [editOpen, setEditOpen] = useState(false)
  const [editingOutput, setEditingOutput] = useState<KnowledgeOutput | null>(null)
  const { toast } = useToast()
  const { isDesktop } = useDesktopRuntime()
  const {
    task,
    evidence,
    outputs,
    loading,
    updateTask,
    createEvidence,
    createTimeLog,
    generateKnowledgeOutput,
    updateKnowledgeOutput,
    publishKnowledgeOutput,
    rollbackKnowledgeOutput,
  } = useTaskProcessDetail(taskId, Boolean(taskId))

  const pageShellProps = isDesktop
    ? { fullHeight: true, variant: 'desktop' as const, blur: 'none' as const, opacity: 0, contentClassName: 'h-full' }
    : { blur: 'lg' as const, opacity: 0.35, contentClassName: 'px-4 py-8 md:px-8' }

  return (
    <JustimePageShell {...pageShellProps}>
      <div className="mx-auto max-w-7xl h-full">
        {loading && !task ? (
          <div className={isDesktop ? "flex h-full items-center justify-center text-[#8b7aa8]" : "flex min-h-[240px] items-center justify-center text-white/60"}>
            <Loader2 className="mr-3 h-5 w-5 animate-spin text-violet-500" />
            加载任务详情中
          </div>
        ) : null}

        {task ? (
          <>
            {isDesktop ? (
              <DesktopAppFrame
                title={task.title}
                subtitle={`${task.phase.toUpperCase()} · ${task.status}`}
              >
                <TaskDetailWorkbench
                  task={task}
                  evidence={evidence}
                  outputs={outputs}
                  onEditTask={() => setEditOpen(true)}
                  onEditOutput={setEditingOutput}
                  onPublishOutput={async (outputId) => {
                    const result = await publishKnowledgeOutput(outputId)
                    toast({
                      title: result.success ? '已发布到 Vault' : '发布失败',
                      description: result.success ? '知识产出已写入 Vault。' : (result.error || '请稍后重试'),
                      ...(result.success ? {} : { variant: 'destructive' as const }),
                    })
                  }}
                  onCreateEvidence={async (payload) => {
                    const result = await createEvidence(payload)
                    toast({
                      title: result.success ? 'Evidence 已补写' : 'Evidence 写入失败',
                      description: result.success ? '任务证据已更新。' : (result.error || '请稍后重试'),
                      ...(result.success ? {} : { variant: 'destructive' as const }),
                    })
                    return { success: result.success, error: result.error }
                  }}
                  onCreateTimeLog={async (payload) => {
                    const result = await createTimeLog(payload)
                    toast({
                      title: result.success ? '时间日志已记录' : '记录时间失败',
                      description: result.success ? '任务投入时长已更新。' : (result.error || '请稍后重试'),
                      ...(result.success ? {} : { variant: 'destructive' as const }),
                    })
                    return { success: result.success, error: result.error }
                  }}
                  onGenerateKnowledge={async (payload) => {
                    const result = await generateKnowledgeOutput(payload)
                    toast({
                      title: result.success ? 'KnowledgeOutput 已生成' : '生成 KnowledgeOutput 失败',
                      description: result.success ? '可以继续编辑并发布到 Vault。' : (result.error || '请稍后重试'),
                      ...(result.success ? {} : { variant: 'destructive' as const }),
                    })
                    return { success: result.success, error: result.error }
                  }}
                />
              </DesktopAppFrame>
            ) : (
              <>
                <TaskPhaseDetail
                  task={task}
                  evidence={evidence}
                  outputs={outputs}
                  onEditTask={() => setEditOpen(true)}
                  onCreateEvidence={async (payload) => {
                    const result = await createEvidence(payload)
                    toast({
                      title: result.success ? 'Evidence 已补写' : 'Evidence 写入失败',
                      description: result.success ? '任务证据已更新。' : (result.error || '请稍后重试'),
                      ...(result.success ? {} : { variant: 'destructive' as const }),
                    })
                    return { success: result.success, error: result.error }
                  }}
                  onCreateTimeLog={async (payload) => {
                    const result = await createTimeLog(payload)
                    toast({
                      title: result.success ? '时间日志已记录' : '记录时间失败',
                      description: result.success ? '任务投入时长已更新。' : (result.error || '请稍后重试'),
                      ...(result.success ? {} : { variant: 'destructive' as const }),
                    })
                    return { success: result.success, error: result.error }
                  }}
                  onGenerateKnowledge={async (payload) => {
                    const result = await generateKnowledgeOutput(payload)
                    toast({
                      title: result.success ? 'KnowledgeOutput 已生成' : '生成 KnowledgeOutput 失败',
                      description: result.success ? '可以继续编辑并发布到 Vault。' : (result.error || '请稍后重试'),
                      ...(result.success ? {} : { variant: 'destructive' as const }),
                    })
                    return { success: result.success, error: result.error }
                  }}
                />
                <KnowledgeOutputPanel
                  outputs={outputs}
                  onEditOutput={setEditingOutput}
                  onPublishOutput={async (outputId) => {
                    const result = await publishKnowledgeOutput(outputId)
                    toast({
                      title: result.success ? '已发布到 Vault' : '发布失败',
                      description: result.success ? '知识产出已写入 Vault。' : (result.error || '请稍后重试'),
                      ...(result.success ? {} : { variant: 'destructive' as const }),
                    })
                  }}
                />
              </>
            )}

            <TaskProcessFormDialog
              open={editOpen}
              mode="edit"
              task={task}
              onOpenChange={setEditOpen}
              onSubmit={async (payload) => {
                const result = await updateTask(payload)
                toast({
                  title: result.success ? '任务已更新' : '任务更新失败',
                  description: result.success ? '任务主数据已保存。' : (result.error || '请稍后重试'),
                  ...(result.success ? {} : { variant: 'destructive' as const }),
                })
                return { success: result.success, error: result.error }
              }}
            />
            <KnowledgeOutputEditorDialog
              open={Boolean(editingOutput)}
              output={editingOutput}
              onOpenChange={(open) => {
                if (!open) setEditingOutput(null)
              }}
              onSave={async (outputId, payload) => {
                const result = await updateKnowledgeOutput(outputId, payload)
                toast({
                  title: result.success ? 'KnowledgeOutput 已保存' : '保存 KnowledgeOutput 失败',
                  description: result.success ? 'Markdown 修改已写入。' : (result.error || '请稍后重试'),
                  ...(result.success ? {} : { variant: 'destructive' as const }),
                })
                return { success: result.success, error: result.error }
              }}
              onPublish={async (outputId) => {
                const result = await publishKnowledgeOutput(outputId)
                toast({
                  title: result.success ? '已发布到 Vault' : '发布失败',
                  description: result.success ? '知识产出已写入 Vault。' : (result.error || '请稍后重试'),
                  ...(result.success ? {} : { variant: 'destructive' as const }),
                })
                return { success: result.success, error: result.error }
              }}
              onRollback={async (outputId, version) => {
                const result = await rollbackKnowledgeOutput(outputId, { version })
                toast({
                  title: result.success ? '已回滚到历史版本' : '回滚失败',
                  description: result.success ? '当前知识产出已恢复为历史版本草稿。' : (result.error || '请稍后重试'),
                  ...(result.success ? {} : { variant: 'destructive' as const }),
                })
                return { success: result.success, error: result.error }
              }}
            />
          </>
        ) : null}
      </div>
    </JustimePageShell>
  )
}
