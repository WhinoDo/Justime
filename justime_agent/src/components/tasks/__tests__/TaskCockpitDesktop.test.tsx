import React from 'react'
import { render, screen } from '@testing-library/react'
import { TaskCockpitDesktop } from '../TaskCockpitDesktop'
import type { TaskProcess } from '@/types/taskProcess'

const tasks: TaskProcess[] = [
  {
    id: 'task-1',
    userId: 'user-1',
    title: '推进 macOS 桌面端',
    description: '桌面 UI 优化',
    goal: '完成桌面工作台',
    category: 'project',
    tags: ['desktop'],
    status: 'active',
    phase: 'during',
    priority: 'high',
    progress: 0.5,
    progress_source: 'evidence',
    actual_hours: 3,
    milestones: [],
    blockers: [],
    ai_suggestions: [],
    related_chat_session_ids: [],
    related_calendar_event_ids: [],
    evidence_count: 4,
    knowledge_output_count: 1,
  },
]

describe('TaskCockpitDesktop', () => {
  it('renders focus queue, phase board, and metrics', () => {
    render(<TaskCockpitDesktop tasks={tasks} />)

    expect(screen.getByText('Focus Queue')).toBeInTheDocument()
    expect(screen.getByText('During')).toBeInTheDocument()
    expect(screen.getAllByText('推进 macOS 桌面端').length).toBeGreaterThan(0)
    expect(screen.getByText('累计投入')).toBeInTheDocument()
  })
})
