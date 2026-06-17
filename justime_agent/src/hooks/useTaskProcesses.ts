'use client'

import { useCallback, useEffect, useState } from 'react'
import { API_ENDPOINTS } from '@/lib/api/endpoints'
import type {
  Evidence,
  EvidenceCreatePayload,
  GenerateKnowledgePayload,
  KnowledgeRollbackPayload,
  KnowledgeOutput,
  KnowledgeOutputUpdatePayload,
  TaskProcess,
  TaskProcessCreatePayload,
  TaskProcessUpdatePayload,
  TimeLogCreatePayload,
} from '@/types/taskProcess'

interface UseTaskProcessesOptions {
  enabled?: boolean
  categories?: TaskProcess['category'][]
}

interface RequestResult<T> {
  success: boolean
  data?: T
  error?: string
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<RequestResult<T>> {
  try {
    const res = await fetch(input, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok || !payload?.success) {
      return { success: false, error: payload?.detail || payload?.error || '请求失败' }
    }
    return { success: true, data: payload.data as T }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '请求失败' }
  }
}

export function useTaskProcesses(options: UseTaskProcessesOptions = {}) {
  const { enabled = true, categories } = options
  const [tasks, setTasks] = useState<TaskProcess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const result = await requestJson<{ items: TaskProcess[] }>(API_ENDPOINTS.TASK_PROCESS.BASE)
    if (result.success) {
      const items = result.data?.items || []
      setTasks(categories?.length ? items.filter((item) => categories.includes(item.category)) : items)
    } else {
      setError(result.error || '获取任务失败')
    }
    setLoading(false)
  }, [categories, enabled])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const createTask = useCallback(async (payload: TaskProcessCreatePayload) => {
    const result = await requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.BASE, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.task) {
      setTasks((prev) => {
        if (categories?.length && !categories.includes(result.data!.task.category)) {
          return prev
        }
        return [result.data!.task, ...prev]
      })
    }
    return result
  }, [categories])

  const updateTask = useCallback(async (taskId: string, payload: TaskProcessUpdatePayload) => {
    const result = await requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.DETAIL(taskId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.task) {
      setTasks((prev) => {
        const nextTask = result.data!.task
        if (categories?.length && !categories.includes(nextTask.category)) {
          return prev.filter((item) => item.id !== taskId)
        }
        return prev.map((item) => (item.id === taskId ? nextTask : item))
      })
    }
    return result
  }, [categories])

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
  }
}

export function useTaskProcessDetail(taskId: string, enabled = true) {
  const [task, setTask] = useState<TaskProcess | null>(null)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [outputs, setOutputs] = useState<KnowledgeOutput[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled || !taskId) return
    setLoading(true)
    setError(null)
    const [taskResult, evidenceResult, outputsResult] = await Promise.all([
      requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.DETAIL(taskId)),
      requestJson<{ items: Evidence[] }>(API_ENDPOINTS.TASK_PROCESS.EVIDENCE(taskId)),
      requestJson<{ items: KnowledgeOutput[] }>(API_ENDPOINTS.TASK_PROCESS.KNOWLEDGE_OUTPUTS(taskId)),
    ])

    if (taskResult.success && taskResult.data?.task) {
      setTask(taskResult.data.task)
    } else {
      setError(taskResult.error || '获取任务详情失败')
    }

    if (evidenceResult.success) {
      setEvidence(evidenceResult.data?.items || [])
    }

    if (outputsResult.success) {
      setOutputs(outputsResult.data?.items || [])
    }

    setLoading(false)
  }, [enabled, taskId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateTask = useCallback(async (payload: TaskProcessUpdatePayload) => {
    const result = await requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.DETAIL(taskId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.task) {
      setTask(result.data.task)
    }
    return result
  }, [taskId])

  const createEvidence = useCallback(async (payload: EvidenceCreatePayload) => {
    const result = await requestJson<{ evidence: Evidence }>(API_ENDPOINTS.TASK_PROCESS.EVIDENCE(taskId), {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.evidence) {
      setEvidence((prev) => [result.data!.evidence, ...prev])
      await refresh()
    }
    return result
  }, [refresh, taskId])

  const createTimeLog = useCallback(async (payload: TimeLogCreatePayload) => {
    const result = await requestJson<{ evidence: Evidence }>(API_ENDPOINTS.TASK_PROCESS.TIME_LOG(taskId), {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.evidence) {
      setEvidence((prev) => [result.data!.evidence, ...prev])
      await refresh()
    }
    return result
  }, [refresh, taskId])

  const generateKnowledgeOutput = useCallback(async (payload: GenerateKnowledgePayload) => {
    const result = await requestJson<{ knowledge_output: KnowledgeOutput }>(API_ENDPOINTS.TASK_PROCESS.GENERATE_KNOWLEDGE(taskId), {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.knowledge_output) {
      setOutputs((prev) => [result.data!.knowledge_output, ...prev.filter((item) => item.id !== result.data!.knowledge_output.id)])
      await refresh()
    }
    return result
  }, [refresh, taskId])

  const updateKnowledgeOutput = useCallback(async (outputId: string, payload: KnowledgeOutputUpdatePayload) => {
    const result = await requestJson<{ knowledge_output: KnowledgeOutput }>(API_ENDPOINTS.TASK_PROCESS.KNOWLEDGE_OUTPUT_DETAIL(outputId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.knowledge_output) {
      setOutputs((prev) => prev.map((item) => (item.id === outputId ? result.data!.knowledge_output : item)))
      await refresh()
    }
    return result
  }, [refresh])

  const publishKnowledgeOutput = useCallback(async (outputId: string) => {
    const result = await requestJson<{ knowledge_output: KnowledgeOutput }>(API_ENDPOINTS.TASK_PROCESS.PUBLISH_KNOWLEDGE(outputId), {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (result.success && result.data?.knowledge_output) {
      setOutputs((prev) => prev.map((item) => (item.id === outputId ? result.data!.knowledge_output : item)))
      await refresh()
    }
    return result
  }, [refresh])

  const rollbackKnowledgeOutput = useCallback(async (outputId: string, payload: KnowledgeRollbackPayload) => {
    const result = await requestJson<{ knowledge_output: KnowledgeOutput }>(API_ENDPOINTS.TASK_PROCESS.ROLLBACK_KNOWLEDGE(outputId), {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.knowledge_output) {
      setOutputs((prev) => prev.map((item) => (item.id === outputId ? result.data!.knowledge_output : item)))
      await refresh()
    }
    return result
  }, [refresh])

  return {
    task,
    evidence,
    outputs,
    loading,
    error,
    refresh,
    updateTask,
    createEvidence,
    createTimeLog,
    generateKnowledgeOutput,
    updateKnowledgeOutput,
    publishKnowledgeOutput,
    rollbackKnowledgeOutput,
  }
}
