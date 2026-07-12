import React from 'react'
import { render, screen } from '@testing-library/react'
import { TaskPhaseDetail } from '../TaskPhaseDetail'
import type { Evidence, KnowledgeOutput, TaskProcess } from '@/types/taskProcess'

const task: TaskProcess = {
  id: 'task-1',
  userId: 'user-1',
  title: '上线 During 工作区',
  description: '验证执行阶段详情',
  goal: '保留 Before 并补齐 During',
  category: 'development',
  tags: ['frontend'],
  status: 'active',
  phase: 'during',
  priority: 'high',
  progress: 50,
  progress_source: 'evidence',
  actual_hours: 3,
  materials: [],
  preparation_items: [],
  milestones: [],
  blockers: [
    {
      id: 'blocker-1',
      description: '等待测试环境恢复',
      severity: 'high',
      resolved: false,
      created_at: '2026-07-13T08:00:00.000Z',
    },
  ],
  ai_suggestions: [
    {
      id: 'suggestion-1',
      type: 'next_step',
      content: '先运行 focused tests',
      created_at: '2026-07-13T09:00:00.000Z',
    },
  ],
  ai_plan: { summary: '先确认准备项，再进入执行。' },
  related_chat_session_ids: [],
  related_calendar_event_ids: [],
  evidence_count: 1,
  knowledge_output_count: 0,
}

const evidence: Evidence[] = [
  {
    id: 'evidence-1',
    task_id: 'task-1',
    userId: 'user-1',
    type: 'note',
    title: 'Focused tests passed',
    content: 'During integration is covered.',
    source: 'manual',
    ai_extracted: false,
    confidence: 1,
    createdAt: '2026-07-13T10:00:00.000Z',
  },
]

const defaultProps = {
  task,
  evidence,
  outputs: [] as KnowledgeOutput[],
  onEditTask: jest.fn(),
  onCreateEvidence: jest.fn(),
  onCreateTimeLog: jest.fn(),
  onGenerateKnowledge: jest.fn(),
  onUpdatePreparationItems: jest.fn().mockResolvedValue({ success: true }),
}

describe('TaskPhaseDetail', () => {
  it('composes the evidence timeline, blocker diagnosis, and next-step suggestions in During', () => {
    render(<TaskPhaseDetail {...defaultProps} />)

    expect(screen.getByRole('heading', { name: 'Evidence 时间线' })).toBeInTheDocument()
    expect(screen.getByText('Focused tests passed')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '阻塞诊断' })).toBeInTheDocument()
    expect(screen.getByText('等待测试环境恢复')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '下一步建议' })).toBeInTheDocument()
    expect(screen.getByText('先运行 focused tests')).toBeInTheDocument()
  })

  it.each([
    ['before', '先确认准备项，再进入执行。'],
    ['after', '已生成 2 份知识产出'],
  ] as const)('preserves the existing %s phase content', (phase, expectedContent) => {
    render(
      <TaskPhaseDetail
        {...defaultProps}
        task={{ ...task, phase, knowledge_output_count: phase === 'after' ? 2 : 0 }}
        outputs={phase === 'after' ? [{ id: 'output-1' }, { id: 'output-2' }] as KnowledgeOutput[] : []}
      />,
    )

    expect(screen.getByText(expectedContent)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Before' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'After' })).toBeInTheDocument()
  })
})
