import React from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BeforeWorkspace } from '../BeforeWorkspace'
import { useTaskProcessDetail } from '@/hooks/useTaskProcesses'
import type { TaskProcess } from '@/types/taskProcess'

const task: TaskProcess = {
  id: 'task-1',
  userId: 'user-1',
  title: '发布前准备',
  description: '完成发布前学习与检查',
  goal: '按计划完成发布',
  category: 'project',
  tags: ['release'],
  status: 'planned',
  phase: 'before',
  priority: 'high',
  progress: 0,
  progress_source: 'manual',
  actual_hours: 0,
  materials: [
    {
      title: '发布运行手册',
      url: 'https://example.com/runbook',
      summary: '核对构建、签名和回滚步骤。',
      source: '官方文档',
    },
  ],
  preparation_items: [
    { id: 'prep-2', title: '准备回滚说明', done: false, order: 2 },
    { id: 'prep-1', title: '确认测试通过', done: true, order: 1 },
  ],
  milestones: [
    { id: 'mile-1', title: '候选版本完成', description: '生成可验证构建', order: 1, status: 'active' },
    { id: 'mile-2', title: '发布窗口确认', description: '确认发布时间', order: 2, status: 'pending' },
  ],
  blockers: [],
  ai_suggestions: [],
  ai_plan: { summary: '先核对资料和准备项，再生成候选版本。' },
  related_chat_session_ids: [],
  related_calendar_event_ids: [],
  evidence_count: 0,
  knowledge_output_count: 0,
}

describe('BeforeWorkspace', () => {
  it('renders plan, materials, ordered preparation items, and milestone status controls', () => {
    render(<BeforeWorkspace task={task} onUpdatePreparationItems={jest.fn()} />)

    expect(screen.getByText('先核对资料和准备项，再生成候选版本。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /发布运行手册/ })).toHaveAttribute('href', 'https://example.com/runbook')
    expect(screen.getByText('核对构建、签名和回滚步骤。')).toBeInTheDocument()
    expect(screen.getByText('官方文档')).toBeInTheDocument()
    expect(screen.getByText('候选版本完成')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '候选版本完成状态' })).toHaveValue('active')
    expect(screen.getByRole('combobox', { name: '发布窗口确认状态' })).toHaveValue('pending')

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).toHaveAccessibleName('确认测试通过')
    expect(checkboxes[1]).toHaveAccessibleName('准备回滚说明')
  })

  it('links only materials with an explicit safe web scheme', () => {
    render(
      <BeforeWorkspace
        task={{
          ...task,
          materials: [
            {
              title: '脚本资料',
              url: 'javascript:alert(1)',
              summary: '不应成为可点击链接。',
              source: 'AI 生成',
            },
            {
              title: '数据资料',
              url: 'data:text/html,<script>alert(1)</script>',
              summary: '数据 URL 不应成为可点击链接。',
              source: 'AI 生成',
            },
            {
              title: '相对路径资料',
              url: '/security-guide',
              summary: '相对 URL 不应成为可点击链接。',
              source: '内部文档',
            },
            {
              title: '无效资料',
              url: 'not a valid URL',
              summary: '无效 URL 不应成为可点击链接。',
              source: '内部文档',
            },
            {
              title: '安全资料',
              url: 'https://example.com/security-guide',
              summary: '应保留有效的 HTTPS 链接。',
              source: '官方文档',
            },
          ],
        }}
        onUpdatePreparationItems={jest.fn()}
      />,
    )

    for (const title of ['脚本资料', '数据资料', '相对路径资料', '无效资料']) {
      expect(screen.getByText(title)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: title })).not.toBeInTheDocument()
    }

    const safeLink = screen.getByRole('link', { name: /安全资料/ })
    expect(safeLink).toHaveAttribute('href', 'https://example.com/security-guide')
    expect(safeLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(safeLink).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('sends the complete array with only the target done state changed', async () => {
    const user = userEvent.setup()
    const onUpdatePreparationItems = jest.fn().mockResolvedValue({ success: true })
    render(<BeforeWorkspace task={task} onUpdatePreparationItems={onUpdatePreparationItems} />)

    await user.click(screen.getByRole('checkbox', { name: '准备回滚说明' }))

    await waitFor(() => {
      expect(onUpdatePreparationItems).toHaveBeenCalledWith([
        { id: 'prep-2', title: '准备回滚说明', done: true, order: 2 },
        { id: 'prep-1', title: '确认测试通过', done: true, order: 1 },
      ])
    })
  })

  it('prevents duplicate updates while pending', async () => {
    const user = userEvent.setup()
    let resolveUpdate: ((value: { success: boolean }) => void) | undefined
    const onUpdatePreparationItems = jest.fn().mockImplementation(() => new Promise((resolve) => {
      resolveUpdate = resolve
    }))
    render(<BeforeWorkspace task={task} onUpdatePreparationItems={onUpdatePreparationItems} />)

    const checkbox = screen.getByRole('checkbox', { name: '准备回滚说明' })
    await user.click(checkbox)
    await user.click(checkbox)

    expect(onUpdatePreparationItems).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('正在保存准备项')

    await act(async () => {
      resolveUpdate?.({ success: true })
    })
  })

  it('keeps the confirmed state and shows an accessible error after failure', async () => {
    const user = userEvent.setup()
    const onUpdatePreparationItems = jest.fn().mockResolvedValue({ success: false, error: '网络暂时不可用' })
    render(<BeforeWorkspace task={task} onUpdatePreparationItems={onUpdatePreparationItems} />)

    const checkbox = screen.getByRole('checkbox', { name: '准备回滚说明' })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)

    expect(await screen.findByRole('alert')).toHaveTextContent('网络暂时不可用')
    expect(checkbox).not.toBeChecked()
  })

  it('requests active to completed once and disables only the pending milestone', async () => {
    let resolveUpdate: ((value: { success: boolean }) => void) | undefined
    const onUpdateMilestoneStatus = jest.fn().mockImplementation(() => new Promise((resolve) => {
      resolveUpdate = resolve
    }))
    render(
      <BeforeWorkspace
        task={task}
        onUpdatePreparationItems={jest.fn()}
        onUpdateMilestoneStatus={onUpdateMilestoneStatus}
      />,
    )

    const activeSelect = screen.getByRole('combobox', { name: '候选版本完成状态' })
    const pendingSelect = screen.getByRole('combobox', { name: '发布窗口确认状态' })
    fireEvent.change(activeSelect, { target: { value: 'completed' } })
    fireEvent.change(activeSelect, { target: { value: 'completed' } })

    expect(onUpdateMilestoneStatus).toHaveBeenCalledTimes(1)
    expect(onUpdateMilestoneStatus).toHaveBeenCalledWith('mile-1', 'completed')
    expect(activeSelect).toBeDisabled()
    expect(activeSelect).toHaveValue('active')
    expect(pendingSelect).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('正在保存里程碑')

    await act(async () => {
      resolveUpdate?.({ success: true })
    })
  })

  it('keeps the confirmed milestone state and shows an accessible error after failure', async () => {
    const user = userEvent.setup()
    const onUpdateMilestoneStatus = jest.fn().mockResolvedValue({ success: false, error: '里程碑服务不可用' })
    render(
      <BeforeWorkspace
        task={task}
        onUpdatePreparationItems={jest.fn()}
        onUpdateMilestoneStatus={onUpdateMilestoneStatus}
      />,
    )

    const select = screen.getByRole('combobox', { name: '候选版本完成状态' })
    await user.selectOptions(select, 'completed')

    expect(await screen.findByRole('alert')).toHaveTextContent('里程碑服务不可用')
    expect(select).toHaveValue('active')
  })
})

describe('useTaskProcessDetail preparation updates', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
    fetchMock.mockImplementation((input: RequestInfo, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { task } }),
        })
      }
      if (String(input).includes('/evidence')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { items: [] } }) })
      }
      if (String(input).includes('/knowledge-outputs')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { items: [] } }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { task } }) })
    })
  })

  it('patches the generic task detail endpoint with preparation_items only', async () => {
    const { result } = renderHook(() => useTaskProcessDetail('task-1'))
    await waitFor(() => expect(result.current.task).toEqual(task))

    await act(async () => {
      await result.current.updatePreparationItems(task.preparation_items || [])
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/task-processes/task-1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ preparation_items: task.preparation_items || [] }),
    }))
  })

  it('patches the dedicated milestone endpoint and replaces task with the server response', async () => {
    const completedAt = '2026-07-13T08:30:00Z'
    const updatedTask: TaskProcess = {
      ...task,
      milestones: task.milestones.map((milestone) => (
        milestone.id === 'mile-1'
          ? { ...milestone, status: 'completed', completed_at: completedAt }
          : milestone
      )),
    }
    fetchMock.mockImplementation((input: RequestInfo, init?: RequestInit) => {
      if (String(input) === '/api/task-processes/task-1/milestones/mile-1' && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { task: updatedTask } }),
        })
      }
      if (String(input).includes('/evidence')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { items: [] } }) })
      }
      if (String(input).includes('/knowledge-outputs')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { items: [] } }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { task } }) })
    })

    const { result } = renderHook(() => useTaskProcessDetail('task-1'))
    await waitFor(() => expect(result.current.task).toEqual(task))

    await act(async () => {
      await result.current.updateMilestoneStatus('mile-1', 'completed')
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/task-processes/task-1/milestones/mile-1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    }))
    expect(result.current.task?.milestones[0]).toEqual(expect.objectContaining({
      status: 'completed',
      completed_at: completedAt,
    }))
  })

  it('serializes different milestone updates so a later full-task snapshot cannot be overwritten', async () => {
    const firstUpdatedTask: TaskProcess = {
      ...task,
      milestones: task.milestones.map((milestone) => (
        milestone.id === 'mile-1' ? { ...milestone, status: 'completed' } : milestone
      )),
    }
    const bothUpdatedTask: TaskProcess = {
      ...firstUpdatedTask,
      milestones: firstUpdatedTask.milestones.map((milestone) => (
        milestone.id === 'mile-2' ? { ...milestone, status: 'skipped' } : milestone
      )),
    }
    let resolveFirstUpdate: ((response: Response) => void) | undefined
    const secondResponse = Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data: { task: bothUpdatedTask } }),
    } as Response)

    fetchMock.mockImplementation((input: RequestInfo, init?: RequestInit) => {
      if (String(input) === '/api/task-processes/task-1/milestones/mile-1' && init?.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          resolveFirstUpdate = resolve
        })
      }
      if (String(input) === '/api/task-processes/task-1/milestones/mile-2' && init?.method === 'PATCH') {
        return secondResponse
      }
      if (String(input).includes('/evidence')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { items: [] } }) })
      }
      if (String(input).includes('/knowledge-outputs')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { items: [] } }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { task } }) })
    })

    const { result } = renderHook(() => useTaskProcessDetail('task-1'))
    await waitFor(() => expect(result.current.task).toEqual(task))

    let firstUpdate!: ReturnType<typeof result.current.updateMilestoneStatus>
    let secondUpdate!: ReturnType<typeof result.current.updateMilestoneStatus>
    act(() => {
      firstUpdate = result.current.updateMilestoneStatus('mile-1', 'completed')
      secondUpdate = result.current.updateMilestoneStatus('mile-2', 'skipped')
    })

    await waitFor(() => expect(resolveFirstUpdate).toBeDefined())
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/task-processes/task-1/milestones/mile-2',
      expect.objectContaining({ method: 'PATCH' }),
    )

    await act(async () => {
      resolveFirstUpdate?.({
        ok: true,
        json: async () => ({ success: true, data: { task: firstUpdatedTask } }),
      } as Response)
      await firstUpdate
      await secondUpdate
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/task-processes/task-1/milestones/mile-2', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ status: 'skipped' }),
    }))
    expect(result.current.task?.milestones).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mile-1', status: 'completed' }),
      expect.objectContaining({ id: 'mile-2', status: 'skipped' }),
    ]))
  })

  it('renders the status and completed_at returned by the milestone PATCH', async () => {
    const user = userEvent.setup()
    const completedAt = '2026-07-13T08:30:00Z'
    const updatedTask: TaskProcess = {
      ...task,
      milestones: task.milestones.map((milestone) => (
        milestone.id === 'mile-1'
          ? { ...milestone, status: 'completed', completed_at: completedAt }
          : milestone
      )),
    }
    fetchMock.mockImplementation((input: RequestInfo, init?: RequestInit) => {
      if (String(input) === '/api/task-processes/task-1/milestones/mile-1' && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { task: updatedTask } }),
        })
      }
      if (String(input).includes('/evidence')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { items: [] } }) })
      }
      if (String(input).includes('/knowledge-outputs')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { items: [] } }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: { task } }) })
    })

    function MilestoneHarness() {
      const detail = useTaskProcessDetail('task-1')
      if (!detail.task) return null
      return (
        <BeforeWorkspace
          task={detail.task}
          onUpdatePreparationItems={detail.updatePreparationItems}
          onUpdateMilestoneStatus={detail.updateMilestoneStatus}
        />
      )
    }

    render(<MilestoneHarness />)
    const select = await screen.findByRole('combobox', { name: '候选版本完成状态' })
    await user.selectOptions(select, 'completed')

    await waitFor(() => expect(select).toHaveValue('completed'))
    expect(screen.getByText(/完成于/)).toHaveAttribute('datetime', completedAt)
  })
})
