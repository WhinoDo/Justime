'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { useLLMConfigs } from '@/hooks/useLLMConfig'
import { BarChart3, Bot, ChevronLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

// Usage Types
interface DailyUsagePoint {
  date: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requests: number
  missingUsageRequests: number
}

interface ModelUsage {
  configId: string
  name: string
  modelId: string
  isActive: boolean
  totalTokens: number
  totalRequests: number
  missingUsageRequests: number
  sourceCoverage?: number
  daily: DailyUsagePoint[]
}

type DailyUsageLike = Record<string, unknown>

const TEMP_SAVE_DEBOUNCE_MS = 500

const clampTemperature = (value: number) => {
  if (!Number.isFinite(value)) return 0.7
  return Math.min(2, Math.max(0, value))
}

function ModelConfigContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { configs, updateConfig, isLoading: configsLoading } = useLLMConfigs()
  const searchParams = useSearchParams()

  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [usageModels, setUsageModels] = useState<ModelUsage[]>([])
  const [usageNote, setUsageNote] = useState('')
  const [usageDays, setUsageDays] = useState(14)
  const [usageScope, setUsageScope] = useState<'primary' | 'all'>('primary')
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [tempValue, setTempValue] = useState(0.7)
  const [tempSaving, setTempSaving] = useState(false)
  const [tempError, setTempError] = useState<string | null>(null)
  const [tempSuccess, setTempSuccess] = useState<string | null>(null)
  const tempSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fromPath = searchParams.get('from') || '/dashboard'

  const isGPTModel = (modelId?: string) => modelId?.toLowerCase().includes('gpt') ?? false
  const filteredConfigs = useMemo(() => configs.filter((config) => !isGPTModel(config.modelId)), [configs])
  const filteredUsageModels = useMemo(() => usageModels.filter((model) => !isGPTModel(model.modelId)), [usageModels])
  const usageByConfigId = useMemo(() => new Map(filteredUsageModels.map((model) => [model.configId, model])), [filteredUsageModels])
  const hasAvailableModels = filteredConfigs.length > 0
  const selectedConfig = useMemo(() => filteredConfigs.find((config) => config.id === selectedModelId) ?? null, [filteredConfigs, selectedModelId])
  const selectedUsageModel = useMemo(() => filteredUsageModels.find((model) => model.configId === selectedModelId) ?? null, [filteredUsageModels, selectedModelId])
  const usageSummary = useMemo(() =>
    filteredUsageModels.reduce((s, m) => ({ totalTokens: s.totalTokens + m.totalTokens, totalRequests: s.totalRequests + m.totalRequests }), { totalTokens: 0, totalRequests: 0 }),
    [filteredUsageModels]
  )

  const loadTokenUsage = async () => {
    if (!isAuthenticated) return
    setUsageLoading(true)
    setUsageError(null)
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LLM_USAGE_DAILY(usageDays, usageScope), { credentials: 'include', cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message || result.message || '加载 token 使用量失败')
      const models = Array.isArray(result.data?.models) ? result.data.models : []
      setUsageModels(models)
      setUsageNote(result.data?.note || '')
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : '加载模型 token 使用量失败')
      setUsageModels([])
    } finally { setUsageLoading(false) }
  }

  useEffect(() => { if (isAuthenticated) loadTokenUsage() }, [isAuthenticated, usageDays, usageScope])
  useEffect(() => { if (selectedModelId && !filteredConfigs.some((c) => c.id === selectedModelId)) setSelectedModelId(null) }, [selectedModelId, filteredConfigs])
  useEffect(() => {
    if (!selectedConfig) { setTempValue(0.7); setTempError(null); setTempSuccess(null); return }
    setTempValue(clampTemperature(selectedConfig.temperature ?? 0.7))
    setTempError(null); setTempSuccess(null)
  }, [selectedConfig?.id, selectedConfig?.temperature])

  useEffect(() => {
    if (tempSaveTimeoutRef.current) clearTimeout(tempSaveTimeoutRef.current)
    if (!selectedConfig) { setTempSaving(false); return }
    const savedTemp = clampTemperature(selectedConfig.temperature ?? 0.7)
    if (Math.abs(savedTemp - tempValue) < 0.001) { setTempSaving(false); return }
    tempSaveTimeoutRef.current = setTimeout(async () => {
      setTempSaving(true); setTempError(null)
      try {
        await updateConfig(selectedConfig.id, { temperature: tempValue })
        setTempSuccess('已自动保存')
        if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current)
        saveFeedbackTimeoutRef.current = setTimeout(() => setTempSuccess(null), 1500)
      } catch (error) { setTempError(error instanceof Error ? error.message : '自动保存失败') }
      finally { setTempSaving(false) }
    }, TEMP_SAVE_DEBOUNCE_MS)
    return () => { if (tempSaveTimeoutRef.current) clearTimeout(tempSaveTimeoutRef.current) }
  }, [tempValue, selectedConfig, updateConfig])

  useEffect(() => { return () => { if (tempSaveTimeoutRef.current) clearTimeout(tempSaveTimeoutRef.current); if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current) } }, [])

  const formatTokenValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return `${value}`
  }

  const handleSelectModel = (id: string) => setSelectedModelId((prev) => (prev === id ? null : id))
  const handleTempInput = (value: number) => { setTempValue(clampTemperature(value)); setTempError(null); setTempSuccess(null) }

  const renderUsageModelCard = (model: ModelUsage) => {
    const rawDaily: DailyUsageLike[] = Array.isArray(model.daily) ? (model.daily as unknown as DailyUsageLike[]) : []
    const normalizedDaily: DailyUsagePoint[] = rawDaily.map((point, index) => ({
      date: String(point['date'] ?? point['day'] ?? `D${index + 1}`),
      promptTokens: Number(point['promptTokens'] ?? point['prompt_tokens'] ?? 0),
      completionTokens: Number(point['completionTokens'] ?? point['completion_tokens'] ?? 0),
      totalTokens: Number(point['totalTokens'] ?? point['total_tokens'] ?? 0),
      requests: Number(point['requests'] ?? point['requestCount'] ?? point['request_count'] ?? 0),
      missingUsageRequests: Number(point['missingUsageRequests'] ?? point['missing_usage_requests'] ?? 0)
    }))
    const dailyPoints = normalizedDaily.length > 0 ? normalizedDaily : [{ date: '总计', promptTokens: 0, completionTokens: 0, totalTokens: Number(model.totalTokens ?? 0), requests: Number(model.totalRequests ?? 0), missingUsageRequests: Number(model.missingUsageRequests ?? 0) }]
    const maxToken = Math.max(...dailyPoints.map((p) => p.totalTokens), 1)

    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{model.name}</p>
              {model.isActive && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">使用中</span>}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{model.modelId || '无模型标识'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-700 dark:text-gray-300">累计: <span className="font-semibold text-purple-600 dark:text-purple-400">{formatTokenValue(model.totalTokens)}</span> T</p>
            <p className="text-xs text-gray-400">请求: {model.totalRequests}</p>
          </div>
        </div>

        {/* macOS-style bar chart */}
        <div className="h-28 flex items-end gap-1.5">
          {dailyPoints.map((point) => {
            const barHeight = point.totalTokens > 0 ? Math.max(3, Math.round((point.totalTokens / maxToken) * 100)) : 0
            return (
              <div key={`${model.configId}-${point.date}`} className="flex-1 h-full relative group cursor-default">
                <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none bg-gray-900 dark:bg-gray-700 text-white text-[10px] px-2 py-1.5 rounded whitespace-nowrap z-10 transition-opacity shadow-sm">
                  {point.date}<br />{point.totalTokens} tokens<br />{point.requests} requests
                </div>
                {barHeight > 0 && (
                  <div className="absolute left-1/2 -translate-x-1/2 text-[8px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap pointer-events-none select-none"
                    style={{ bottom: `calc(${Math.min(barHeight, 100)}% + 4px)` }}>
                    {formatTokenValue(point.totalTokens)}
                  </div>
                )}
                <div className="h-full rounded-sm bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 rounded-sm bg-purple-400/80 dark:bg-purple-500/70 transition-all group-hover:bg-purple-500 group-hover:shadow-[0_0_8px_rgba(168,85,247,0.4)]" style={{ height: `${barHeight}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (authLoading || (configsLoading && configs.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
        <div className="flex flex-col items-center gap-3">
          <Bot className="h-8 w-8 text-purple-500/70 animate-pulse" />
          <p className="text-gray-400 dark:text-gray-500 text-sm font-light tracking-widest uppercase">加载配置中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10 animate-mac-fade-in">
        {/* macOS-style nav */}
        <div className="flex items-center justify-between mb-6">
          <Link href={fromPath}>
            <Button variant="ghost" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800 gap-2 pl-2 rounded-lg">
              <ChevronLeft className="h-4 w-4" /><span className="text-sm">返回</span>
            </Button>
          </Link>
        </div>

        {/* macOS Preferences-style layout */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl overflow-hidden flex flex-col md:flex-row min-h-[700px]">
          {/* Left Sidebar - macOS Finder style list */}
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">模型配置库</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">选择您的 AI 助手</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredConfigs.map((config) => {
                const modelUsage = usageByConfigId.get(config.id)
                const isSelected = selectedModelId === config.id
                return (
                  <div key={config.id} onClick={() => handleSelectModel(config.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/10 shadow-sm'
                        : config.isActive
                          ? 'border-purple-300 dark:border-purple-500/40 bg-purple-50/50 dark:bg-purple-500/5'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}>
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-6">{config.name || '未命名'}</h3>
                      {config.isActive && <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] flex-shrink-0" title="当前激活" />}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate font-mono">{config.modelId}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-1.5">
                      Token: <span className="text-purple-600 dark:text-purple-400 font-medium">{formatTokenValue(modelUsage?.totalTokens ?? 0)}</span> · {modelUsage?.totalRequests ?? 0} 次
                    </p>
                  </div>
                )
              })}
              {filteredConfigs.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400">暂无可用模型，请等待系统管理员配置。</div>
              )}
            </div>
          </div>

          {/* Right Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 md:p-8 flex-1 overflow-y-auto">
              {!hasAvailableModels ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">模型使用情况</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">暂无可用模型，请等待系统管理员配置。</p>
                </div>
              ) : (
                <>
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">模型使用情况</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {selectedConfig ? `当前聚焦: ${selectedConfig.name || selectedConfig.modelId || '未命名模型'}` : '当前显示所有非 GPT 模型的汇总统计'}
                    </p>
                  </div>

                  <div className="mt-6 space-y-5 max-w-4xl">
                    {/* macOS toolbar-style filter bar */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-purple-500" />
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">模型 Token 统计表</h2>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setUsageScope('primary')}
                          className={`h-8 px-3 rounded-lg text-xs font-medium transition-all ${usageScope === 'primary' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                          主对话链路
                        </button>
                        <button onClick={() => setUsageScope('all')}
                          className={`h-8 px-3 rounded-lg text-xs font-medium transition-all ${usageScope === 'all' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                          包含Agent总计
                        </button>
                        {[7, 14, 30].map((days) => (
                          <button key={days} onClick={() => setUsageDays(days)}
                            className={`h-8 px-3 rounded-lg text-xs font-medium transition-all ${usageDays === days ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                            {days}天
                          </button>
                        ))}
                        {selectedModelId && (
                          <button onClick={() => setSelectedModelId(null)}
                            className="h-8 px-3 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-all">
                            查看全部
                          </button>
                        )}
                      </div>
                    </div>

                    {usageNote && <p className="text-xs text-gray-400">{usageNote}</p>}
                    {usageError && (
                      <Alert className="bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-lg">
                        <AlertDescription>{usageError}</AlertDescription>
                      </Alert>
                    )}
                    {usageLoading && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-500" />正在加载模型 Token 统计...
                      </div>
                    )}
                    {!usageLoading && filteredUsageModels.length === 0 && !usageError && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3">
                        暂无模型使用数据。开始与 AI 助手对话以生成统计记录。
                      </div>
                    )}
                    {!usageLoading && !usageError && !selectedModelId && filteredUsageModels.length > 0 && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">全部模型汇总（不含 GPT）</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                            <p className="text-xs text-gray-400">模型数量</p>
                            <p className="text-base font-semibold text-purple-600 dark:text-purple-400">{filteredUsageModels.length}</p>
                          </div>
                          <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                            <p className="text-xs text-gray-400">累计 Token</p>
                            <p className="text-base font-semibold text-purple-600 dark:text-purple-400">{formatTokenValue(usageSummary.totalTokens)}</p>
                          </div>
                          <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                            <p className="text-xs text-gray-400">总请求次数</p>
                            <p className="text-base font-semibold text-purple-600 dark:text-purple-400">{usageSummary.totalRequests}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {!usageLoading && !usageError && !selectedModelId && filteredUsageModels.length > 0 && (
                      <div className="space-y-3">{filteredUsageModels.map((model) => <div key={model.configId}>{renderUsageModelCard(model)}</div>)}</div>
                    )}
                    {!usageLoading && !usageError && selectedModelId && !selectedUsageModel && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3">当前选中模型暂无 Token 使用记录。</div>
                    )}
                    {!usageLoading && !usageError && selectedUsageModel && <div className="space-y-3">{renderUsageModelCard(selectedUsageModel)}</div>}
                  </div>

                  {/* macOS Slider */}
                  <div className="mt-8 max-w-4xl">
                    {selectedConfig ? (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-4">
                        <div>
                          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Temperature 参数设置</h2>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            当前模型: {selectedConfig.name || selectedConfig.modelId || '未命名模型'}
                          </p>
                        </div>
                        <div className="space-y-3">
                          {/* macOS-style Slider */}
                          <div className="flex items-center gap-4">
                            <div className="flex-1 relative h-6 flex items-center">
                              <input
                                type="range"
                                min={0}
                                max={2}
                                step={0.1}
                                value={tempValue}
                                onChange={(event) => handleTempInput(Number(event.target.value))}
                                disabled={tempSaving}
                                className="mac-slider w-full"
                              />
                            </div>
                            <Input
                              type="number" min={0} max={2} step={0.1}
                              value={tempValue}
                              onChange={(event) => { const v = Number.parseFloat(event.target.value); if (!Number.isNaN(v)) handleTempInput(v) }}
                              className="w-20 h-9 text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg"
                              disabled={tempSaving}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <span>0.0 更确定/保守</span>
                            <span>2.0 更创意/随机</span>
                          </div>
                          <p className="text-xs text-gray-400">Temperature 改动会自动保存到当前模型。</p>
                        </div>
                        {(tempSaving || tempSuccess || tempError) && (
                          <div className="text-xs">
                            {tempSaving && <p className="text-purple-600 dark:text-purple-400 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />正在自动保存...</p>}
                            {!tempSaving && tempSuccess && <p className="text-green-600 dark:text-green-400">{tempSuccess}</p>}
                            {!tempSaving && tempError && <p className="text-red-600 dark:text-red-400">{tempError}</p>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3">
                        选择左侧模型后可设置 Temperature 参数。
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* macOS Slider custom styles */}
      <style jsx global>{`
        .mac-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          background: #e5e7eb;
          outline: none;
          cursor: pointer;
        }
        .dark .mac-slider {
          background: #374151;
        }
        .mac-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 1px solid #d1d5db;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          cursor: pointer;
          transition: box-shadow 0.15s ease;
        }
        .mac-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 1px 6px rgba(0,0,0,0.25);
        }
        .mac-slider::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 2px;
        }
        .mac-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 1px solid #d1d5db;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

export default function ModelConfigPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
        <div className="flex flex-col items-center gap-3">
          <Bot className="h-8 w-8 text-purple-500/70 animate-pulse" />
          <p className="text-gray-400 dark:text-gray-500 text-sm font-light tracking-widest uppercase">加载中...</p>
        </div>
      </div>
    }>
      <ModelConfigContent />
    </Suspense>
  )
}
