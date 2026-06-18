'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { API_ENDPOINTS } from '@/lib/api/endpoints'
import type { AgentStatusResponse, AgentToolsResponse, AgentProvidersResponse } from '@/types/agent'
import { AgentStatusCard } from '@/components/agent/AgentStatusCard'
import { AgentToolList } from '@/components/agent/AgentToolList'
import { AgentProviderList } from '@/components/agent/AgentProviderList'
import { AgentRunPanel } from '@/components/agent/AgentRunPanel'

export default function AgentPage() {
  // 状态数据
  const [status, setStatus] = useState<AgentStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [tools, setTools] = useState<AgentToolsResponse['tools'] | null>(null)
  const [toolsLoading, setToolsLoading] = useState(true)
  const [toolsError, setToolsError] = useState<string | null>(null)

  const [providers, setProviders] = useState<AgentProvidersResponse['providers'] | null>(null)
  const [defaultProvider, setDefaultProvider] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)
  const [providersError, setProvidersError] = useState<string | null>(null)

  const [refreshing, setRefreshing] = useState(false)

  // 获取 Agent 状态
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AGENT.STATUS)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || json.message || '获取状态失败')

      // 后端返回可能是 { success: true, data: ... } 或直接返回数据
      setStatus(json.data || json)
      setStatusError(null)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : '获取状态失败')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  // 获取工具列表
  const fetchTools = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AGENT.TOOLS)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || json.message || '获取工具列表失败')

      const data = json.data || json
      setTools(data.tools || [])
      setToolsError(null)
    } catch (err) {
      setToolsError(err instanceof Error ? err.message : '获取工具列表失败')
    } finally {
      setToolsLoading(false)
    }
  }, [])

  // 获取提供者列表
  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AGENT.PROVIDERS)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || json.message || '获取提供者列表失败')

      const data = json.data || json
      setProviders(data.providers || [])
      setDefaultProvider(data.default_provider || null)
      setProvidersError(null)
    } catch (err) {
      setProvidersError(err instanceof Error ? err.message : '获取提供者列表失败')
    } finally {
      setProvidersLoading(false)
    }
  }, [])

  // 刷新所有数据
  const handleRefresh = async () => {
    setRefreshing(true)
    setStatusLoading(true)
    setToolsLoading(true)
    setProvidersLoading(true)

    await Promise.all([fetchStatus(), fetchTools(), fetchProviders()])
    setRefreshing(false)
  }

  // 初始加载
  useEffect(() => {
    fetchStatus()
    fetchTools()
    fetchProviders()
  }, [fetchStatus, fetchTools, fetchProviders])

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent 管理</h1>
          <p className="text-white/60 text-sm mt-1">管理和监控 AI Agent 运行状态</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white/80 hover:text-white border border-white/20 transition-colors text-sm"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          刷新
        </button>
      </div>

      {/* 状态卡片 + 工具列表 + 提供者列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AgentStatusCard status={status} loading={statusLoading} error={statusError} />
        <AgentToolList tools={tools} loading={toolsLoading} error={toolsError} />
        <AgentProviderList
          providers={providers}
          defaultProvider={defaultProvider}
          loading={providersLoading}
          error={providersError}
        />
      </div>

      {/* 任务执行面板 */}
      <AgentRunPanel providers={providers} />
    </div>
  )
}
