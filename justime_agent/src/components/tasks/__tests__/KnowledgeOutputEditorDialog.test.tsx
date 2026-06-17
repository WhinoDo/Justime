import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeOutputEditorDialog } from '../KnowledgeOutputEditorDialog'
import type { KnowledgeOutput } from '@/types/taskProcess'

const output: KnowledgeOutput = {
  id: 'out-1',
  task_id: 'task-1',
  userId: 'user-1',
  title: '迁移总结',
  format: 'summary',
  markdown: '# 初稿',
  vault_relative_path: '02-Knowledge/migration.md',
  obsidian_tags: ['study'],
  obsidian_links: [],
  status: 'published',
  source_evidence_ids: [],
  word_count: 2,
  version: 1,
  version_history: [
    {
      version: 0,
      title: '迁移总结 v0',
      markdown: '# 旧版本',
      vault_relative_path: '02-Knowledge/migration-v0.md',
      status: 'draft',
      updated_at: '2024-01-01T00:00:00Z',
      published_at: null,
    },
  ],
}

describe('KnowledgeOutputEditorDialog', () => {
  it('shows version history, saves markdown updates and confirms republish', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn().mockResolvedValue({ success: true })
    const onPublish = jest.fn().mockResolvedValue({ success: true })
    const onRollback = jest.fn().mockResolvedValue({ success: true })
    const onOpenChange = jest.fn()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <KnowledgeOutputEditorDialog
        open
        output={output}
        onOpenChange={onOpenChange}
        onSave={onSave}
        onPublish={onPublish}
        onRollback={onRollback}
      />,
    )

    expect(screen.getByText('v0')).toBeInTheDocument()
    expect(screen.getByText('迁移总结 v0')).toBeInTheDocument()
    expect(screen.getByText(/重新发布会覆盖当前 Vault 文件/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '回滚到 v0' }))
    await waitFor(() => {
      expect(onRollback).toHaveBeenCalledWith('out-1', 0)
    })

    const markdown = screen.getByLabelText('Markdown')
    await user.clear(markdown)
    await user.type(markdown, '# 完整总结')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('out-1', expect.objectContaining({
        markdown: '# 完整总结',
      }))
    })

    await user.click(screen.getByRole('button', { name: '发布到 Vault' }))
    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith('out-1')
    })

    confirmSpy.mockRestore()
  })
})
