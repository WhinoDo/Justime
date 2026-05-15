/**
 * 模型选择状态管理 Hook
 * 从 ChatInterface 中提取，管理 LLM 模型的选择和加载逻辑
 */

import { useState, useCallback, useEffect } from 'react'

export interface ModelInfo {
  id: string
  name: string
}

export interface ModelState {
  selectedModel: string
  availableModels: ModelInfo[]
  error: string | null
}

export interface UseModelSelectionReturn {
  selectedModel: string
  availableModels: ModelInfo[]
  modelError: string | null
  setSelectedModel: (modelId: string) => void
  loadProviderModels: () => Promise<void>
}

export function useModelSelection(): UseModelSelectionReturn {
  const [state, setState] = useState<ModelState>({
    selectedModel: '',
    availableModels: [],
    error: null
  })

  const loadProviderModels = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/llm-configs', {
        credentials: 'include',
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success && result.data?.configs && Array.isArray(result.data.configs)) {
        const activeConfigs = result.data.configs.filter((c: any) => c.enabled !== false)
        const models: ModelInfo[] = activeConfigs.map((c: any) => ({
          id: c.modelId,
          name: c.name || c.modelId
        }))

        const defaultActive = activeConfigs.find((c: any) => c.isActive)
        const defaultModelId = defaultActive?.modelId || (models.length > 0 ? models[0].id : '')

        setState(prev => ({
          selectedModel: prev.selectedModel || defaultModelId,
          availableModels: models,
          error: null
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || '获取模型配置列表失败'
        }))
      }
    } catch (err) {
      console.error('加载模型配置失败:', err)
      setState(prev => ({
        ...prev,
        error: '加载模型配置失败'
      }))
    }
  }, [])

  const setSelectedModel = useCallback((modelId: string) => {
    setState(prev => ({
      ...prev,
      selectedModel: modelId
    }))
  }, [])

  return {
    selectedModel: state.selectedModel,
    availableModels: state.availableModels,
    modelError: state.error,
    setSelectedModel,
    loadProviderModels
  }
}
