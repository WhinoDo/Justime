import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { EvidenceTimeline } from '../EvidenceTimeline'
import type { Evidence } from '@/types/taskProcess'

function createEvidence(overrides: Partial<Evidence> & Pick<Evidence, 'id'>): Evidence {
  return {
    task_id: 'task-1',
    userId: 'user-1',
    type: 'note',
    title: 'Evidence title',
    content: 'Evidence content',
    source: 'manual',
    ai_extracted: false,
    confidence: 1,
    ...overrides,
  }
}

describe('EvidenceTimeline', () => {
  it('groups by local date descending and sorts each group by time descending', () => {
    const olderDay = new Date(2026, 6, 12, 20, 0).toISOString()
    const newerMorning = new Date(2026, 6, 13, 9, 0).toISOString()
    const newerEvening = new Date(2026, 6, 13, 18, 30).toISOString()

    render(
      <EvidenceTimeline
        evidence={[
          createEvidence({ id: 'older-day', title: '较早日期', createdAt: olderDay }),
          createEvidence({ id: 'newer-morning', title: '同日较早', createdAt: newerMorning }),
          createEvidence({ id: 'newer-evening', title: '同日较晚', createdAt: newerEvening }),
        ]}
      />,
    )

    const groups = screen.getAllByTestId('evidence-date-group')
    expect(groups).toHaveLength(2)
    expect(groups[0]).toHaveAttribute('data-date-key', '2026-07-13')
    expect(groups[1]).toHaveAttribute('data-date-key', '2026-07-12')

    const newerItems = within(groups[0]).getAllByTestId('evidence-item')
    expect(newerItems.map((item) => item.getAttribute('data-evidence-id'))).toEqual([
      'newer-evening',
      'newer-morning',
    ])
  })

  it('renders server fields, read-only details, and neutral optional-field fallbacks', () => {
    render(
      <EvidenceTimeline
        evidence={[
          createEvidence({
            id: 'evidence-1',
            type: 'code_commit',
            title: '',
            content: '修复排序逻辑',
            source: '',
            milestone_id: null,
            metadata: { commit: 'abc123' },
            sentiment: null,
            confidence: 0.8,
          }),
        ]}
      />,
    )

    expect(screen.getByText('code_commit')).toBeInTheDocument()
    expect(screen.getByText('未命名 Evidence')).toBeInTheDocument()
    expect(screen.getByText('修复排序逻辑')).toBeInTheDocument()
    expect(screen.getByText('来源：未记录')).toBeInTheDocument()
    expect(screen.getByText('里程碑：未关联')).toBeInTheDocument()
    expect(screen.getByText('时间未记录')).toBeInTheDocument()
    expect(screen.getByText('展开只读详情')).toBeInTheDocument()
    expect(screen.getByText(/"commit": "abc123"/)).toBeInTheDocument()
  })

  it('renders an empty state', () => {
    render(<EvidenceTimeline evidence={[]} />)

    expect(screen.getByText('还没有 Evidence。')).toBeInTheDocument()
    expect(screen.getByText('0 条')).toBeInTheDocument()
  })
})
