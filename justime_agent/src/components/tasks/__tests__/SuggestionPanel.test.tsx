import React from 'react'
import { render, screen } from '@testing-library/react'
import { SuggestionPanel } from '../SuggestionPanel'
import type { AISuggestion } from '@/types/taskProcess'

const suggestions: AISuggestion[] = [
  {
    id: 'suggestion-next',
    type: 'next_step',
    content: '先补齐排序测试，再进行集成。',
    created_at: '2026-07-13T01:00:00.000Z',
  },
  {
    id: 'suggestion-resource',
    type: 'resource',
    content: '复用现有 Evidence API 契约。',
    created_at: '2026-07-13T02:00:00.000Z',
  },
]

describe('SuggestionPanel', () => {
  it('renders suggestion types and content without acceptance actions', () => {
    render(<SuggestionPanel suggestions={suggestions} />)

    expect(screen.getByText('下一步')).toBeInTheDocument()
    expect(screen.getByText('先补齐排序测试，再进行集成。')).toBeInTheDocument()
    expect(screen.getByText('资源')).toBeInTheDocument()
    expect(screen.getByText('复用现有 Evidence API 契约。')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders an empty state', () => {
    render(<SuggestionPanel suggestions={[]} />)

    expect(screen.getByText('当前没有下一步建议。')).toBeInTheDocument()
  })
})
