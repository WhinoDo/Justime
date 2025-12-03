'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Bot,
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LLMConfig {
  modelId?: string
  apiKey?: string
  baseUrl?: string
  timeout?: number
}

// 预设模型配置
const PRESET_MODELS = [
  {
    id: 'openai-gpt-3.5-turbo',
    name: 'OpenAI GPT-3.5 Turbo',
    modelId: 'gpt-3.5-turbo',
    baseUrl: 'https://api.openai.com/v1',
    description: 'OpenAI官方GPT-3.5模型，快速且经济实惠'
  },
  {
    id: 'openai-gpt-4',
    name: 'OpenAI GPT-4',
    modelId: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    description: 'OpenAI官方GPT-4模型，更强大的能力'
  },
  {
    id: 'openai-gpt-4-turbo',
    name: 'OpenAI GPT-4 Turbo',
    modelId: 'gpt-4-turbo-preview',
    baseUrl: 'https://api.openai.com/v1',
    description: 'OpenAI官方GPT-4 Turbo模型，最新版本'
  },
  {
    id: 'qwen-turbo',
    name: '通义千问 Turbo',
    modelId: 'qwen-turbo',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    description: '阿里云通义千问Turbo模型，中文优化'
  },
  {
    id: 'qwen-plus',
    name: '通义千问 Plus',
    modelId: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    description: '阿里云通义千问Plus模型，更强的能力'
  },
  {
    id: 'qwen-max',
    name: '通义千问 Max',
    modelId: 'qwen-max',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    description: '阿里云通义千问Max模型，最强能力'
  },
  {
    id: 'ernie-bot-turbo',
    name: '百度文心一言 Turbo',
    modelId: 'ernie-bot-turbo',
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    description: '百度文心一言Turbo模型'
  },
  {
    id: 'ollama-llama2',
    name: 'Ollama Llama2（本地）',
    modelId: 'llama2',
    baseUrl: 'http://localhost:11434/v1',
    description: '本地部署的Llama2模型（需要本地运行Ollama）'
  },
  {
    id: 'custom',
    name: '自定义配置',
    modelId: '',
    baseUrl: '',
    description: '完全自定义配置，手动填写所有参数'
  }
] as const

export default function ModelConfigPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [config, setConfig] = useState<LLMConfig>({
    modelId: '',
    apiKey: '',
    baseUrl: '',
    timeout: 60
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 加载用户的LLM配置
  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/llm-config', {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success && result.data?.llmConfig) {
        const loadedConfig = {
          modelId: result.data.llmConfig.modelId || '',
          apiKey: result.data.llmConfig.apiKey || '',
          baseUrl: result.data.llmConfig.baseUrl || '',
          timeout: result.data.llmConfig.timeout || 60
        }
        setConfig(loadedConfig)
        
        // 尝试匹配预设模型
        const matchedPreset = PRESET_MODELS.find(
          preset => preset.modelId === loadedConfig.modelId && 
                    preset.baseUrl === loadedConfig.baseUrl
        )
        if (matchedPreset) {
          setSelectedPreset(matchedPreset.id)
        } else if (loadedConfig.modelId && loadedConfig.baseUrl) {
          setSelectedPreset('custom')
        }
      }
    } catch (err) {
      console.error('加载配置失败:', err)
    }
  }, [isAuthenticated, user])

  // 加载用户的LLM配置
  useEffect(() => {
    if (isAuthenticated && user) {
      loadConfig()
    }
  }, [isAuthenticated, user, loadConfig])

  // 处理预设模型选择
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId)
    
    if (presetId === 'custom') {
      // 选择自定义时，清空字段（保留API密钥）
      setConfig({
        ...config,
        modelId: '',
        baseUrl: ''
      })
    } else {
      // 选择预设模型时，自动填充模型ID和服务地址
      const preset = PRESET_MODELS.find(p => p.id === presetId)
      if (preset) {
        setConfig({
          ...config,
          modelId: preset.modelId,
          baseUrl: preset.baseUrl
        })
      }
    }
  }

  const handleSave = async () => {
    if (!isAuthenticated) {
      setError('请先登录')
      return
    }

    // 验证必填字段
    if (!config.modelId || !config.apiKey || !config.baseUrl) {
      setError('请填写所有必填字段（模型ID、API密钥、服务地址）')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/auth/llm-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          modelId: config.modelId,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          timeout: config.timeout || 60
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('LLM配置已保存成功！')
        // 清除错误信息
        setTimeout(() => {
          setSuccess(null)
        }, 5000)
      } else {
        setError(result.error || '保存配置失败')
      }
    } catch (err) {
      console.error('保存配置失败:', err)
      setError('保存配置时发生错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    if (!config.modelId || !config.apiKey || !config.baseUrl) {
      setError('请先填写完整的配置信息')
      return
    }

    setTesting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/llm/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          modelId: config.modelId,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          timeout: config.timeout || 60
        })
      })

      const result = await response.json()
      
      console.log('🧪 测试结果:', result)

      if (result.success) {
        const successMsg = `✅ ${result.message}\n\n模型: ${result.model}\n服务地址: ${result.baseUrl}\n响应预览: ${result.response}\n响应长度: ${result.responseLength}字符`
        setSuccess(successMsg)
        // 清除成功信息
        setTimeout(() => {
          setSuccess(null)
        }, 10000)
      } else {
        // 显示详细的错误信息
        const errorMessage = result.error || '配置测试失败'
        const errorDetails = result.details || '请检查配置和网络连接'
        const errorType = result.errorType || 'unknown'
        
        // 根据错误类型构造更友好的错误信息
        let fullErrorMsg = `❌ ${errorMessage}`
        if (errorDetails) {
          fullErrorMsg += `\n\n${errorDetails}`
        }
        
        setError(fullErrorMsg)
      }
    } catch (err) {
      console.error('测试配置失败:', err)
      setError('测试配置时发生网络错误，请检查：\n1. 后端服务是否正常运行\n2. 网络连接是否正常\n3. 防火墙设置是否正确')
    } finally {
      setTesting(false)
    }
  }

  // 如果正在加载认证状态
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-900">加载中...</p>
        </div>
      </div>
    )
  }

  // 如果用户未登录
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首页
              </Button>
            </Link>
          </div>

          <Card className="bg-white shadow-lg border-2 border-blue-200">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Bot className="h-6 w-6 text-blue-600" />
                模型配置
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  请先登录账户才能配置LLM模型。
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 justify-center">
                <Link href="/auth?mode=login">
                  <Button>
                    登录账户
                  </Button>
                </Link>
                <Link href="/auth?mode=register">
                  <Button variant="outline">
                    注册账户
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 返回按钮 */}
        <div className="flex items-center justify-start mb-4">
          <Link href="/profile">
            <Button variant="ghost" size="lg" className="text-gray-700 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              返回个人信息
            </Button>
          </Link>
        </div>

        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">模型配置</h1>
            <p className="text-gray-900 mt-1">配置您的大语言模型API密钥和参数</p>
          </div>
        </div>

        {/* 错误和成功提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* 配置表单 */}
        <Card className="bg-white shadow-lg border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-blue-600" />
              LLM模型配置
            </CardTitle>
            <CardDescription>
              配置您的大语言模型参数，支持任何兼容OpenAI接口的服务
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 预设模型选择 */}
            <div className="space-y-2">
              <Label htmlFor="preset" className="text-gray-900">
                选择预设模型
              </Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="选择一个预设模型或使用自定义配置">
                    {selectedPreset && PRESET_MODELS.find(p => p.id === selectedPreset)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <div className="flex flex-col">
                      <span className="font-medium">请选择</span>
                    </div>
                  </SelectItem>
                  {PRESET_MODELS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{preset.name}</span>
                        <span className="text-xs text-gray-700">{preset.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-900">
                选择一个预设模型后，只需填写API密钥即可。也可以选择"自定义配置"手动填写所有参数。
              </p>
            </div>

            {/* 模型ID */}
            <div className="space-y-2">
              <Label htmlFor="modelId" className="text-gray-900">
                模型ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modelId"
                placeholder="例如: gpt-3.5-turbo, qwen-turbo"
                value={config.modelId}
                onChange={(e) => {
                  setConfig({ ...config, modelId: e.target.value })
                  // 如果手动修改，切换到自定义
                  if (selectedPreset && selectedPreset !== 'custom') {
                    setSelectedPreset('custom')
                  }
                }}
                className="bg-white"
                disabled={selectedPreset && selectedPreset !== 'custom' && selectedPreset !== ''}
              />
              <p className="text-xs text-gray-900">
                {selectedPreset && selectedPreset !== 'custom' && selectedPreset !== ''
                  ? '已自动填充，选择预设模型时不可修改'
                  : '您的模型名称，如 gpt-3.5-turbo（OpenAI）、qwen-turbo（通义千问）等'}
              </p>
            </div>

            {/* API密钥 */}
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-gray-900">
                API密钥 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  className="bg-white pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-900">
                您的API密钥，将安全存储在数据库中，仅用于调用LLM服务
              </p>
            </div>

            {/* 服务地址 */}
            <div className="space-y-2">
              <Label htmlFor="baseUrl" className="text-gray-900">
                服务地址 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://api.openai.com/v1"
                value={config.baseUrl}
                onChange={(e) => {
                  setConfig({ ...config, baseUrl: e.target.value })
                  // 如果手动修改，切换到自定义
                  if (selectedPreset && selectedPreset !== 'custom') {
                    setSelectedPreset('custom')
                  }
                }}
                className="bg-white"
                disabled={selectedPreset && selectedPreset !== 'custom' && selectedPreset !== ''}
              />
              <p className="text-xs text-gray-900">
                {selectedPreset && selectedPreset !== 'custom' && selectedPreset !== ''
                  ? '已自动填充，选择预设模型时不可修改'
                  : 'LLM服务的API地址，如 https://api.openai.com/v1（OpenAI）、https://dashscope.aliyuncs.com/compatible-mode/v1（通义千问）等'}
              </p>
            </div>

            {/* 超时时间 */}
            <div className="space-y-2">
              <Label htmlFor="timeout" className="text-gray-900">
                超时时间（秒）
              </Label>
              <Input
                id="timeout"
                type="number"
                min="30"
                max="300"
                placeholder="60"
                value={config.timeout}
                onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 60 })}
                className="bg-white"
              />
              <p className="text-xs text-gray-900">
                请求超时时间，建议设置为60-120秒
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleTest}
                disabled={testing || loading || !config.modelId || !config.apiKey || !config.baseUrl}
                variant="outline"
                className="flex-1"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    测试中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    测试连接
                  </>
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || testing || !config.modelId || !config.apiKey || !config.baseUrl}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    保存配置
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 配置说明 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">配置说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-900 space-y-2">
            <p><strong>快速配置：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>从预设模型列表中选择一个模型</li>
              <li>填写您的API密钥即可完成配置</li>
              <li>模型ID和服务地址会自动填充</li>
            </ul>
            <p className="mt-3"><strong>支持的预设模型：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>OpenAI系列：</strong>GPT-3.5 Turbo、GPT-4、GPT-4 Turbo</li>
              <li><strong>通义千问系列：</strong>Turbo、Plus、Max（中文优化）</li>
              <li><strong>百度文心一言：</strong>ERNIE-Bot Turbo</li>
              <li><strong>本地模型：</strong>Ollama Llama2（需要本地运行Ollama）</li>
            </ul>
            <p className="mt-3"><strong>自定义配置：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>如果您的服务商不在预设列表中，选择"自定义配置"</li>
              <li>手动填写模型ID、API密钥和服务地址</li>
              <li>支持任何兼容OpenAI接口的服务</li>
            </ul>
            <p className="mt-3"><strong>安全提示：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>API密钥将加密存储在数据库中</li>
              <li>建议定期更换API密钥</li>
              <li>不要在公共场合分享您的API密钥</li>
            </ul>
            <p className="mt-3">
              <strong>获取API密钥：</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com/api-keys</a></li>
              <li>通义千问: <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">dashscope.console.aliyun.com</a></li>
              <li>文心一言: <a href="https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.bce.baidu.com</a></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

