'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { useLLMConfigs } from '@/hooks/useLLMConfig'
import { BarChart3, Bot, ChevronLeft, Loader2, HelpCircle, Lock, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { JustimeBackground } from '@/components/ui/JustimeBackground'
import { API_ENDPOINTS } from '@/lib/api/endpoints'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

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

  // Feishu states
  const [feishuConfig, setFeishuConfig] = useState({
    enabled: false,
    status: 'disabled',
    appId: '',
    calendarId: '',
    message: ''
  })
  const [feishuLoading, setFeishuLoading] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideContent, setGuideContent] = useState('')

  const loadFeishuStatus = async () => {
    try {
      setFeishuLoading(true)
      const response = await fetch('/api/calendar/feishu/config-status')
      const result = await response.json()
      if (result.success && result.data) {
        setFeishuConfig(result.data)
      }
    } catch (error) {
      console.error('加载飞书配置状态失败:', error)
    } finally {
      setFeishuLoading(false)
    }
  }

  const loadGuideContent = async () => {
    if (guideContent) return
    try {
      const response = await fetch('/FEISHU_CONFIG_GUIDE.md')
      const text = await response.text()
      setGuideContent(text)
    } catch (error) {
      console.error('加载飞书配置指引 Markdown 失败:', error)
      setGuideContent('加载指引失败，请稍后重试。')
    }
  }

  // 辅助解析行内代码 ``
  const parseInlineCode = (text: string) => {
    if (!text.includes('`')) return text
    const parts = text.split('`')
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-xs text-indigo-300">
            {part}
          </code>
        )
      }
      return part
    })
  }

  const renderMarkdown = (md: string) => {
    if (!md) return <div className="text-white/60 text-xs py-8 text-center flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> 加载指引中...</div>
    
    const lines = md.split('\n')
    return (
      <div className="space-y-4 text-white/80 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 font-sans">
        {lines.map((line, index) => {
          const trimmed = line.trim()
          if (!trimmed) return <div key={index} className="h-2" />
          
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={index} className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-4 mb-2 flex items-center gap-2">
                {trimmed.replace('# ', '')}
              </h1>
            )
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={index} className="text-sm font-semibold text-indigo-300 mt-4 mb-1">
                {trimmed.replace('## ', '')}
              </h2>
            )
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={index} className="text-xs font-semibold text-white/90 mt-3 mb-1">
                {trimmed.replace('### ', '')}
              </h3>
            )
          }
          
          if (trimmed.startsWith('> [!')) {
            const isImportant = trimmed.includes('!IMPORTANT')
            const isWarning = trimmed.includes('!WARNING')
            
            // 简单提取后续文本作为提示内容
            const nextLine = lines[index + 1] || ''
            const alertText = nextLine.trim().startsWith('- ') || nextLine.trim().length > 0
              ? nextLine.trim().replace(/^>\s*/, '')
              : '安全提示信息'

            return (
              <div
                key={index}
                className={`p-3.5 rounded-xl border backdrop-blur-md my-3 ${
                  isImportant
                    ? 'bg-red-500/10 border-red-500/30 text-red-200'
                    : isWarning
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                }`}
              >
                <p className="font-semibold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {isImportant ? '⚠️ 重要提醒' : isWarning ? '⚡ 警告说明' : '💡 配置建议'}
                </p>
                <div className="text-xs opacity-90 leading-normal">
                  {parseInlineCode(alertText)}
                </div>
              </div>
            )
          }
          
          if (index > 0 && lines[index - 1].trim().startsWith('> [!')) {
            return null
          }
          
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const itemText = trimmed.substring(2)
            return (
              <ul key={index} className="list-disc pl-5 space-y-1">
                <li className="text-white/70 text-xs">
                  {parseInlineCode(itemText)}
                </li>
              </ul>
            )
          }
          
          if (/^\d+\.\s*/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.\s*)(.*)/)
            const itemText = match ? match[2] : trimmed
            return (
              <ol key={index} className="list-decimal pl-5 space-y-1">
                <li className="text-white/70 text-xs">
                  {parseInlineCode(itemText)}
                </li>
              </ol>
            )
          }
          
          if (trimmed === '---') {
            return <hr key={index} className="border-white/10 my-3" />
          }
          
          return <p key={index} className="text-xs text-white/70">{parseInlineCode(trimmed)}</p>
        })}
      </div>
    )
  }

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
      const response = await fetch(API_ENDPOINTS.AUTH.LLM_USAGE_DAILY(usageDays, usageScope), {
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
      loadFeishuStatus()
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
        <JustimeBackground blur="xl" />
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
      <JustimeBackground blur="lg" opacity={0.6} />

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

              {/* 飞书集成配置卡片 */}
              <div className="mt-6 max-w-4xl">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Lock className="w-5 h-5 text-sky-300" />
                        飞书日历映射集成
                      </h2>
                      <p className="text-xs text-white/50">将平台日历与您的飞书日程进行双向无缝映射</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Dialog open={guideOpen} onOpenChange={(open) => {
                        setGuideOpen(open)
                        if (open) void loadGuideContent()
                      }}>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setGuideOpen(true)
                            void loadGuideContent()
                          }}
                          className="h-8 px-3 border-white/10 bg-white/5 text-white/90 hover:bg-white/10 flex items-center gap-1.5 text-xs font-normal"
                        >
                          <HelpCircle className="w-4 h-4 text-sky-400" />
                          配置向导 💡
                        </Button>
                        <DialogContent className="sm:max-w-[650px] bg-gray-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-6 rounded-3xl">
                          <DialogHeader className="border-b border-white/10 pb-3">
                            <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                              <HelpCircle className="w-5 h-5 text-indigo-400" />
                              飞书 API Key & Secret 获取指引
                            </DialogTitle>
                          </DialogHeader>
                          
                          {renderMarkdown(guideContent)}

                          <div className="flex justify-end border-t border-white/10 pt-3 mt-4">
                            <Button
                              type="button"
                              onClick={() => setGuideOpen(false)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-9 text-xs"
                            >
                              我明白了
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={loadFeishuStatus}
                        disabled={feishuLoading}
                        className="h-8 px-3 border-white/10 bg-white/5 text-white/90 hover:bg-white/10 text-xs font-normal"
                      >
                        {feishuLoading ? '自检中...' : '重新检测'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/40 p-4 space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 text-xs">连通状态:</span>
                        {feishuConfig.status === 'connected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                            <CheckCircle2 className="w-3 h-3" />
                            成功连通飞书
                          </span>
                        ) : feishuConfig.status === 'error' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-400/20">
                            <XCircle className="w-3.5 h-3.5" />
                            连通失败
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/20 text-gray-300 border border-white/10">
                            <Lock className="w-3.5 h-3.5" />
                            未启用/已关闭
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/40 font-mono">App ID: {feishuConfig.appId || '暂无'}</span>
                    </div>

                    <div className="border-t border-white/5 pt-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-white/60">
                        <span>日历配置映射 ID:</span>
                        <span className="font-mono text-white/80">{feishuConfig.calendarId || '默认主日历'}</span>
                      </div>
                      <p className={`mt-2 ${feishuConfig.status === 'connected' ? 'text-emerald-300/80' : 'text-white/50'}`}>
                        ℹ️ {feishuConfig.message || '若需要启用飞书日历，请修改后端的 .env 环境变量并重启服务。'}
                      </p>
                    </div>
                  </div>
                </div>
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
        <JustimeBackground blur="xl" />
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
