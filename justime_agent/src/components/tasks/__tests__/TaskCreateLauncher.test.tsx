import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCreateLauncher } from '../TaskCreateLauncher'

const push = jest.fn()
const toast = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast }),
}))

describe('TaskCreateLauncher', () => {
  beforeEach(() => {
    push.mockReset()
    toast.mockReset()
  })

  it('redirects to task detail and shows success toast after create', async () => {
    const user = userEvent.setup()
    const createTask = jest.fn().mockResolvedValue({
      success: true,
      data: {
        task: {
          id: 'task-42',
        },
      },
    })

    render(
      <TaskCreateLauncher
        buttonLabel="新建任务"
        createTask={createTask}
      />,
    )

    await user.click(screen.getByRole('button', { name: '新建任务' }))
    await user.type(screen.getByLabelText('标题'), '任务创建回流')
    await user.type(screen.getByLabelText('目标'), '创建后直接进入详情页')
    await user.click(screen.getByRole('button', { name: '创建任务' }))

    await waitFor(() => {
      expect(createTask).toHaveBeenCalled()
      expect(push).toHaveBeenCalledWith('/tasks/task-42')
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: '任务已创建',
      }))
    })
  })
})
