import { useState, useEffect, useCallback } from 'react'

export interface LLMConfig {
    apiKey: string
    modelName: string
    baseUrl: string
    temperature: number
}

const DEFAULT_CONFIG: LLMConfig = {
    apiKey: '',
    modelName: '',
    baseUrl: '',
    temperature: 0.7
}

export interface ConfigItem {
    id: string;
    name: string;
    modelId: string;
    baseUrl?: string;
    apiKey?: string;
    temperature?: number;
    isActive: boolean;
}

const STORAGE_KEY = 'jushi_llm_config'

export function useLLMConfig() {
    const [config, setConfig] = useState<LLMConfig | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    // Load config from backend
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await fetch('/api/auth/llm-config', {
                    headers: { 'Cache-Control': 'no-cache' },
                    credentials: 'include'
                })
                const result = await response.json()

                if (result.success && result.data?.llmConfig) {
                    const apiConfig = result.data.llmConfig
                    setConfig({
                        apiKey: apiConfig.apiKey || '',
                        modelName: apiConfig.modelId || '',
                        baseUrl: apiConfig.baseUrl || '',
                        temperature: apiConfig.temperature ?? 0.7
                    })
                } else {
                    setConfig(DEFAULT_CONFIG)
                }
            } catch (err) {
                console.error('Failed to load LLM config', err)
                setError(err instanceof Error ? err : new Error('Failed to load config'))
                setConfig(DEFAULT_CONFIG)
            } finally {
                setIsLoading(false)
            }
        }

        // Slight delay to prevent hydration mismatch if we were using it there, 
        // and to allow the fancy loading state to show up briefly.
        setTimeout(loadConfig, 500)
    }, [])

    const updateConfig = useCallback(async (newConfig: Partial<LLMConfig>) => {
        setIsLoading(true)
        try {
            const payload = {
                apiKey: newConfig.apiKey,
                modelId: newConfig.modelName,
                baseUrl: newConfig.baseUrl,
                temperature: newConfig.temperature
            }

            const response = await fetch('/api/auth/llm-config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            })

            const result = await response.json()
            if (!result.success) {
                throw new Error(result.error || result.message || 'Failed to update config')
            }

            setConfig(prev => {
                const updated = { ...prev!, ...newConfig }
                return updated
            })
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to update config'))
            throw err
        } finally {
            setIsLoading(false)
        }
    }, [])

    const resetConfig = useCallback(async () => {
        setIsLoading(true)
        try {
            const payload = {
                apiKey: DEFAULT_CONFIG.apiKey,
                modelId: DEFAULT_CONFIG.modelName,
                baseUrl: DEFAULT_CONFIG.baseUrl,
                temperature: DEFAULT_CONFIG.temperature
            }

            const response = await fetch('/api/auth/llm-config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            })

            const result = await response.json()
            if (!result.success) {
                throw new Error(result.error || result.message || 'Failed to reset config')
            }

            setConfig(DEFAULT_CONFIG)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to reset config'))
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        config,
        updateConfig,
        resetConfig,
        isLoading,
        error
    }
}

export function useLLMConfigs() {
    const [configs, setConfigs] = useState<ConfigItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const loadConfigs = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/auth/llm-configs', {
                headers: { 'Cache-Control': 'no-cache' },
                credentials: 'include'
            })
            const result = await response.json()
            if (result.success && Array.isArray(result.data)) {
                setConfigs(result.data)
            } else if (result.success && Array.isArray(result.data?.configs)) {
                setConfigs(result.data.configs)
            } else {
                setConfigs([])
            }
        } catch (err) {
            console.error('Failed to load LLM configs', err)
            setError(err instanceof Error ? err : new Error('Failed to load configs'))
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadConfigs()
    }, [loadConfigs])

    const addConfig = async (newConfig: Partial<ConfigItem>) => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/auth/llm-configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
                credentials: 'include'
            })
            const result = await response.json()
            if (!result.success) throw new Error(result.error || 'Failed to add config')
            await loadConfigs()
            return result.data
        } finally {
            setIsLoading(false)
        }
    }

    const updateConfig = async (id: string, updates: Partial<ConfigItem>) => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/auth/llm-configs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
                credentials: 'include'
            })
            const result = await response.json()
            if (!result.success) throw new Error(result.error || 'Failed to update config')
            await loadConfigs()
        } finally {
            setIsLoading(false)
        }
    }

    const deleteConfig = async (id: string) => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/auth/llm-configs/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            const result = await response.json()
            if (!result.success) throw new Error(result.error || 'Failed to delete config')
            await loadConfigs()
        } finally {
            setIsLoading(false)
        }
    }

    const setActiveConfig = async (id: string) => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/auth/llm-configs/${id}/active`, {
                method: 'PUT',
                credentials: 'include'
            })
            const result = await response.json()
            if (!result.success) throw new Error(result.error || 'Failed to activate config')
            await loadConfigs()
        } finally {
            setIsLoading(false)
        }
    }

    return {
        configs,
        isLoading,
        error,
        loadConfigs,
        addConfig,
        updateConfig,
        deleteConfig,
        setActiveConfig
    }
}
