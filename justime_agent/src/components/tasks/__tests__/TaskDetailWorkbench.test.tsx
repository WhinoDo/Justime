import React from 'react'
import { render, screen } from '@testing-library/react'
import { TaskDetailWorkbench } from '../TaskDetailWorkbench'
import type { Evidence, KnowledgeOutput, TaskProcess } from '@/types/taskProcess'

const task: TaskProcess = {
  id: 'task-1',
  userId: 'user-1',
  title: 'macOS 桌面端 UI 优化',
  description: '优化桌面工作台',
  goal: '让桌面端适合长时间任务推进',
  category: 'project',
  tags: ['desktop'],
  status: 'active',
  phase: 'during',
  priority: 'high',
  progress: 0.5,
  progress_source: 'evidence',
  actual_hours: 4,
  milestones: [],
  blockers: [],
  ai_suggestions: [],
  related_chat_session_ids: ['session-1'],
  related_calendar_event_ids: [],
  evidence_count: 1,
  knowledge_output_count: 1,
}

const evidence: Evidence[] = [{
  id: 'ev-1',
  task_id: 'task-1',
  userId: 'user-1',
  type: 'note',
  title: '桌面布局调研',
  content: '确认三栏工作台结构。',
  source: 'manual',
  ai_extracted: false,
  confidence: 0,
  createdAt: new Date().toISOString(),
}]

const outputs: KnowledgeOutput[] = [{
  id: 'ko-1',
  task_id: 'task-1',
  userId: 'user-1',
  title: '桌面端 UI 优化方案',
  markdown: '# 方案',
  format: 'summary',
  vault_relative_path: '',
  obsidian_tags: [],
  obsidian_links: [],
  status: 'draft',
  source_evidence_ids: [],
  word_count: 0,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}]

describe('TaskDetailWorkbench', () => {
  it('renders desktop task detail workbench', () => {
    render(
      <TaskDetailWorkbench
        task={task}
        evidence={evidence}
        outputs={outputs}
        onEditTask={jest.fn()}
        onEditOutput={jest.fn()}
        onPublishOutput={jest.fn()}
        onCreateEvidence={jest.fn()}
        onCreateTimeLog={jest.fn()}
        onGenerateKnowledge={jest.fn()}
      />,
    )

    expect(screen.getByTestId('task-detail-workbench')).toBeInTheDocument()
    expect(screen.getByText('macOS 桌面端 UI 优化')).toBeInTheDocument()
    expect(screen.getByText('Recent Evidence')).toBeInTheDocument()
    expect(screen.getByText('桌面布局调研')).toBeInTheDocument()
    expect(screen.getByText('Knowledge Outputs')).toBeInTheDocument()
  })
})
