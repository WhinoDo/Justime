import React from 'react'
import { render, screen } from '@testing-library/react'
import { BlockerPanel } from '../BlockerPanel'
import type { Blocker } from '@/types/taskProcess'

const blockers: Blocker[] = [
  {
    id: 'blocker-open',
    description: '等待外部接口权限',
    severity: 'high',
    resolved: false,
    created_at: '2026-07-13T01:00:00.000Z',
  },
  {
    id: 'blocker-resolved',
    description: '测试数据缺失',
    severity: 'low',
    resolved: true,
    resolution: '已补齐 fixture',
    created_at: '2026-07-12T01:00:00.000Z',
    resolved_at: '2026-07-13T02:00:00.000Z',
  },
]

describe('BlockerPanel', () => {
  it('renders severity, description, and resolved state without mutation controls', () => {
    render(<BlockerPanel blockers={blockers} />)

    expect(screen.getByText('严重度：高')).toBeInTheDocument()
    expect(screen.getByText('等待外部接口权限')).toBeInTheDocument()
    expect(screen.getByText('未解决')).toBeInTheDocument()
    expect(screen.getByText('严重度：低')).toBeInTheDocument()
    expect(screen.getByText('已解决')).toBeInTheDocument()
    expect(screen.getByText('解决说明：已补齐 fixture')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders an empty state', () => {
    render(<BlockerPanel blockers={[]} />)

    expect(screen.getByText('当前没有识别到阻塞项。')).toBeInTheDocument()
  })
})
