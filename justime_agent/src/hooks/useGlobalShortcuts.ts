'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { JUSTIME_NEW_CHAT_EVENT } from '@/lib/constants/events'

export interface GlobalShortcutActions {
  /** Cmd/Ctrl+K — open command palette / search */
  onSearch?: () => void
  /** Cmd/Ctrl+N — new conversation */
  onNewChat?: () => void
  /** Cmd/Ctrl+, — open settings */
  onSettings?: () => void
}

/**
 * Global keyboard shortcuts for desktop productivity:
 * - Cmd/Ctrl+K  → command palette / search
 * - Cmd/Ctrl+N  → new conversation
 * - Cmd/Ctrl+,  → settings / profile
 *
 * All shortcuts carry `aria-keyshortcuts` attributes on the
 * corresponding UI elements (see MacSidebar, chat page, etc).
 */
export function useGlobalShortcuts(actions: GlobalShortcutActions = {}) {
  // Store actions in a ref so the keydown handler never needs to
  // re-register when the parent re-renders with new action callbacks.
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only respond when Cmd (Mac) or Ctrl (Windows/Linux) is held
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      // Ignore when user is typing in a textarea or input (except for Cmd combos)
      const tag = (e.target as HTMLElement).tagName
      // Cmd/Ctrl combos are always meaningful even in text fields

      switch (e.key) {
        case 'k':
        case 'K':
          e.preventDefault()
          actionsRef.current.onSearch?.()
          break

        case 'n':
        case 'N':
          e.preventDefault()
          actionsRef.current.onNewChat?.()
          break

        case ',':
          e.preventDefault()
          actionsRef.current.onSettings?.()
          break
      }
    },
    [] // Stable — reads actions from ref
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Default implementation of global shortcut actions.
 * Routes to the appropriate pages and resets chat state.
 */
export function useDefaultGlobalShortcuts() {
  const router = useRouter()

  const actions: GlobalShortcutActions = {
    onSearch: () => {
      // Focus the search/command palette — future feature
      // For now, navigate to chat with search context
      router.push('/chat')
    },
    onNewChat: () => {
      // Navigate to a fresh chat session
      router.push('/chat')
      // Dispatch custom event so ChatInterface can reset its state
      window.dispatchEvent(new CustomEvent(JUSTIME_NEW_CHAT_EVENT))
    },
    onSettings: () => {
      router.push('/profile')
    },
  }

  useGlobalShortcuts(actions)
}