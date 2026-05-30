'use client'

import { useState, useEffect, useCallback } from 'react'
import { StudyProfile, StudyPlan, StudyTask, Subject } from '@/types/study'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

export function useStudyProfile() {
  const [profile, setProfile] = useState<StudyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(API_ENDPOINTS.STUDY.PROFILE)
      const data = await res.json()
      if (data.success && data.data) {
        setProfile(data.data.profile || data.data)
      } else if (data.success) {
        setProfile(null)
      } else {
        setError(data.error || '获取考研配置失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取考研配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const saveProfile = useCallback(async (profileData: Partial<StudyProfile>) => {
    try {
      const res = await fetch(API_ENDPOINTS.STUDY.PROFILE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })
      const data = await res.json()
      if (data.success) {
        setProfile(data.data?.profile || data.data || null)
        return { success: true }
      }
      return { success: false, error: data.error || '保存失败' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '保存失败' }
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  return { profile, loading, error, saveProfile, refetch: fetchProfile }
}

export function useStudyPlan() {
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(API_ENDPOINTS.STUDY.PLAN)
      const data = await res.json()
      if (data.success && data.data) {
        setPlan(data.data.plan || data.data)
      } else if (data.success) {
        setPlan(null)
      } else {
        setError(data.error || '获取学习计划失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取学习计划失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const createPlan = useCallback(async (planData: Partial<StudyPlan>) => {
    try {
      const res = await fetch(API_ENDPOINTS.STUDY.PLAN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      })
      const data = await res.json()
      if (data.success) {
        setPlan(data.data?.plan || data.data || null)
        return { success: true }
      }
      return { success: false, error: data.error || '创建计划失败' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '创建计划失败' }
    }
  }, [])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  return { plan, loading, error, createPlan, refetch: fetchPlan }
}

export function useStudyTasks(date?: string, subject?: Subject) {
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (date) params.set('date', date)
      if (subject) params.set('subject', subject)
      const query = params.toString()
      const url = query ? `${API_ENDPOINTS.STUDY.TASKS}?${query}` : API_ENDPOINTS.STUDY.TASKS
      const res = await fetch(url)
      const data = await res.json()
      if (data.success && data.data) {
        setTasks(data.data.tasks || data.data || [])
      } else if (data.success) {
        setTasks([])
      } else {
        setError(data.error || '获取任务列表失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取任务列表失败')
    } finally {
      setLoading(false)
    }
  }, [date, subject])

  const updateTaskStatus = useCallback(async (taskId: string, status: StudyTask['status']) => {
    try {
      const res = await fetch(API_ENDPOINTS.STUDY.TASK_DETAIL(taskId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.success) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
        return { success: true }
      }
      return { success: false, error: data.error || '更新状态失败' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '更新状态失败' }
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  return { tasks, loading, error, updateTaskStatus, refetch: fetchTasks }
}
