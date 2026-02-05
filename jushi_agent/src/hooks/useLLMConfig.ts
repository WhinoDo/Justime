import { useState, useEffect, useCallback } from 'react'

export interface LLMConfig {
    apiKey: string
    modelName: string
    baseUrl: string
    temperature: number
}

const DEFAULT_CONFIG: LLMConfig = {
    apiKey: '',
    modelName: 'gpt-3.5-turbo',
    baseUrl: '',
    temperature: 0.7
}

const STORAGE_KEY = 'jushi_llm_config'

export function useLLMConfig() {
    const [config, setConfig] = useState<LLMConfig | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    // Load config from local storage
    useEffect(() => {
        const loadConfig = () => {
            try {
                const stored = localStorage.getItem(STORAGE_KEY)
                if (stored) {
                    setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) })
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
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 600))

            setConfig(prev => {
                const updated = { ...prev!, ...newConfig }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
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
            await new Promise(resolve => setTimeout(resolve, 600))
            localStorage.removeItem(STORAGE_KEY)
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
