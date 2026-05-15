import { useState, useMemo, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'

export interface AdminModel {
    id: string
    name: string
    model_id: string
    base_url: string
    temperature: number
    capabilities: string[]
    priority: number
    enabled: boolean
    has_api_key: boolean
    api_key_id?: string
    api_key_name?: string
    updated_at?: string
}

export interface AdminApiKey {
    id: string
    name: string
    has_api_key: boolean
    updated_at?: string
}

export function useModels() {
    const [models, setModels] = useState<AdminModel[]>([])
    const [apiKeys, setApiKeys] = useState<AdminApiKey[]>([])
    const [loading, setLoading] = useState(true)
    const { toast } = useToast()

    const sortedModels = useMemo(
        () => [...models].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
        [models]
    )

    const apiKeyNameById = useMemo(() => {
        const map: Record<string, string> = {}
        for (const item of apiKeys) {
            map[item.id] = item.name
        }
        return map
    }, [apiKeys])

    const fetchData = useCallback(async () => {
        try {
            const [modelsResp, keysResp] = await Promise.all([
                fetch('/api/admin/models'),
                fetch('/api/admin/apikeys'),
            ])
            const modelsResult = await modelsResp.json()
            const keysResult = await keysResp.json()

            if (!modelsResp.ok) {
                throw new Error(modelsResult.error || modelsResult.message || '获取模型列表失败')
            }
            if (!keysResp.ok) {
                throw new Error(keysResult.error || keysResult.message || '获取 API Key 列表失败')
            }

            setModels(Array.isArray(modelsResult?.data) ? modelsResult.data : [])
            const keyRows = Array.isArray(keysResult?.data) ? keysResult.data : []
            setApiKeys(keyRows.filter((item: AdminApiKey) => item?.has_api_key))
        } catch (error) {
            toast({
                title: '加载后台配置失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }, [toast])

    const deleteModel = useCallback(async (model: AdminModel) => {
        if (!confirm(`确定要删除模型 "${model.name}" 吗？`)) return false
        try {
            const response = await fetch(`/api/admin/models/${model.id}`, { method: 'DELETE' })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '删除模型失败')
            toast({
                title: '模型删除成功',
                className: 'bg-green-50 border-green-200 text-green-800'
            })
            fetchData()
            return true
        } catch (error) {
            toast({
                title: '删除失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
            return false
        }
    }, [toast, fetchData])

    const toggleEnabled = useCallback(async (model: AdminModel, enabled: boolean) => {
        try {
            const response = await fetch(`/api/admin/models/${model.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: model.id,
                    name: model.name,
                    model_id: model.model_id,
                    base_url: model.base_url,
                    api_key_id: model.api_key_id || null,
                    temperature: model.temperature,
                    capabilities: model.capabilities,
                    priority: model.priority,
                    enabled
                })
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '更新启用状态失败')

            setModels((prev) => prev.map((item) => (item.id === model.id ? { ...item, enabled } : item)))
            return true
        } catch (error) {
            toast({
                title: '状态更新失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
            return false
        }
    }, [toast])

    return {
        models,
        sortedModels,
        apiKeys,
        apiKeyNameById,
        loading,
        fetchData,
        deleteModel,
        toggleEnabled,
        setLoading
    }
}
