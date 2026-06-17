'use client'

import { useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { KnowledgeOutput, KnowledgeOutputUpdatePayload } from '@/types/taskProcess'

interface KnowledgeOutputEditorDialogProps {
  open: boolean
  output: KnowledgeOutput | null
  onOpenChange: (open: boolean) => void
  onSave: (outputId: string, payload: KnowledgeOutputUpdatePayload) => Promise<{ success: boolean; error?: string }>
  onPublish: (outputId: string) => Promise<{ success: boolean; error?: string }>
  onRollback: (outputId: string, version: number) => Promise<{ success: boolean; error?: string }>
}

export function KnowledgeOutputEditorDialog({
  open,
  output,
  onOpenChange,
  onSave,
  onPublish,
  onRollback,
}: KnowledgeOutputEditorDialogProps) {
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [vaultPath, setVaultPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !output) return
    setTitle(output.title)
    setMarkdown(output.markdown)
    setVaultPath(output.vault_relative_path)
    setSaving(false)
    setPublishing(false)
    setError(null)
  }, [open, output])

  if (!output) return null

  const publishHint = output.status === 'published'
    ? vaultPath.trim() === output.vault_relative_path
      ? '重新发布会覆盖当前 Vault 文件。'
      : '当前 Vault 路径已变更，重新发布会写入新路径，旧文件不会自动删除。'
    : '首次发布会在 Vault 中创建该 Markdown 文件。'

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const result = await onSave(output.id, {
      title: title.trim(),
      markdown: markdown.trim(),
      vault_relative_path: vaultPath.trim(),
    })
    setSaving(false)
    if (!result.success) {
      setError(result.error || '保存失败')
      return
    }
    onOpenChange(false)
  }

  const handlePublish = async () => {
    const hasPublishedBefore = output.status === 'published'
    const confirmMessage = vaultPath.trim() === output.vault_relative_path
      ? '该知识产出已发布过，继续会覆盖 Vault 中的现有文件。是否继续？'
      : '该知识产出已发布过，且当前 Vault 路径已变更。继续会在新路径发布，新旧文件会同时存在。是否继续？'
    if (hasPublishedBefore && !window.confirm(confirmMessage)) {
      return
    }
    setPublishing(true)
    setError(null)
    const saveResult = await onSave(output.id, {
      title: title.trim(),
      markdown: markdown.trim(),
      vault_relative_path: vaultPath.trim(),
    })
    if (!saveResult.success) {
      setPublishing(false)
      setError(saveResult.error || '发布前保存失败')
      return
    }
    const result = await onPublish(output.id)
    setPublishing(false)
    if (!result.success) {
      setError(result.error || '发布失败')
      return
    }
    onOpenChange(false)
  }

  const handleRollback = async (version: number) => {
    if (!window.confirm(`回滚到 v${version} 会把当前内容恢复为该历史版本，并生成一个新的草稿版本。是否继续？`)) {
      return
    }
    setSaving(true)
    setError(null)
    const result = await onRollback(output.id, version)
    setSaving(false)
    if (!result.success) {
      setError(result.error || '回滚失败')
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-[28px] border border-white/10 bg-slate-950/95 p-0 text-white shadow-2xl">
        <form onSubmit={handleSave} className="space-y-6 p-6">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">编辑 KnowledgeOutput</DialogTitle>
            <DialogDescription className="text-white/[0.55]">
              直接维护 markdown 成果，并可一键发布到 Vault。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2 text-white/80">
                <History className="h-4 w-4 text-amber-200" />
                <span className="text-sm font-medium">版本历史</span>
              </div>
              {output.version_history && output.version_history.length > 0 ? (
                <div className="space-y-2">
                  {output.version_history.slice().reverse().map((item) => (
                    <div key={`${item.version}-${item.updated_at}`} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white/70">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-white">v{item.version}</span>
                        <span className="text-xs text-white/[0.45]">{new Date(item.updated_at).toLocaleString('zh-CN')}</span>
                      </div>
                      <p className="mt-1 truncate text-white/[0.65]">{item.title}</p>
                      <div className="mt-3">
                        <Button type="button" variant="ghost" className="h-8 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-white/80 hover:bg-white/10 hover:text-white" onClick={() => handleRollback(item.version)}>
                          回滚到 v{item.version}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/50">当前还没有历史版本。</p>
              )}
            </div>
            <div className="rounded-2xl border border-amber-200/[0.15] bg-amber-300/10 p-4 text-sm text-amber-50">
              {publishHint}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70" htmlFor="output-title">标题</label>
              <Input id="output-title" value={title} onChange={(e) => setTitle(e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70" htmlFor="output-vault-path">Vault 路径</label>
              <Input id="output-vault-path" value={vaultPath} onChange={(e) => setVaultPath(e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70" htmlFor="output-markdown">Markdown</label>
              <Textarea id="output-markdown" value={markdown} onChange={(e) => setMarkdown(e.target.value)} className="min-h-[320px] border-white/10 bg-white/5 font-mono text-white" />
            </div>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <DialogFooter className="gap-3 sm:justify-end sm:space-x-0">
            <Button type="button" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={saving || publishing} className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/[0.15]">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存修改
            </Button>
            <Button type="button" disabled={saving || publishing} className="rounded-2xl bg-emerald-200 text-slate-950 hover:bg-emerald-100" onClick={handlePublish}>
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              发布到 Vault
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
