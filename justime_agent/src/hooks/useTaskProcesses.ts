'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_ENDPOINTS } from '@/lib/api/endpoints'
import type {
  Evidence,
  EvidenceCreatePayload,
  GenerateKnowledgePayload,
  KnowledgeRollbackPayload,
  KnowledgeOutput,
  KnowledgeOutputUpdatePayload,
  PreparationItem,
  TaskProcess,
  TaskCategory,
  TaskProcessCreatePayload,
  TaskPhase,
  TaskPriority,
  TaskStatus,
  TaskProcessUpdatePayload,
  TimeLogCreatePayload,
} from '@/types/taskProcess'

export type TaskProcessSortBy = 'createdAt' | 'updatedAt' | 'deadline' | 'priority' | 'progress'
export type TaskProcessSortOrder = 'asc' | 'desc'

export interface TaskProcessListQuery {
  status?: TaskStatus | ''
  phase?: TaskPhase | ''
  category?: TaskCategory | ''
  priority?: TaskPriority | ''
  search?: string
  sort_by?: TaskProcessSortBy
  sort_order?: TaskProcessSortOrder
  page?: number
  page_size?: number
}

interface UseTaskProcessesOptions extends TaskProcessListQuery {
  enabled?: boolean
}

interface TaskProcessListResponse {
  items: TaskProcess[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

interface RequestResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface CommittedTaskSearch {
  value: string
  page: number
}

interface ImmediateTaskQuery {
  status: TaskStatus | ''
  phase: TaskPhase | ''
  category: TaskCategory | ''
  priority: TaskPriority | ''
  sortBy: TaskProcessSortBy
  sortOrder: TaskProcessSortOrder
  pageSize: number
}

interface TaskRequestContext {
  taskId: string
  queue: Promise<void>
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
  const {
    enabled = true,
    status = '',
    phase = '',
    category = '',
    priority = '',
    search = '',
    sort_by = 'updatedAt',
    sort_order = 'desc',
    page = 1,
    page_size = 20,
  } = options
  const [tasks, setTasks] = useState<TaskProcess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [committedSearch, setCommittedSearch] = useState<CommittedTaskSearch>({
    value: search.trim(),
    page,
  })
  const [pagination, setPagination] = useState({
    total: 0,
    page,
    pageSize: page_size,
    totalPages: 0,
  })
  const requestIdRef = useRef(0)
  const immediateQueryRef = useRef<ImmediateTaskQuery>({
    status,
    phase,
    category,
    priority,
    sortBy: sort_by,
    sortOrder: sort_order,
    pageSize: page_size,
  })
  const trimmedSearch = search.trim()
  const searchPending = trimmedSearch !== committedSearch.value
  const previousImmediateQuery = immediateQueryRef.current
  const immediateQueryChanged = previousImmediateQuery.status !== status
    || previousImmediateQuery.phase !== phase
    || previousImmediateQuery.category !== category
    || previousImmediateQuery.priority !== priority
    || previousImmediateQuery.sortBy !== sort_by
    || previousImmediateQuery.sortOrder !== sort_order
    || previousImmediateQuery.pageSize !== page_size

  useEffect(() => {
    immediateQueryRef.current = {
      status,
      phase,
      category,
      priority,
      sortBy: sort_by,
      sortOrder: sort_order,
      pageSize: page_size,
    }

    if ((searchPending && !immediateQueryChanged) || committedSearch.page === page) return

    setCommittedSearch((current) => ({ ...current, page }))
  }, [category, committedSearch.page, immediateQueryChanged, page, page_size, phase, priority, searchPending, sort_by, sort_order, status])

  useEffect(() => {
    if (!searchPending) return

    const timer = window.setTimeout(() => {
      setCommittedSearch({ value: trimmedSearch, page })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [page, searchPending, trimmedSearch])

  const requestPage = searchPending && !immediateQueryChanged ? committedSearch.page : page

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (phase) params.set('phase', phase)
    if (category) params.set('category', category)
    if (priority) params.set('priority', priority)
    if (committedSearch.value) params.set('search', committedSearch.value)
    params.set('sort_by', sort_by)
    params.set('sort_order', sort_order)
    params.set('page', String(requestPage))
    params.set('page_size', String(page_size))
    return params.toString()
  }, [category, committedSearch.value, page_size, phase, priority, requestPage, sort_by, sort_order, status])

  const fetchTasks = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    const result = await requestJson<TaskProcessListResponse>(API_ENDPOINTS.TASK_PROCESS.LIST(queryString))
    if (requestId !== requestIdRef.current) return
    if (result.success) {
      const data = result.data
      setTasks(data?.items || [])
      setPagination({
        total: data?.total || 0,
        page: data?.page || requestPage,
        pageSize: data?.page_size || page_size,
        totalPages: data?.total_pages || 0,
      })
    } else {
      setError(result.error || '获取任务失败')
    }
    setLoading(false)
  }, [enabled, page_size, queryString, requestPage])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const createTask = useCallback(async (payload: TaskProcessCreatePayload) => {
    const result = await requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.BASE, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.task) {
      await fetchTasks()
    }
    return result
  }, [fetchTasks])

  const updateTask = useCallback(async (taskId: string, payload: TaskProcessUpdatePayload) => {
    const result = await requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.DETAIL(taskId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (result.success && result.data?.task) {
      await fetchTasks()
    }
    return result
  }, [fetchTasks])

  return {
    tasks,
    loading,
    error,
    total: pagination.total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: pagination.totalPages,
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
  const taskRequestContextRef = useRef<TaskRequestContext>({
    taskId,
    queue: Promise.resolve(),
  })
  if (taskRequestContextRef.current.taskId !== taskId) {
    taskRequestContextRef.current = {
      taskId,
      queue: Promise.resolve(),
    }
  }
  const taskRequestContext = taskRequestContextRef.current

  const enqueueTaskRequest = useCallback((
    request: () => Promise<RequestResult<{ task: TaskProcess }>>,
  ) => {
    const queuedRequest = taskRequestContext.queue.then(async () => {
      const result = await request()
      if (
        taskRequestContextRef.current === taskRequestContext
        && result.success
        && result.data?.task
      ) {
        setTask(result.data.task)
      }
      return result
    })

    taskRequestContext.queue = queuedRequest.then(() => undefined, () => undefined)
    return queuedRequest
  }, [taskRequestContext])

  const refresh = useCallback(async () => {
    if (!enabled || !taskId || taskRequestContextRef.current !== taskRequestContext) return
    setLoading(true)
    setError(null)
    const [taskResult, evidenceResult, outputsResult] = await Promise.all([
      enqueueTaskRequest(() => requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.DETAIL(taskId))),
      requestJson<{ items: Evidence[] }>(API_ENDPOINTS.TASK_PROCESS.EVIDENCE(taskId)),
      requestJson<{ items: KnowledgeOutput[] }>(API_ENDPOINTS.TASK_PROCESS.KNOWLEDGE_OUTPUTS(taskId)),
    ])

    if (taskRequestContextRef.current !== taskRequestContext) return

    if (!taskResult.success || !taskResult.data?.task) {
      setError(taskResult.error || '获取任务详情失败')
    }

    if (evidenceResult.success) {
      setEvidence(evidenceResult.data?.items || [])
    }

    if (outputsResult.success) {
      setOutputs(outputsResult.data?.items || [])
    }

    setLoading(false)
  }, [enabled, enqueueTaskRequest, taskId, taskRequestContext])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateTask = useCallback((payload: TaskProcessUpdatePayload) => enqueueTaskRequest(() => (
    requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.DETAIL(taskId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  )), [enqueueTaskRequest, taskId])

  const updatePreparationItems = useCallback((items: PreparationItem[]) => enqueueTaskRequest(() => (
    requestJson<{ task: TaskProcess }>(API_ENDPOINTS.TASK_PROCESS.DETAIL(taskId), {
      method: 'PATCH',
      body: JSON.stringify({ preparation_items: items }),
    })
  )), [enqueueTaskRequest, taskId])

  const updateMilestoneStatus = useCallback((
    milestoneId: string,
    status: TaskProcess['milestones'][number]['status'],
  ) => enqueueTaskRequest(() => (
    requestJson<{ task: TaskProcess }>(
      API_ENDPOINTS.TASK_PROCESS.MILESTONE(taskId, milestoneId),
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    )
  )), [enqueueTaskRequest, taskId])

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
    updatePreparationItems,
    updateMilestoneStatus,
    createEvidence,
    createTimeLog,
    generateKnowledgeOutput,
    updateKnowledgeOutput,
    publishKnowledgeOutput,
    rollbackKnowledgeOutput,
  }
}
