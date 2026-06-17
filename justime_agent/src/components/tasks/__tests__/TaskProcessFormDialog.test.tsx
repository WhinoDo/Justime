import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskProcessFormDialog } from '../TaskProcessFormDialog'

describe('TaskProcessFormDialog', () => {
  it('submits normalized create payload', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn().mockResolvedValue({ success: true })
    const onOpenChange = jest.fn()

    render(
      <TaskProcessFormDialog
        open
        mode="create"
        initialCategory="learning"
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText('标题'), '重构 study 兼容层')
    await user.type(screen.getByLabelText('目标'), '把 /study 切到 task_processes')
    await user.type(screen.getByLabelText('说明'), '兼容旧学习数据')
    await user.type(screen.getByLabelText('预估时长'), '3')
    await user.type(screen.getByLabelText('标签'), 'study, migration')

    await user.click(screen.getByRole('button', { name: '创建任务' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        title: '重构 study 兼容层',
        goal: '把 /study 切到 task_processes',
        description: '兼容旧学习数据',
        category: 'learning',
        estimated_hours: 3,
        tags: ['study', 'migration'],
        auto_plan: true,
      }))
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
