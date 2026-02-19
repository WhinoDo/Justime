'use client'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { useLLMConfig } from '@/hooks/useLLMConfig'
import { Bot, Save, Loader2, RotateCcw, CheckCircle, AlertCircle, ChevronLeft, RefreshCw, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { JushiBackground } from '@/components/ui/JushiBackground'

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

function ModelConfigContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { config, updateConfig, resetConfig, isLoading: configLoading } = useLLMConfig()
  const searchParams = useSearchParams()

  // Local state for form fields
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [temperature, setTemperature] = useState(0.7)

  // Status states
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [usageModels, setUsageModels] = useState<ModelUsage[]>([])
  const [usageNote, setUsageNote] = useState('')
  const [usageDays, setUsageDays] = useState(14)
  const [usageScope, setUsageScope] = useState<'primary' | 'all'>('primary')

  // Determines the back link based on where the user came from
  const fromPath = searchParams.get('from') || '/dashboard'

  // Load initial values when config loads
  useEffect(() => {
    if (config) {
      setApiKey(config.apiKey)
      setModelName(config.modelName)
      setBaseUrl(config.baseUrl)
      setTemperature(config.temperature)
    }
  }, [config])

  // Hide success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])

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
      console.error('加载模型 token 使用量失败:', error)
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

  const formatTokenValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return `${value}`
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    setSaveSuccess(false)

    // Basic validation
    if (!apiKey.trim()) {
      setValidationError('API Key 不能为空')
      return
    }
    if (!modelName.trim()) {
      setValidationError('模型名称不能为空')
      return
    }

    setIsSaving(true)
    try {
      await updateConfig({
        apiKey,
        modelName,
        baseUrl,
        temperature
      })
      setSaveSuccess(true)
    } catch (err) {
      // Error handling is managed by useLLMConfig hook
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (window.confirm('确定要重置为默认配置吗？这将覆盖您当前的设置。')) {
      setIsSaving(true)
      try {
        await resetConfig()
        setSaveSuccess(true)
      } finally {
        setIsSaving(false)
      }
    }
  }

  if (authLoading || configLoading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <JushiBackground blur="xl" />
        <div className="relative z-10 flex flex-col items-center gap-3 animate-pulse">
          <Bot className="h-10 w-10 text-white/50" />
          <p className="text-white/60 text-sm font-light tracking-widest uppercase">Loading Configuration</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null // Auth check handled by hook/layout

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden font-sans">
      <JushiBackground blur="lg" opacity={0.6} />

      <div className="relative z-10 w-full max-w-4xl animate-in fade-in zoom-in-95 duration-700">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Link href={fromPath}>
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 transition-colors gap-2 pl-2">
              <ChevronLeft className="h-4 w-4" />
              <span className="tracking-wide">Back</span>
            </Button>
          </Link>
        </div>

        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden">
          {/* Card Header */}
          <div className="p-8 pb-6 border-b border-white/10 bg-black/10">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 ring-1 ring-indigo-500/30 shadow-lg">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">LLM Configuration</h1>
                <p className="text-white/60 text-sm mt-1">Manage your AI model settings and API keys</p>
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-8">
            <form onSubmit={handleSave} className="space-y-6">

              {/* Validation / Status Messages */}
              {validationError && (
                <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {saveSuccess && (
                <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-200">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>Configuration saved successfully</AlertDescription>
                </Alert>
              )}

              {/* Base URL */}
              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="text-white/80">API Base URL</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.openai.com/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl h-11"
                />
                <p className="text-xs text-white/40">Optional. Only needed for proxies or custom endpoints.</p>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-white/80">API Key <span className="text-rose-400">*</span></Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl h-11"
                />
              </div>

              {/* Model Name */}
              <div className="space-y-2">
                <Label htmlFor="modelName" className="text-white/80">Model Name <span className="text-rose-400">*</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {['gpt-3.5-turbo', 'gpt-4', 'deepseek-chat'].map(rec => (
                    <div
                      key={rec}
                      onClick={() => setModelName(rec)}
                      className={`cursor-pointer px-3 py-2 rounded-lg text-xs font-medium text-center transition-all border ${modelName === rec ? 'bg-indigo-500/30 border-indigo-500/50 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                    >
                      {rec}
                    </div>
                  ))}
                </div>
                <Input
                  id="modelName"
                  placeholder="e.g. gpt-4-turbo"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="bg-black/20 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl h-11 mt-2"
                />
              </div>

              {/* Temperature (Simple Slider) */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="temperature" className="text-white/80">Creativity (Temperature)</Label>
                  <span className="text-sm font-mono text-white/60 bg-white/10 px-2 py-0.5 rounded">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-white/40 px-1">
                  <span>Precise (0.0)</span>
                  <span>Creative (1.0)</span>
                  <span>Wild (2.0)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 flex items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white h-12 rounded-xl"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Default
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white border-0 shadow-lg shadow-indigo-500/20 h-12 rounded-xl"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Configuration
                    </>
                  )}
                </Button>
              </div>

            </form>

            <div className="mt-10 pt-8 border-t border-white/10 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-300" />
                    模型 Token 使用量
                  </h2>
                  <p className="text-xs text-white/50">按天统计每个已配置模型的 token 消耗</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setUsageScope('primary')}
                    className={`h-8 px-3 border-white/15 text-xs ${usageScope === 'primary' ? 'bg-emerald-500/25 text-white border-emerald-400/50' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                  >
                    主链路
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setUsageScope('all')}
                    className={`h-8 px-3 border-white/15 text-xs ${usageScope === 'all' ? 'bg-amber-500/25 text-white border-amber-400/50' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                  >
                    总花费
                  </Button>
                  {[7, 14, 30].map((days) => (
                    <Button
                      key={days}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setUsageDays(days)}
                      className={`h-8 px-3 border-white/15 text-xs ${usageDays === days ? 'bg-indigo-500/30 text-white border-indigo-400/50' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                    >
                      {days}天
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={loadTokenUsage}
                    disabled={usageLoading}
                    className="h-8 px-3 bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                  >
                    {usageLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              {usageError && (
                <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{usageError}</AlertDescription>
                </Alert>
              )}

              {!usageLoading && usageModels.length === 0 && !usageError && (
                <div className="text-sm text-white/55 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  暂无模型使用数据。发送聊天消息后会开始累计每日 token。
                </div>
              )}

              <div className="space-y-4">
                {usageModels.map((model) => {
                  const maxToken = Math.max(...model.daily.map((point) => point.totalTokens), 1)
                  return (
                    <div key={model.configId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{model.name}</p>
                            {model.isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/45 mt-0.5">{model.modelId || '未设置模型 ID'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-white/80">总 Token: <span className="font-semibold text-indigo-200">{formatTokenValue(model.totalTokens)}</span></p>
                          <p className="text-xs text-white/45">请求数: {model.totalRequests}</p>
                          <p className="text-xs text-white/45">usage 缺失: {model.missingUsageRequests || 0}</p>
                          <p className="text-xs text-white/45">覆盖率: {Math.round((model.sourceCoverage ?? 1) * 100)}%</p>
                        </div>
                      </div>

                      <div className="h-28 flex items-end gap-1.5">
                        {model.daily.map((point) => {
                          const barHeight = Math.max(3, Math.round((point.totalTokens / maxToken) * 100))
                          return (
                            <div
                              key={`${model.configId}-${point.date}`}
                              className="flex-1 rounded-sm bg-white/5 relative overflow-hidden"
                              title={`${point.date}
total: ${point.totalTokens}
prompt: ${point.promptTokens}
completion: ${point.completionTokens}
requests: ${point.requests}`}
                            >
                              <div
                                className="absolute bottom-0 left-0 right-0 rounded-sm bg-indigo-400/80"
                                style={{ height: `${barHeight}%` }}
                              />
                            </div>
                          )
                        })}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                        <span>{model.daily[0]?.date || '-'}</span>
                        <span>{model.daily[model.daily.length - 1]?.date || '-'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {usageNote && (
                <p className="text-xs text-white/45">{usageNote}</p>
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
          <p className="text-white/60 text-sm font-light tracking-widest uppercase">Loading Configuration</p>
        </div>
      </div>
    }>
      <ModelConfigContent />
    </Suspense>
  )
}
