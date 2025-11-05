'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { 
  Settings, 
  Key, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Trash2,
  Plus
} from 'lucide-react'

interface FeishuAppConfigProps {
  userId?: string
  onConfigSaved?: (config: any) => void
  onConfigDeleted?: () => void
}

export function FeishuAppConfig({ 
  userId, 
  onConfigSaved, 
  onConfigDeleted 
}: FeishuAppConfigProps) {
  const [formData, setFormData] = useState({
    appId: '',
    appSecret: '',
    appName: '',
    description: '',
    permissions: {
      calendar: true,
      contacts: false,
      messages: false,
      documents: false
    }
  })

  const [showSecret, setShowSecret] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [existingApps, setExistingApps] = useState<any[]>([])
  const [activeApp, setActiveApp] = useState<any>(null)

  useEffect(() => {
    if (userId) {
      loadExistingApps()
    }
  }, [userId])

  const loadExistingApps = async () => {
    try {
      const response = await fetch(`/api/database/feishu-apps?userId=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setExistingApps(data.data.apps || [])
        setActiveApp(data.data.activeApp)
        
        // 如果有活跃应用，填充表单
        if (data.data.activeApp) {
          setFormData({
            appId: data.data.activeApp.appId,
            appSecret: '••••••••••••••••', // 不显示真实密钥
            appName: data.data.activeApp.appName || '',
            description: data.data.activeApp.description || '',
            permissions: data.data.activeApp.permissions || {
              calendar: true,
              contacts: false,
              messages: false,
              documents: false
            }
          })
        }
      }
    } catch (error) {
      console.error('加载应用配置失败:', error)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
    setSuccess(null)
  }

  const handlePermissionChange = (permission: string, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: enabled
      }
    }))
  }

  const validateForm = () => {
    if (!formData.appId.trim()) {
      setError('请输入飞书应用ID')
      return false
    }

    if (!formData.appId.startsWith('cli_')) {
      setError('应用ID格式错误，应该以 cli_ 开头')
      return false
    }

    if (!formData.appSecret.trim() || formData.appSecret === '••••••••••••••••') {
      setError('请输入飞书应用密钥')
      return false
    }

    if (formData.appSecret.length < 20) {
      setError('应用密钥长度不足，至少需要20个字符')
      return false
    }

    return true
  }

  const testConfiguration = async () => {
    if (!validateForm()) return

    setIsVerifying(true)
    setError(null)

    try {
      const response = await fetch('/api/database/feishu-apps/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: formData.appId,
          appSecret: formData.appSecret
        })
      })

      const data = await response.json()

      if (data.success && data.data.isValid) {
        setSuccess('✅ 应用配置验证成功！')
      } else {
        setError(data.data.error || '应用配置验证失败')
      }

    } catch (error) {
      setError('验证应用配置时发生错误')
    } finally {
      setIsVerifying(false)
    }
  }

  const saveConfiguration = async () => {
    if (!validateForm()) return
    if (!userId) {
      setError('用户ID不存在')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/database/feishu-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          config: formData
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('✅ 飞书应用配置保存成功！')
        onConfigSaved?.(data.data.app)
        await loadExistingApps() // 重新加载应用列表
      } else {
        setError(data.error || '保存配置失败')
      }

    } catch (error) {
      setError('保存配置时发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  const verifyAndActivate = async (appId: string) => {
    if (!userId) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/database/feishu-apps/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, appId })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('✅ 应用验证并激活成功！')
        await loadExistingApps()
      } else {
        setError(data.error || '验证应用失败')
      }

    } catch (error) {
      setError('验证应用时发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteApp = async (appId: string) => {
    if (!userId) return
    if (!confirm('确定要删除这个应用配置吗？')) return

    try {
      const response = await fetch(`/api/database/feishu-apps?userId=${userId}&appId=${appId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('✅ 应用配置已删除')
        onConfigDeleted?.()
        await loadExistingApps()

        // 如果删除的是当前表单中的应用，清空表单
        if (formData.appId === appId) {
          setFormData({
            appId: '',
            appSecret: '',
            appName: '',
            description: '',
            permissions: {
              calendar: true,
              contacts: false,
              messages: false,
              documents: false
            }
          })
        }
      } else {
        setError(data.error || '删除应用失败')
      }

    } catch (error) {
      setError('删除应用时发生错误')
    }
  }

  const requestAuthorization = async () => {
    if (!validateForm()) return
    if (!userId) {
      setError('用户ID不存在')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 首先保存配置
      const saveResponse = await fetch('/api/database/feishu-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          config: formData
        })
      })

      const saveData = await saveResponse.json()

      if (!saveData.success) {
        setError(saveData.error || '保存配置失败')
        return
      }

      // 生成授权URL
      const authResponse = await fetch('/api/feishu/qr-login/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: formData.appId,
          userId: userId,
          permissions: Object.keys(formData.permissions).filter(key => formData.permissions[key])
        })
      })

      const authData = await authResponse.json()

      if (authData.success && authData.data.authUrl) {
        setSuccess('✅ 配置保存成功！正在跳转到飞书授权页面...')

        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
          window.open(authData.data.authUrl, '_blank')
        }, 1500)

        await loadExistingApps() // 重新加载应用列表
      } else {
        setError(authData.error || '生成授权链接失败')
      }

    } catch (error) {
      console.error('请求授权失败:', error)
      setError('请求授权时发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 现有应用列表 */}
      {existingApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              已配置的飞书应用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {existingApps.map((app) => (
                <div key={app._id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{app.appName || '未命名应用'}</span>
                      {app.status === 'active' && app.isVerified && (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          活跃
                        </Badge>
                      )}
                      {app.status === 'inactive' && (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          未激活
                        </Badge>
                      )}
                      {app.status === 'expired' && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          已过期
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      应用ID: {app.appId}
                    </p>
                    {app.description && (
                      <p className="text-xs text-gray-500 mt-1">{app.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {app.status !== 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verifyAndActivate(app.appId)}
                        disabled={isLoading}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        激活
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteApp(app.appId)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 配置表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {activeApp ? '更新飞书应用配置' : '添加飞书应用配置'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 帮助信息 */}
          <Alert>
            <ExternalLink className="h-4 w-4" />
            <AlertDescription>
              请先在 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">飞书开放平台</a> 创建应用，获取应用ID和密钥。
              确保应用已开通日历权限。
            </AlertDescription>
          </Alert>

          {/* 错误和成功提示 */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* 应用ID */}
          <div className="space-y-2">
            <Label htmlFor="appId">应用ID *</Label>
            <Input
              id="appId"
              placeholder="cli_xxxxxxxxxxxxxxxxxx"
              value={formData.appId}
              onChange={(e) => handleInputChange('appId', e.target.value)}
            />
            <p className="text-xs text-gray-500">
              格式：cli_ 开头的字符串，可在飞书开放平台应用详情页找到
            </p>
          </div>

          {/* 应用密钥 */}
          <div className="space-y-2">
            <Label htmlFor="appSecret">应用密钥 *</Label>
            <div className="relative">
              <Input
                id="appSecret"
                type={showSecret ? 'text' : 'password'}
                placeholder="请输入应用密钥"
                value={formData.appSecret}
                onChange={(e) => handleInputChange('appSecret', e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              应用密钥将被加密存储，仅用于API调用
            </p>
          </div>

          {/* 应用名称 */}
          <div className="space-y-2">
            <Label htmlFor="appName">应用名称</Label>
            <Input
              id="appName"
              placeholder="我的飞书应用"
              value={formData.appName}
              onChange={(e) => handleInputChange('appName', e.target.value)}
            />
          </div>

          {/* 应用描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">应用描述</Label>
            <Textarea
              id="description"
              placeholder="描述这个应用的用途..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <Separator />

          {/* 权限设置 */}
          <div className="space-y-3">
            <Label>应用权限</Label>
            <div className="space-y-3">
              {Object.entries({
                calendar: '日历权限',
                contacts: '通讯录权限',
                messages: '消息权限',
                documents: '文档权限'
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key} className="text-sm font-normal">
                    {label}
                  </Label>
                  <Switch
                    id={key}
                    checked={formData.permissions[key as keyof typeof formData.permissions]}
                    onCheckedChange={(checked) => handlePermissionChange(key, checked)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              请确保在飞书开放平台为应用开通相应权限
            </p>
          </div>

          <Separator />

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={testConfiguration}
              variant="outline"
              disabled={isVerifying || isLoading}
            >
              {isVerifying ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              测试配置
            </Button>

            <Button
              onClick={saveConfiguration}
              variant="outline"
              disabled={isLoading || isVerifying}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              保存配置
            </Button>

            <Button
              onClick={requestAuthorization}
              disabled={isLoading || isVerifying || !formData.appId || !formData.appSecret}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              申请授权
            </Button>
          </div>

          {/* 授权说明 */}
          <Alert className="border-blue-200 bg-blue-50">
            <ExternalLink className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>授权流程：</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>填写应用ID和应用密钥</li>
                <li>选择需要的权限</li>
                <li>点击"申请授权"按钮</li>
                <li>在弹出的飞书页面中确认授权</li>
                <li>授权完成后返回本页面查看状态</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

export default FeishuAppConfig
