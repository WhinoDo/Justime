import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDetailActions } from '../TaskDetailActions'

describe('TaskDetailActions', () => {
  it('sends evidence and knowledge generation actions', async () => {
    const user = userEvent.setup()
    const onCreateEvidence = jest.fn().mockResolvedValue({ success: true })
    const onCreateTimeLog = jest.fn().mockResolvedValue({ success: true })
    const onGenerateKnowledge = jest.fn().mockResolvedValue({ success: true })

    render(
      <TaskDetailActions
        taskId="task-1"
        onCreateEvidence={onCreateEvidence}
        onCreateTimeLog={onCreateTimeLog}
        onGenerateKnowledge={onGenerateKnowledge}
      />,
    )

    const textareas = screen.getAllByRole('textbox')
    await user.type(textareas[0], '排查 chat 绑定任务的回写逻辑')
    await user.type(textareas[1], '已经补齐 evidence 写回 task_process')
    await user.click(screen.getByRole('button', { name: '写入 Evidence' }))

    await waitFor(() => {
      expect(onCreateEvidence).toHaveBeenCalledWith(expect.objectContaining({
        task_id: 'task-1',
        type: 'note',
        source: 'task_detail_manual',
      }))
    })

    await user.clear(screen.getByDisplayValue('1'))
    await user.type(screen.getByPlaceholderText('1'), '2')
    await user.type(textareas[2], '处理了兼容层和表单入口')
    await user.click(screen.getByRole('button', { name: '记录时间' }))

    await waitFor(() => {
      expect(onCreateTimeLog).toHaveBeenCalledWith(expect.objectContaining({
        task_id: 'task-1',
        hours: 2,
      }))
    })

    await user.type(textareas[3], '强调 study 到 task_processes 的兼容策略')
    await user.click(screen.getByRole('button', { name: '生成产出' }))

    await waitFor(() => {
      expect(onGenerateKnowledge).toHaveBeenCalledWith(expect.objectContaining({
        task_id: 'task-1',
        format: 'summary',
        additional_instructions: '强调 study 到 task_processes 的兼容策略',
      }))
    })
  })
})
