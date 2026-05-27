/**
 * RAG 文档预览状态管理 Hook
 * 从 ChatInterface 中提取，管理知识库文档引用的预览状态
 */

import { useState, useCallback, useEffect } from 'react'
import { RagReference } from '@/types'

export type RagPreviewTab = 'snippets' | 'full'

export interface RagFullContentState {
  content: string
  truncated: boolean
  charCount: number
  maxChars: number
  error?: string
}

export interface RagPreviewState {
  selectedReference: RagReference | null
  previewOpen: boolean
  activeTab: RagPreviewTab
  fullContentCache: Record<string, RagFullContentState>
  fullContentLoadingPath: string | null
}

export interface UseRagPreviewReturn {
  state: RagPreviewState
  openPreview: (reference: RagReference) => void
  closePreview: () => void
  setActiveTab: (tab: RagPreviewTab) => void
  loadFullContent: (reference: RagReference) => Promise<void>
}

const initialState: RagPreviewState = {
  selectedReference: null,
  previewOpen: false,
  activeTab: 'snippets',
  fullContentCache: {},
  fullContentLoadingPath: null
}

export function useRagPreview(): UseRagPreviewReturn {
  const [state, setState] = useState<RagPreviewState>(initialState)

  const openPreview = useCallback((reference: RagReference) => {
    setState(prev => ({
      ...prev,
      selectedReference: reference,
      previewOpen: true,
      activeTab: 'snippets'
    }))
  }, [])

  const closePreview = useCallback(() => {
    setState(prev => ({
      ...prev,
      previewOpen: false
    }))
  }, [])

  const setActiveTab = useCallback((tab: RagPreviewTab) => {
    setState(prev => ({
      ...prev,
      activeTab: tab
    }))
  }, [])

  const loadFullContent = useCallback(async (reference: RagReference) => {
    const docPath = reference?.docPath
    if (!docPath) return

    setState(prev => {
      if (prev.fullContentCache[docPath] || prev.fullContentLoadingPath === docPath) {
        return prev
      }
      return { ...prev, fullContentLoadingPath: docPath }
    })

    try {
      const response = await fetch(
        `/api/knowledge/content?path=${encodeURIComponent(docPath)}&max_chars=20000`,
        { credentials: 'include' }
      )
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        const errorMessage = payload?.detail || payload?.error || `HTTP ${response.status}`
        setState(prev => ({
          ...prev,
          fullContentCache: {
            ...prev.fullContentCache,
            [docPath]: {
              content: '',
              truncated: false,
              charCount: 0,
              maxChars: 20000,
              error: String(errorMessage)
            }
          },
          fullContentLoadingPath: prev.fullContentLoadingPath === docPath ? null : prev.fullContentLoadingPath
        }))
        return
      }

      setState(prev => ({
        ...prev,
        fullContentCache: {
          ...prev.fullContentCache,
          [docPath]: {
            content: payload.content || '',
            truncated: Boolean(payload.truncated),
            charCount: Number(payload.charCount || 0),
            maxChars: Number(payload.maxChars || 20000)
          }
        },
        fullContentLoadingPath: prev.fullContentLoadingPath === docPath ? null : prev.fullContentLoadingPath
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        fullContentCache: {
          ...prev.fullContentCache,
          [docPath]: {
            content: '',
            truncated: false,
            charCount: 0,
            maxChars: 20000,
            error: error instanceof Error ? error.message : '加载文档失败'
          }
        },
        fullContentLoadingPath: prev.fullContentLoadingPath === docPath ? null : prev.fullContentLoadingPath
      }))
    }
  }, [])

  return {
    state,
    openPreview,
    closePreview,
    setActiveTab,
    loadFullContent
  }
}
