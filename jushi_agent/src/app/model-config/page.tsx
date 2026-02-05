'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from '@/hooks/useAuth'
import { useLLMConfig } from '@/hooks/useLLMConfig'
import { Bot, Save, Loader2, RotateCcw, CheckCircle, AlertCircle, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { JushiBackground } from '@/components/ui/JushiBackground'

export default function ModelConfigPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { config, updateConfig, resetConfig, isLoading: configLoading, error: configError } = useLLMConfig()
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

      <div className="relative z-10 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-700">
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
          </div>
        </div>
      </div>
    </div>
  )
}
