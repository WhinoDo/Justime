'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  // Compute platform info inside the component (not at module level)
  // to avoid SSR hydration mismatches — on the server navigator is
  // unavailable so isMac defaults to false, while on a Mac client
  // it would be true, causing a content mismatch.
  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    []
  )

  const mod = isMac ? '⌘' : 'Ctrl+'

  const shortcuts = useMemo(
    () => [
      { keys: `${mod}K`, description: '搜索 / 命令面板' },
      { keys: `${mod}N`, description: '新建对话' },
      { keys: `${mod},`, description: '打开设置' },
      { keys: `${mod}Enter`, description: '发送消息', desktopOnly: true },
      { keys: 'Enter', description: '发送消息' },
      { keys: 'Shift+Enter', description: '换行' },
      { keys: 'Esc', description: '关闭弹窗' },
    ],
    [mod]
  )

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Toggle with "?" key (when not in an input field)
    if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
      e.preventDefault()
      setOpen(prev => !prev)
    }
    if (e.key === 'Escape' && open) {
      setOpen(false)
    }
  }, [open])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="键盘快捷键"
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">键盘快捷键</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground">{s.description}</span>
              <kbd className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          按 <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">?</kbd> 切换此面板
        </p>
      </div>
    </div>,
    document.body
  )
}