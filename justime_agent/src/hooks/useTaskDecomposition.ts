/**
 * 任务分解状态管理 Hook
 * 从 ChatInterface 中提取，管理任务分解和日程建议的状态
 */

import { useState, useCallback } from 'react'
import { TaskItem } from '@/lib/ai/task-planner'
import { SuggestedCalendarEvent } from '@/types'

export interface TaskDecomposition {
  project?: {
    name: string
    description?: string
    total_days?: number
    start_date?: string
  }
  subtasks?: Array<{
    title: string
    description?: string
    duration_hours: number
    order?: number
    resources?: Array<{ title: string; url: string }>
  }>
}

export interface TaskDecompositionState {
  pendingTasks: TaskItem[]
  taskMessageId: string | null
  taskDecomposition: TaskDecomposition | null
  decompositionMessageId: string | null
  multiTaskDecompositions: TaskDecomposition[] | null
  expandedDecompositionId: string | null
  suggestedEvents: SuggestedCalendarEvent[]
  eventMessageId: string | null
  timingStrategy: any | null
  taskAnalysis: any | null
}

export interface UseTaskDecompositionReturn {
  state: TaskDecompositionState
  setPendingTasks: (tasks: TaskItem[]) => void
  setTaskMessageId: (id: string | null) => void
  setTaskDecomposition: (decomposition: TaskDecomposition | null) => void
  setDecompositionMessageId: (id: string | null) => void
  setMultiTaskDecompositions: (decompositions: TaskDecomposition[] | null) => void
  setExpandedDecompositionId: (id: string | null) => void
  setSuggestedEvents: (events: SuggestedCalendarEvent[]) => void
  setEventMessageId: (id: string | null) => void
  setTimingStrategy: (strategy: any | null) => void
  setTaskAnalysis: (analysis: any | null) => void
  removePendingTask: (taskTitle: string) => void
  removeSuggestedEvent: (eventTitle: string) => void
  reset: () => void
}

const initialState: TaskDecompositionState = {
  pendingTasks: [],
  taskMessageId: null,
  taskDecomposition: null,
  decompositionMessageId: null,
  multiTaskDecompositions: null,
  expandedDecompositionId: null,
  suggestedEvents: [],
  eventMessageId: null,
  timingStrategy: null,
  taskAnalysis: null
}

export function useTaskDecomposition(): UseTaskDecompositionReturn {
  const [state, setState] = useState<TaskDecompositionState>(initialState)

  const setPendingTasks = useCallback((tasks: TaskItem[]) => {
    setState(prev => ({ ...prev, pendingTasks: tasks }))
  }, [])

  const setTaskMessageId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, taskMessageId: id }))
  }, [])

  const setTaskDecomposition = useCallback((decomposition: TaskDecomposition | null) => {
    setState(prev => ({ ...prev, taskDecomposition: decomposition }))
  }, [])

  const setDecompositionMessageId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, decompositionMessageId: id }))
  }, [])

  const setMultiTaskDecompositions = useCallback((decompositions: TaskDecomposition[] | null) => {
    setState(prev => ({ ...prev, multiTaskDecompositions: decompositions }))
  }, [])

  const setExpandedDecompositionId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, expandedDecompositionId: id }))
  }, [])

  const setSuggestedEvents = useCallback((events: SuggestedCalendarEvent[]) => {
    setState(prev => ({ ...prev, suggestedEvents: events }))
  }, [])

  const setEventMessageId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, eventMessageId: id }))
  }, [])

  const setTimingStrategy = useCallback((strategy: any | null) => {
    setState(prev => ({ ...prev, timingStrategy: strategy }))
  }, [])

  const setTaskAnalysis = useCallback((analysis: any | null) => {
    setState(prev => ({ ...prev, taskAnalysis: analysis }))
  }, [])

  const removePendingTask = useCallback((taskTitle: string) => {
    setState(prev => ({
      ...prev,
      pendingTasks: prev.pendingTasks.filter(t => t.title !== taskTitle)
    }))
  }, [])

  const removeSuggestedEvent = useCallback((eventTitle: string) => {
    setState(prev => ({
      ...prev,
      suggestedEvents: prev.suggestedEvents.filter(e => e.title !== eventTitle)
    }))
  }, [])

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    state,
    setPendingTasks,
    setTaskMessageId,
    setTaskDecomposition,
    setDecompositionMessageId,
    setMultiTaskDecompositions,
    setExpandedDecompositionId,
    setSuggestedEvents,
    setEventMessageId,
    setTimingStrategy,
    setTaskAnalysis,
    removePendingTask,
    removeSuggestedEvent,
    reset
  }
}
