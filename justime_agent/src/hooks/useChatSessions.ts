'use client'

import { useCallback, useEffect, useState } from 'react'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

export interface ChatSessionSummary {
  _id: string
  title: string
  updatedAt: string
  preview?: string
}

interface UseChatSessionsOptions {
  userId?: string
  autoSelectLatest?: boolean
  currentSessionId?: string | null
  onAutoSelect?: (sessionId: string) => void
}

export function useChatSessions({
  userId,
  autoSelectLatest = false,
  currentSessionId = null,
  onAutoSelect,
}: UseChatSessionsOptions = {}) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    if (!userId) {
      setSessions([])
      setError(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(API_ENDPOINTS.CHAT.SESSIONS)
      const result = await response.json()

      if (result.sessions) {
        setSessions(result.sessions)

        if (autoSelectLatest && currentSessionId === null && result.sessions.length > 0) {
          onAutoSelect?.(result.sessions[0]._id)
        }
      } else {
        setSessions([])
        setError('Failed to load sessions')
      }
    } catch (err) {
      console.error('加载会话列表失败:', err)
      setSessions([])
      setError('An error occurred while loading sessions')
    } finally {
      setLoading(false)
    }
  }, [autoSelectLatest, currentSessionId, onAutoSelect, userId])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  return {
    sessions,
    loading,
    error,
    reload: loadSessions,
  }
}
