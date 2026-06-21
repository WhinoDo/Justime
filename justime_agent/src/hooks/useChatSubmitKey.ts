'use client'

import { useCallback, useMemo } from 'react'

/**
 * Chat submission key preference:
 * - "enter" (default): Enter sends, Shift+Enter inserts newline.
 *   On desktop, Cmd/Ctrl+Enter also sends.
 * - "ctrl-enter": Cmd/Ctrl+Enter sends, Enter inserts newline.
 *   Better for desktop users who frequently paste multiline text.
 */
export type SubmitKeyPreference = 'enter' | 'ctrl-enter'

/**
 * Returns a keydown handler suitable for chat textarea elements.
 *
 * Behaviour varies by the `preference` setting:
 * - `"enter"` (default, mobile-compatible):  Enter → send, Shift+Enter → newline.
 *   On desktop, Cmd/Ctrl+Enter → send as well.
 * - `"ctrl-enter"`: Cmd/Ctrl+Enter → send, bare Enter → newline.
 *
 * The handler also exposes `shortcutHint` — a human-readable string
 * describing the submit shortcut (e.g. "⌘↵" or "↵") for use in UI tooltips.
 */
export function useChatSubmitKey(options: {
  /** Callback invoked when the user triggers "send" via keyboard */
  onSubmit: () => void
  /** Preference for which key combo sends the message */
  preference?: SubmitKeyPreference
}) {
  const { onSubmit, preference = 'enter' } = options

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<Element>) => {
      const isMod = e.metaKey || e.ctrlKey

      if (preference === 'ctrl-enter') {
        // Cmd/Ctrl+Enter → send;  bare Enter → newline (default textarea)
        if (e.key === 'Enter' && isMod) {
          e.preventDefault()
          onSubmit()
        }
        // bare Enter is left to the default textarea (inserts newline)
      } else {
        // "enter" mode (default): Enter → send, Shift+Enter → newline,
        // and Cmd/Ctrl+Enter → send (desktop convenience)
        if (e.key === 'Enter') {
          if (isMod || !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
          // Shift+Enter → newline (default textarea behaviour)
        }
      }
    },
    [onSubmit, preference]
  )

  const shortcutHint = useMemo(() => {
    if (preference === 'ctrl-enter') {
      return navigator.platform?.includes('Mac') ? '⌘↵' : 'Ctrl+Enter'
    }
    // "enter" mode: the primary shortcut is Enter, with Cmd+Enter as desktop bonus
    return navigator.platform?.includes('Mac') ? '↵ / ⌘↵' : 'Enter / Ctrl+Enter'
  }, [preference])

  return { handleKeyDown, shortcutHint }
}