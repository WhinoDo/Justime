'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  HelpCircle,
  Plus,
  Trash2,
  Edit2,
  MoreVertical,
  Check
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface LLMConfig {
  id?: string
  name?: string
  modelId: string
  apiKey: string
  baseUrl: string
  timeout?: number
  isActive?: boolean
}

// 预设模型配置
interface ModelPreset {
  id: string
  name: string
  modelId: string
  baseUrl: string
  description: string
}

export default function ModelConfigPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPath = searchParams.get('from')
  const backHref = fromPath || '/profile'

  // State for List View
  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // State for Edit/Add Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<LLMConfig>({
    name: '',
    modelId: '',
    apiKey: '',
    baseUrl: '',
    timeout: 60
  })
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogSuccess, setDialogSuccess] = useState<string | null>(null)

  const [presetModels, setPresetModels] = useState<ModelPreset[]>([])
  const [showHelp, setShowHelp] = useState(false)

  // 加载模型预设
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const response = await fetch('/api/auth/llm-presets')
        const result = await response.json()
        if (result.success && Array.isArray(result.data)) {
          setPresetModels(result.data)
        }
      } catch (err) {
        console.error('加载模型预设失败:', err)
      }
    }
    loadPresets()
  }, [])

  // 加载用户的配置列表
  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/auth/llm-configs', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      })
      const result = await response.json()

      if (result.success && result.data?.configs) {
        setConfigs(result.data.configs)
      } else {
        setConfigs([])
      }
    } catch (err) {
      console.error('加载配置失败:', err)
      setGlobalError('加载配置失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadConfigs()
    }
  }, [isAuthenticated, loadConfigs])

  // 打开添加/编辑对话框
  const openDialog = (config?: LLMConfig) => {
    if (config) {
      setEditingConfig({ ...config, apiKey: '' }) // Clear API key for security unless we want to show placeholder
      // Check if matches preset
      const match = presetModels.find(p => p.modelId === config.modelId && p.baseUrl === config.baseUrl)
      setSelectedPreset(match ? match.id : 'custom')
    } else {
      setEditingConfig({
        name: '新模型配置',
        modelId: '',
        apiKey: '',
        baseUrl: '',
        timeout: 60
      })
      setSelectedPreset('')
    }
    setDialogError(null)
    setDialogSuccess(null)
    setShowApiKey(false)
    setIsDialogOpen(true)
  }

  // 处理预设模型选择
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId)

    if (presetId === 'custom') {
      setEditingConfig(prev => ({
        ...prev,
        modelId: '',
        baseUrl: ''
      }))
    } else {
      const preset = presetModels.find(p => p.id === presetId)
      if (preset) {
        setEditingConfig(prev => ({
          ...prev,
          name: prev.name === '新模型配置' ? preset.name : prev.name,
          modelId: preset.modelId,
          baseUrl: preset.baseUrl
        }))
      }
    }
  }

  // 保存配置 (新建或更新)
  const handleSave = async () => {
    if (!editingConfig.modelId || !editingConfig.baseUrl) {
      setDialogError('请填写完整配置信息')
      return
    }

    // For new config, API key is required
    if (!editingConfig.id && !editingConfig.apiKey) {
      setDialogError('新建配置必须填写 API 密钥')
      return
    }

    setDialogLoading(true)
    setDialogError(null)

    try {
      let response
      if (editingConfig.id) {
        // Update
        response = await fetch(`/api/auth/llm-configs/${editingConfig.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingConfig)
        })
      } else {
        // Create
        response = await fetch('/api/auth/llm-configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingConfig)
        })
      }

      const result = await response.json()
      if (result.success) {
        setDialogSuccess('保存成功')
        setTimeout(() => {
          setIsDialogOpen(false)
          loadConfigs()
        }, 1000)
      } else {
        setDialogError(result.message || '保存失败')
      }
    } catch (err) {
      setDialogError('保存请求失败')
    } finally {
      setDialogLoading(false)
    }
  }

  // 删除配置
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此配置吗？')) return

    try {
      const response = await fetch(`/api/auth/llm-configs/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        loadConfigs()
      } else {
        setGlobalError(result.message)
      }
    } catch (err) {
      setGlobalError('删除请求失败')
    }
  }

  // 设为激活
  const handleSetActive = async (id: string) => {
    try {
      // Optimistic update
      setConfigs(prev => prev.map(c => ({ ...c, isActive: c.id === id })))

      const response = await fetch(`/api/auth/llm-configs/${id}/active`, {
        method: 'PUT'
      })
      const result = await response.json()
      if (!result.success) {
        setGlobalError(result.message)
        loadConfigs() // Revert on fail
      }
    } catch (err) {
      setGlobalError('设置激活失败')
      loadConfigs()
    }
  }

  // 测试连接
  const handleTest = async () => {
    if (!editingConfig.modelId || !editingConfig.baseUrl) {
      setDialogError('请先填写完整的配置信息')
      return
    }

    // If editing existing and no key provided, we can't test easily unless backend supports it
    // But for security, let's require key input for test if it's empty in form (meaning masked)
    // Actually backend test endpoint supports masked key usage if user owns it.

    setTesting(true)
    setDialogError(null)
    setDialogSuccess(null)

    try {
      const response = await fetch('/api/chat/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: editingConfig.modelId,
          apiKey: editingConfig.apiKey || '******', // Identify as mask check
          baseUrl: editingConfig.baseUrl,
          timeout: editingConfig.timeout || 60
        })
      })
      const result = await response.json()

      if (result.success) {
        setDialogSuccess(`连接成功! 响应延迟: ${result.responseLength}字符`)
      } else {
        setDialogError(`连接失败: ${result.error || result.message}`)
      }
    } catch (err) {
      setDialogError('测试请求失败')
    } finally {
      setTesting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) return null // Should redirect in middleware/wrapper

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={backHref}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bot className="h-6 w-6 text-blue-600" />
                模型配置
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                管理您的大语言模型配置，支持多模型切换
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowHelp(true)}>
              <HelpCircle className="h-4 w-4 mr-2" />
              帮助
            </Button>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              添加新模型
            </Button>
          </div>
        </div>

        {globalError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}

        {/* Config List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((conf) => (
            <Card key={conf.id} className={`relative transition-all hover:shadow-md ${conf.isActive ? 'border-2 border-blue-500 bg-blue-50/10' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${conf.isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{conf.name || '未命名'}</CardTitle>
                      <CardDescription className="text-xs truncate max-w-[150px]" title={conf.modelId}>
                        {conf.modelId}
                      </CardDescription>
                    </div>
                  </div>
                  {conf.isActive && (
                    <Badge variant="default" className="bg-blue-600 hover:bg-blue-600">
                      使用中
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500 mb-4 space-y-1">
                  <p className="truncate" title={conf.baseUrl}>API: {conf.baseUrl}</p>
                  <p>KEY: {conf.apiKey ? '已配置 ******' : '未配置'}</p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t pt-3">
                  {!conf.isActive && (
                    <Button variant="ghost" size="sm" className="text-gray-600 h-8" onClick={() => handleSetActive(conf.id!)}>
                      <Check className="h-3 w-3 mr-1" />
                      启用
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleSetActive(conf.id!)}>
                        设为默认
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openDialog(conf)}>
                        <div className="flex items-center">
                          <Edit2 className="h-3 w-3 mr-2" /> 编辑
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(conf.id!)}>
                        <div className="flex items-center">
                          <Trash2 className="h-3 w-3 mr-2" /> 删除
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}

          {configs.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed">
              <Bot className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p>还没有配置任何模型</p>
              <Button variant="link" onClick={() => openDialog()}>点击添加第一个模型</Button>
            </div>
          )}
        </div>

        {/* Edit/Add Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingConfig.id ? '编辑配置' : '添加新模型'}</DialogTitle>
              <DialogDescription>
                配置兼容 OpenAI 接口的模型服务
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>配置名称</Label>
                <Input
                  value={editingConfig.name}
                  onChange={e => setEditingConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="给这个配置起个名字"
                />
              </div>

              <div className="space-y-2">
                <Label>预设模板</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择预设（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">自定义</SelectItem>
                    {presetModels.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>模型 ID (Model ID)</Label>
                  <Input
                    value={editingConfig.modelId}
                    onChange={e => setEditingConfig(prev => ({ ...prev, modelId: e.target.value }))}
                    placeholder="e.g. gpt-4"
                  />
                </div>
                <div className="space-y-2">
                  <Label>超时时间 (秒)</Label>
                  <Input
                    type="number"
                    value={editingConfig.timeout}
                    onChange={e => setEditingConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>服务地址 (Base URL)</Label>
                <Input
                  value={editingConfig.baseUrl}
                  onChange={e => setEditingConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={editingConfig.apiKey}
                    onChange={e => setEditingConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={editingConfig.id ? "若不修改请留空" : "sk-..."}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {dialogError && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{dialogError}</AlertDescription>
                </Alert>
              )}
              {dialogSuccess && (
                <Alert className="py-2 border-green-200 bg-green-50 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{dialogSuccess}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleTest} disabled={dialogLoading || testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                测试连接
              </Button>
              <Button type="submit" onClick={handleSave} disabled={dialogLoading || testing}>
                {dialogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Help Dialog (kept mostly same) */}
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>配置说明</DialogTitle>
              <DialogDescription>
                如何配置 LLM 模型参数
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">关于多模型配置：</h4>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>您可以配置多个不同的模型服务（如 OpenAI, DeepSeek, 本地 Ollama 等）。</li>
                  <li>点击卡片上的"启用"按钮即可快速切换当前使用的模型。</li>
                  <li>所有配置的 API Key 都会被加密存储。</li>
                </ul>
              </div>
              {/* ... existing help content ... */}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
