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
import { JushiBackground } from '@/components/ui/JushiBackground'

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

  // Usage states
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
  const filteredConfigs = useMemo(
    () => configs.filter((config) => !isGPTModel(config.modelId)),
    [configs]
  )
  const filteredUsageModels = useMemo(
    () => usageModels.filter((model) => !isGPTModel(model.modelId)),
    [usageModels]
  )
  const usageByConfigId = useMemo(
    () => new Map(filteredUsageModels.map((model) => [model.configId, model])),
    [filteredUsageModels]
  )
  const hasAvailableModels = filteredConfigs.length > 0
  const selectedConfig = useMemo(
    () => filteredConfigs.find((config) => config.id === selectedModelId) ?? null,
    [filteredConfigs, selectedModelId]
  )
  const selectedUsageModel = useMemo(
    () => filteredUsageModels.find((model) => model.configId === selectedModelId) ?? null,
    [filteredUsageModels, selectedModelId]
  )
  const usageSummary = useMemo(
    () =>
      filteredUsageModels.reduce(
        (summary, model) => ({
          totalTokens: summary.totalTokens + model.totalTokens,
          totalRequests: summary.totalRequests + model.totalRequests
        }),
        { totalTokens: 0, totalRequests: 0 }
      ),
    [filteredUsageModels]
  )

  const loadTokenUsage = async () => {
    if (!isAuthenticated) return
    setUsageLoading(true)
    setUsageError(null)
    try {
      const response = await fetch(`/api/auth/llm-usage/daily?days=${usageDays}&scope=${usageScope}`, {
        credentials: 'include',
        cache: 'no-store'
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || result.message || '加载 token 使用量失败')
      }
      const models = Array.isArray(result.data?.models) ? result.data.models : []
      setUsageModels(models)
      setUsageNote(result.data?.note || '')
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : '加载模型 token 使用量失败')
      setUsageModels([])
    } finally {
      setUsageLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadTokenUsage()
    }
  }, [isAuthenticated, usageDays, usageScope])

  useEffect(() => {
    if (selectedModelId && !filteredConfigs.some((config) => config.id === selectedModelId)) {
      setSelectedModelId(null)
    }
  }, [selectedModelId, filteredConfigs])

  useEffect(() => {
    if (!selectedConfig) {
      setTempValue(0.7)
      setTempError(null)
      setTempSuccess(null)
      return
    }

    setTempValue(clampTemperature(selectedConfig.temperature ?? 0.7))
    setTempError(null)
    setTempSuccess(null)
  }, [selectedConfig?.id, selectedConfig?.temperature])

  useEffect(() => {
    if (tempSaveTimeoutRef.current) {
      clearTimeout(tempSaveTimeoutRef.current)
      tempSaveTimeoutRef.current = null
    }

    if (!selectedConfig) {
      setTempSaving(false)
      return
    }

    const savedTemp = clampTemperature(selectedConfig.temperature ?? 0.7)
    if (Math.abs(savedTemp - tempValue) < 0.001) {
      setTempSaving(false)
      return
    }

    tempSaveTimeoutRef.current = setTimeout(async () => {
      setTempSaving(true)
      setTempError(null)
      try {
        await updateConfig(selectedConfig.id, { temperature: tempValue })
        setTempSuccess('已自动保存')
        if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current)
        saveFeedbackTimeoutRef.current = setTimeout(() => setTempSuccess(null), 1500)
      } catch (error) {
        setTempError(error instanceof Error ? error.message : 'Temperature 自动保存失败')
      } finally {
        setTempSaving(false)
      }
    }, TEMP_SAVE_DEBOUNCE_MS)

    return () => {
      if (tempSaveTimeoutRef.current) {
        clearTimeout(tempSaveTimeoutRef.current)
        tempSaveTimeoutRef.current = null
      }
    }
  }, [tempValue, selectedConfig, updateConfig])

  useEffect(() => {
    return () => {
      if (tempSaveTimeoutRef.current) clearTimeout(tempSaveTimeoutRef.current)
      if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current)
    }
  }, [])

  const formatTokenValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return `${value}`
  }

  const handleSelectModel = (id: string) => {
    setSelectedModelId((prev) => (prev === id ? null : id))
  }

  const handleTempInput = (value: number) => {
    setTempValue(clampTemperature(value))
    setTempError(null)
    setTempSuccess(null)
  }

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

    const dailyPoints = normalizedDaily.length > 0
      ? normalizedDaily
      : [{
        date: '总计',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: Number(model.totalTokens ?? 0),
        requests: Number(model.totalRequests ?? 0),
        missingUsageRequests: Number(model.missingUsageRequests ?? 0)
      }]

    const maxToken = Math.max(...dailyPoints.map((point) => point.totalTokens), 1)

    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white font-medium">{model.name}</p>
              {model.isActive && (
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  使用中
                </span>
              )}
            </div>
            <p className="text-xs text-white/45 mt-0.5">{model.modelId || '无模型标识'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/80">累计总计: <span className="font-semibold text-indigo-200">{formatTokenValue(model.totalTokens)}</span> T</p>
            <p className="text-xs text-white/45">请求次数: {model.totalRequests}</p>
          </div>
        </div>

        <div className="h-28 flex items-end gap-1.5">
          {dailyPoints.map((point) => {
            const barHeight = point.totalTokens > 0
              ? Math.max(3, Math.round((point.totalTokens / maxToken) * 100))
              : 0
            return (
              <div
                key={`${model.configId}-${point.date}`}
                className="flex-1 h-full relative group"
              >
                <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 transition-opacity">
                  {point.date}<br />总数: {point.totalTokens}<br />请求: {point.requests}
                </div>
                {point.totalTokens > 0 && (
                  <div
                    className="absolute z-20 left-1/2 -translate-x-1/2 text-[8px] font-medium text-white whitespace-nowrap pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                    style={{ bottom: `calc(${Math.min(barHeight, 100)}% + 4px)` }}
                  >
                    {formatTokenValue(point.totalTokens)}
                  </div>
                )}
                <div className="h-full rounded-sm bg-white/5 relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-sm bg-indigo-400/80 transition-all group-hover:bg-indigo-300 group-hover:shadow-[0_0_10px_rgba(129,140,248,0.5)]"
                    style={{ height: `${barHeight}%` }}
                  />
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
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <JushiBackground blur="xl" />
        <div className="relative z-10 flex flex-col items-center gap-3 animate-pulse">
          <Bot className="h-10 w-10 text-white/50" />
          <p className="text-white/60 text-sm font-light tracking-widest uppercase">加载配置中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen relative py-8 px-4 font-sans">
      <JushiBackground blur="lg" opacity={0.6} />

      <div className="relative z-10 w-full max-w-6xl mx-auto animate-in fade-in duration-700">
        <div className="flex items-center justify-between mb-6">
          <Link href={fromPath}>
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 transition-colors gap-2 pl-2">
              <ChevronLeft className="h-4 w-4" />
              <span className="tracking-wide">返回</span>
            </Button>
          </Link>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-[700px]">

          {/* Left Sidebar - Configs List */}
          <div className="w-full md:w-80 bg-black/20 border-b md:border-b-0 md:border-r border-white/10 flex flex-col">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 ring-1 ring-indigo-500/30">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">模型配置库</h2>
                  <p className="text-white/50 text-xs">选择您的专属 AI 助手</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredConfigs.map((config) => {
                const modelUsage = usageByConfigId.get(config.id)
                const isSelected = selectedModelId === config.id

                return (
                  <div
                    key={config.id}
                    onClick={() => handleSelectModel(config.id)}
                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all ${isSelected
                      ? 'bg-sky-500/20 border-sky-300/50 ring-1 ring-sky-300/40 shadow-lg'
                      : config.isActive
                        ? 'bg-indigo-500/20 border-indigo-400/30 shadow-lg'
                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-semibold text-white truncate pr-6">{config.name || '未命名'}</h3>
                      {config.isActive && (
                        <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="当前激活" />
                      )}
                    </div>
                    <p className="text-xs text-white/50 mb-2 truncate font-mono">{config.modelId}</p>
                    <p className="text-xs text-white/65 border-t border-white/10 pt-2">
                      总计: <span className="text-indigo-200">{formatTokenValue(modelUsage?.totalTokens ?? 0)}</span> Token · {modelUsage?.totalRequests ?? 0} 次请求
                    </p>
                  </div>
                )
              })}

              {filteredConfigs.length === 0 && (
                <div className="text-center py-8 text-white/40 text-sm">
                  暂无可用模型，请等待系统管理员配置。
                </div>
              )}
            </div>
          </div>

          {/* Right Area - Stats */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-8 flex-1 overflow-y-auto">
              {!hasAvailableModels ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                  <h1 className="text-2xl font-bold text-white tracking-tight">模型使用情况</h1>
                  <p className="text-white/60 text-sm mt-3">
                    暂无可用模型，请等待系统管理员配置。
                  </p>
                </div>
              ) : (
                <>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  模型使用情况
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  {selectedConfig
                    ? `当前聚焦: ${selectedConfig.name || selectedConfig.modelId || '未命名模型'}`
                    : '当前显示所有非 GPT 模型的汇总统计'}
                </p>
              </div>

              {/* Dashboard Usage Graph for context */}
              <div className="mt-8 space-y-5 max-w-4xl">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-300" />
                      模型 Token 统计表
                    </h2>
                    <p className="text-xs text-white/50">按天统计应用内模型的消耗情况</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button" size="sm" variant="outline"
                      onClick={() => setUsageScope('primary')}
                      className={`h-8 px-3 border-white/15 text-xs ${usageScope === 'primary' ? 'bg-emerald-500/25 text-white border-emerald-400/50' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                    >
                      主对话链路
                    </Button>
                    <Button
                      type="button" size="sm" variant="outline"
                      onClick={() => setUsageScope('all')}
                      className={`h-8 px-3 border-white/15 text-xs ${usageScope === 'all' ? 'bg-amber-500/25 text-white border-amber-400/50' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                    >
                      包含Agent总计
                    </Button>
                    {[7, 14, 30].map((days) => (
                      <Button
                        key={days} type="button" size="sm" variant="outline"
                        onClick={() => setUsageDays(days)}
                        className={`h-8 px-3 border-white/15 text-xs hidden sm:flex ${usageDays === days ? 'bg-indigo-500/30 text-white border-indigo-400/50' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                      >
                        {days}天
                      </Button>
                    ))}
                    {selectedModelId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedModelId(null)}
                        className="h-8 px-3 border-sky-300/40 bg-sky-500/20 text-white text-xs hover:bg-sky-500/35"
                      >
                        查看全部
                      </Button>
                    )}
                  </div>
                </div>

                {usageNote && (
                  <p className="text-xs text-white/50">
                    {usageNote}
                  </p>
                )}

                {usageError && (
                  <Alert className="bg-red-500/10 border-red-500/30 text-red-100">
                    <AlertDescription>{usageError}</AlertDescription>
                  </Alert>
                )}

                {usageLoading && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在加载模型 Token 统计...
                  </div>
                )}

                {!usageLoading && filteredUsageModels.length === 0 && !usageError && (
                  <div className="text-sm text-white/55 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    暂无模型使用数据。开始与 AI 助手对话以生成统计记录。
                  </div>
                )}

                {!usageLoading && !usageError && !selectedModelId && filteredUsageModels.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-white font-medium">全部模型汇总（不含 GPT）</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                        <p className="text-xs text-white/55">模型数量</p>
                        <p className="text-lg text-indigo-100 font-semibold">{filteredUsageModels.length}</p>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                        <p className="text-xs text-white/55">累计 Token</p>
                        <p className="text-lg text-indigo-100 font-semibold">{formatTokenValue(usageSummary.totalTokens)}</p>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                        <p className="text-xs text-white/55">总请求次数</p>
                        <p className="text-lg text-indigo-100 font-semibold">{usageSummary.totalRequests}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!usageLoading && !usageError && !selectedModelId && filteredUsageModels.length > 0 && (
                  <div className="space-y-4">
                    {filteredUsageModels.map((model) => (
                      <div key={model.configId}>
                        {renderUsageModelCard(model)}
                      </div>
                    ))}
                  </div>
                )}

                {!usageLoading && !usageError && selectedModelId && !selectedUsageModel && (
                  <div className="text-sm text-white/55 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    当前选中模型暂无 Token 使用记录。
                  </div>
                )}

                {!usageLoading && !usageError && selectedUsageModel && (
                  <div className="space-y-4">
                    {renderUsageModelCard(selectedUsageModel)}
                  </div>
                )}
              </div>

              <div className="mt-8 max-w-4xl">
                {selectedConfig ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Temperature 参数设置</h2>
                      <p className="text-xs text-white/50 mt-1">
                        当前模型: {selectedConfig.name || selectedConfig.modelId || '未命名模型'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.1}
                          value={tempValue}
                          onChange={(event) => handleTempInput(Number(event.target.value))}
                          className="w-full accent-indigo-400"
                          disabled={tempSaving}
                        />
                        <Input
                          type="number"
                          min={0}
                          max={2}
                          step={0.1}
                          value={tempValue}
                          onChange={(event) => {
                            const nextValue = Number.parseFloat(event.target.value)
                            if (Number.isNaN(nextValue)) return
                            handleTempInput(nextValue)
                          }}
                          className="w-24 bg-white/5 border-white/15 text-white"
                          disabled={tempSaving}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/45">
                        <span>0.0 更确定/保守</span>
                        <span>2.0 更创意/随机</span>
                      </div>
                      <p className="text-xs text-white/55">Temperature 改动会自动保存到当前模型。</p>
                    </div>

                    {(tempSaving || tempSuccess || tempError) && (
                      <div className="text-xs">
                        {tempSaving && (
                          <p className="text-indigo-200 flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            正在自动保存...
                          </p>
                        )}
                        {!tempSaving && tempSuccess && <p className="text-emerald-200">{tempSuccess}</p>}
                        {!tempSaving && tempError && <p className="text-red-200">{tempError}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-white/55 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
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
    </div>
  )
}

export default function ModelConfigPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <JushiBackground blur="xl" />
        <div className="relative z-10 flex flex-col items-center gap-3 animate-pulse">
          <Bot className="h-10 w-10 text-white/50" />
          <p className="text-white/60 text-sm font-light tracking-widest uppercase">加载中...</p>
        </div>
      </div>
    }>
      <ModelConfigContent />
    </Suspense>
  )
}
