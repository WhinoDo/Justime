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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
  Calendar,
  Users,
  MessageSquare,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

interface FeishuApp {
  id: string
  appId: string
  appName: string
  description: string
  permissions: {
    calendar: boolean
    contacts: boolean
    messages: boolean
    documents: boolean
  }
  status: 'active' | 'inactive' | 'expired'
  isVerified: boolean
  verification: {
    lastVerified?: string
    errorMessage?: string
  }
  usage: {
    totalApiCalls: number
    lastUsed?: string
    dailyLimit: number
    monthlyLimit: number
  }
  createdAt: string
  updatedAt: string
  isExpired?: boolean
  remainingDailyLimit?: number
}

export default function FeishuAppsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  
  const [apps, setApps] = useState<FeishuApp[]>([])
  const [activeApp, setActiveApp] = useState<FeishuApp | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // 新建/编辑应用状态
  const [isCreating, setIsCreating] = useState(false)
  const [editingApp, setEditingApp] = useState<FeishuApp | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [formData, setFormData] = useState({
    appId: '',
    appSecret: '',
    appName: '',
    description: '',
    permissions: {
      calendar: false,
      contacts: false,
      messages: false,
      documents: false
    }
  })

  // 加载应用列表
  const loadApps = async () => {
    try {
      setIsLoading(true)
      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口')

      const data = await response.json()

      if (data.success) {
        setApps(data.data.apps)
        setActiveApp(data.data.activeApp)
      } else {
        setError(data.error || '加载应用列表失败')
      }

    } catch (error) {
      console.error('加载应用列表失败:', error)
      setError('加载应用列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 创建应用
  const handleCreateApp = async () => {
    if (!formData.appId || !formData.appSecret) {
      setError('应用ID和应用密钥为必填项')
      return
    }

    try {
      setIsLoading(true)
      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口')
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('应用配置创建成功！')
        setIsCreating(false)
        resetForm()
        await loadApps()
      } else {
        setError(data.error || '创建应用配置失败')
      }

    } catch (error) {
      console.error('创建应用配置失败:', error)
      setError('创建应用配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 更新应用
  const handleUpdateApp = async () => {
    if (!editingApp) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/feishu/apps/${editingApp.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('应用配置更新成功！')
        setEditingApp(null)
        resetForm()
        await loadApps()
      } else {
        setError(data.error || '更新应用配置失败')
      }

    } catch (error) {
      console.error('更新应用配置失败:', error)
      setError('更新应用配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 删除应用
  const handleDeleteApp = async (appId: string) => {
    if (!confirm('确定要删除这个应用配置吗？此操作不可恢复。')) {
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch(`/api/feishu/apps/${appId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('应用配置已删除')
        await loadApps()
      } else {
        setError(data.error || '删除应用配置失败')
      }

    } catch (error) {
      console.error('删除应用配置失败:', error)
      setError('删除应用配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 激活应用
  const handleActivateApp = async (appId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/feishu/apps/${appId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('应用已激活')
        await loadApps()
      } else {
        setError(data.error || '激活应用失败')
      }

    } catch (error) {
      console.error('激活应用失败:', error)
      setError('激活应用失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 验证应用
  const handleVerifyApp = async (appId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/feishu/apps/${appId}/verify`, {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        if (data.data.isValid) {
          setSuccess('应用验证成功')
        } else {
          setError('应用验证失败')
        }
        await loadApps()
      } else {
        setError(data.error || '验证应用失败')
      }

    } catch (error) {
      console.error('验证应用失败:', error)
      setError('验证应用失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      appId: '',
      appSecret: '',
      appName: '',
      description: '',
      permissions: {
        calendar: false,
        contacts: false,
        messages: false,
        documents: false
      }
    })
    setShowSecret(false)
  }

  // 开始编辑
  const startEdit = (app: FeishuApp) => {
    setEditingApp(app)
    setFormData({
      appId: app.appId,
      appSecret: '', // 不显示现有密钥
      appName: app.appName,
      description: app.description,
      permissions: app.permissions
    })
    setIsCreating(true)
  }

  // 初始化
  useEffect(() => {
    if (isAuthenticated) {
      loadApps()
    }
  }, [isAuthenticated])

  // 清除消息
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Settings className="h-6 w-6 text-blue-600" />
                飞书应用管理
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  请先登录账户才能管理飞书应用配置。
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 justify-center">
                <Link href="/auth?mode=login">
                  <Button>登录账户</Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">返回首页</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-8 w-8 text-blue-600" />
              飞书应用管理
            </h1>
            <p className="text-gray-600 mt-1">
              配置您的飞书应用，实现个性化集成
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/profile">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回个人信息
              </Button>
            </Link>
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

        {/* 当前活跃应用 */}
        {activeApp && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-5 w-5" />
                当前活跃应用
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm text-green-700">应用名称</Label>
                  <p className="font-medium text-green-900">{activeApp.appName}</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700">应用ID</Label>
                  <p className="font-medium text-green-900">{activeApp.appId}</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700">验证状态</Label>
                  <Badge className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    已验证
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 创建/编辑应用表单 */}
        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editingApp ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingApp ? '编辑应用配置' : '创建新应用配置'}
              </CardTitle>
              <p className="text-sm text-gray-600">
                {editingApp ? '更新您的飞书应用配置' : '添加您的飞书应用配置以启用个性化功能'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appId">应用ID *</Label>
                  <Input
                    id="appId"
                    value={formData.appId}
                    onChange={(e) => setFormData(prev => ({ ...prev, appId: e.target.value }))}
                    placeholder="cli_xxxxxxxxxx"
                    disabled={!!editingApp}
                  />
                  <p className="text-xs text-gray-500">
                    格式：cli_xxxxxxxxxx
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appSecret">应用密钥 *</Label>
                  <div className="relative">
                    <Input
                      id="appSecret"
                      type={showSecret ? 'text' : 'password'}
                      value={formData.appSecret}
                      onChange={(e) => setFormData(prev => ({ ...prev, appSecret: e.target.value }))}
                      placeholder={editingApp ? '留空表示不更改' : '输入应用密钥'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appName">应用名称</Label>
                <Input
                  id="appName"
                  value={formData.appName}
                  onChange={(e) => setFormData(prev => ({ ...prev, appName: e.target.value }))}
                  placeholder="我的飞书应用"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">应用描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="描述这个应用的用途..."
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <Label>权限配置</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="calendar"
                      checked={formData.permissions.calendar}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, calendar: !!checked }
                        }))
                      }
                    />
                    <Label htmlFor="calendar" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      日历管理
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="contacts"
                      checked={formData.permissions.contacts}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, contacts: !!checked }
                        }))
                      }
                    />
                    <Label htmlFor="contacts" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      通讯录访问
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="messages"
                      checked={formData.permissions.messages}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, messages: !!checked }
                        }))
                      }
                    />
                    <Label htmlFor="messages" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      消息发送
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="documents"
                      checked={formData.permissions.documents}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, documents: !!checked }
                        }))
                      }
                    />
                    <Label htmlFor="documents" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      文档访问
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={editingApp ? handleUpdateApp : handleCreateApp}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {editingApp ? '更新中...' : '创建中...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingApp ? '更新配置' : '创建配置'}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false)
                    setEditingApp(null)
                    resetForm()
                  }}
                  disabled={isLoading}
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 应用列表 */}
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  应用配置列表
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  管理您的飞书应用配置
                </p>
              </div>
              {!isCreating && (
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加应用
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">加载中...</p>
                </div>
              ) : apps.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">暂无应用配置</h3>
                  <p className="text-gray-600 mb-4">
                    添加您的飞书应用配置以启用个性化功能
                  </p>
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加第一个应用
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {apps.map((app) => (
                    <div key={app.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{app.appName}</h3>
                            <Badge variant={app.status === 'active' ? 'default' : 'secondary'}>
                              {app.status === 'active' ? '活跃' : '非活跃'}
                            </Badge>
                            {app.isVerified ? (
                              <Badge className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                已验证
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                未验证
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-gray-600 mb-2">{app.description}</p>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <Label className="text-gray-500">应用ID</Label>
                              <p className="font-mono">{app.appId}</p>
                            </div>
                            <div>
                              <Label className="text-gray-500">API调用次数</Label>
                              <p>{app.usage.totalApiCalls}</p>
                            </div>
                            <div>
                              <Label className="text-gray-500">最后使用</Label>
                              <p>{app.usage.lastUsed ? new Date(app.usage.lastUsed).toLocaleDateString('zh-CN') : '从未使用'}</p>
                            </div>
                            <div>
                              <Label className="text-gray-500">权限</Label>
                              <div className="flex gap-1 mt-1">
                                {app.permissions.calendar && <Calendar className="h-4 w-4 text-blue-500" title="日历" />}
                                {app.permissions.contacts && <Users className="h-4 w-4 text-green-500" title="通讯录" />}
                                {app.permissions.messages && <MessageSquare className="h-4 w-4 text-purple-500" title="消息" />}
                                {app.permissions.documents && <FileText className="h-4 w-4 text-orange-500" title="文档" />}
                              </div>
                            </div>
                          </div>

                          {app.verification.errorMessage && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>{app.verification.errorMessage}</AlertDescription>
                            </Alert>
                          )}
                        </div>

                        <div className="flex gap-2 ml-4">
                          {app.status !== 'active' && app.isVerified && (
                            <Button
                              size="sm"
                              onClick={() => handleActivateApp(app.id)}
                              disabled={isLoading}
                            >
                              激活
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerifyApp(app.id)}
                            disabled={isLoading}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(app)}
                            disabled={isLoading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteApp(app.id)}
                            disabled={isLoading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              使用说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">如何获取飞书应用配置？</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>访问 <a href="https://open.feishu.cn/" target="_blank" className="text-blue-600 hover:underline">飞书开放平台</a></li>
                  <li>创建企业自建应用</li>
                  <li>在应用详情页面获取 App ID 和 App Secret</li>
                  <li>配置应用权限和回调地址</li>
                  <li>将配置信息填入上方表单</li>
                </ol>
              </div>

              <div>
                <h4 className="font-medium mb-2">权限说明</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li><Calendar className="h-4 w-4 inline mr-1" />日历管理：创建、查看、编辑日程</li>
                  <li><Users className="h-4 w-4 inline mr-1" />通讯录访问：获取用户和部门信息</li>
                  <li><MessageSquare className="h-4 w-4 inline mr-1" />消息发送：发送通知和提醒</li>
                  <li><FileText className="h-4 w-4 inline mr-1" />文档访问：读取和创建文档</li>
                </ul>
              </div>
            </div>

            <Separator />

            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">注意事项：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>每个账户只能有一个活跃的飞书应用配置</li>
                <li>应用密钥将被加密存储，请妥善保管</li>
                <li>应用配置需要验证通过后才能使用</li>
                <li>建议定期检查应用权限和使用情况</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
