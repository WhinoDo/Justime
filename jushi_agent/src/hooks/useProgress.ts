'use client'

import { useState, useEffect, useCallback } from 'react'
import { StudyProgress, ProgressStats, Subject } from '@/types/study'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

export function useStudyProgress(startDate?: string, endDate?: string) {
  const [progress, setProgress] = useState<StudyProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      const query = params.toString()
      const url = query ? `${API_ENDPOINTS.STUDY.PROGRESS}?${query}` : API_ENDPOINTS.STUDY.PROGRESS
      const res = await fetch(url)
      const data = await res.json()
      if (data.success && data.data) {
        setProgress(data.data.progress || data.data || [])
      } else if (data.success) {
        setProgress([])
      } else {
        setError(data.error || '获取学习进度失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取学习进度失败')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { fetchProgress() }, [fetchProgress])

  return { progress, loading, error, refetch: fetchProgress }
}

export function useProgressStats() {
  const [stats, setStats] = useState<ProgressStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_ENDPOINTS.STUDY.PROGRESS}?stats=true`)
      const data = await res.json()
      if (data.success && data.data) {
        setStats(data.data.stats || data.data)
      } else if (data.success) {
        setStats(null)
      } else {
        setError(data.error || '获取进度统计失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取进度统计失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}
