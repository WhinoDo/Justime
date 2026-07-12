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

function renderDialog(knowledgeOutput: KnowledgeOutput = output) {
  const props = {
    onSave: jest.fn().mockResolvedValue({ success: true }),
    onPublish: jest.fn().mockResolvedValue({ success: true }),
    onRollback: jest.fn().mockResolvedValue({ success: true }),
    onOpenChange: jest.fn(),
  }

  render(
    <KnowledgeOutputEditorDialog
      open
      output={knowledgeOutput}
      {...props}
    />,
  )

  return props
}

describe('KnowledgeOutputEditorDialog', () => {
  it('shows version history, saves markdown updates and confirms republish', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    const { onPublish, onRollback, onSave } = renderDialog()

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

  it('switches between accessible edit and preview tabs and renders the current markdown', async () => {
    const user = userEvent.setup()
    renderDialog({
      ...output,
      markdown: '# Preview heading\n\n- first item',
    })

    const editTab = screen.getByRole('tab', { name: '编辑' })
    const previewTab = screen.getByRole('tab', { name: '预览' })
    const diffTab = screen.getByRole('tab', { name: 'Diff' })

    expect(editTab).toHaveAttribute('aria-selected', 'true')
    expect(previewTab).toHaveAttribute('aria-selected', 'false')
    expect(diffTab).toHaveAttribute('aria-selected', 'false')

    await user.click(previewTab)

    expect(previewTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Preview heading/)).toBeInTheDocument()
    expect(screen.getByText(/first item/)).toBeInTheDocument()
  })

  it('selects two versions and labels deterministic additions and deletions', async () => {
    const user = userEvent.setup()
    renderDialog({
      ...output,
      title: '当前版本',
      markdown: '# 标题\n保留内容\n新增内容',
      version: 2,
      version_history: [
        {
          version: 0,
          title: '最初版本',
          markdown: '# 标题\n保留内容\n删除内容',
          vault_relative_path: '02-Knowledge/migration.md',
          status: 'draft',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          version: 1,
          title: '中间版本',
          markdown: '# 标题\n保留内容\n中间内容',
          vault_relative_path: '02-Knowledge/migration.md',
          status: 'draft',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ],
    })

    await user.click(screen.getByRole('tab', { name: 'Diff' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '基准版本' }), '0')
    await user.selectOptions(screen.getByRole('combobox', { name: '比较版本' }), '2')

    const diff = screen.getByRole('list', { name: '版本差异' })
    expect(diff).toHaveTextContent('删除内容')
    expect(diff).toHaveTextContent('新增内容')
    expect(screen.getByLabelText('删除：删除内容')).toBeInTheDocument()
    expect(screen.getByLabelText('新增：新增内容')).toBeInTheDocument()
  })

  it('shows an explicit no-change state for identical selected versions', async () => {
    const user = userEvent.setup()
    renderDialog({
      ...output,
      markdown: '# 相同内容',
      version: 2,
      version_history: [
        {
          version: 1,
          title: '相同历史版本',
          markdown: '# 相同内容',
          vault_relative_path: '02-Knowledge/migration.md',
          status: 'draft',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ],
    })

    await user.click(screen.getByRole('tab', { name: 'Diff' }))

    expect(screen.getByRole('status')).toHaveTextContent('两个版本的 Markdown 内容一致，没有变化。')
  })

  it('shows an explicit missing-history state when no prior version is available', async () => {
    const user = userEvent.setup()
    renderDialog({
      ...output,
      version_history: [],
    })

    await user.click(screen.getByRole('tab', { name: 'Diff' }))

    expect(screen.getByRole('status')).toHaveTextContent('当前还没有可用于比较的历史版本。')
  })
})
