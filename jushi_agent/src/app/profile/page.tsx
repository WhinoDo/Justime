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
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Shield,
  Link as LinkIcon,
  Unlink,
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Edit,
  Camera,
  Settings,
  UserX,
  Lock
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
export default function ProfilePage() {
  const { user: authUser, isAuthenticated, isLoading: authLoading, updateUser } = useAuth()
  const { login: feishuLogin, userInfo: feishuUserInfo, isLoggedIn: isFeishuLoggedIn } = useFeishuLogin()

  const [isEditing, setIsEditing] = useState(false)
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    phone: '',
    location: '',
    website: '',
    jobTitle: '',
    department: ''
  })

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isBinding, setIsBinding] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  // 当认证用户变化时更新表单数据
  useEffect(() => {
    if (authUser && authUser.profile) {
      setProfileData({
        displayName: authUser.profile.displayName || '',
        bio: authUser.profile.bio || '',
        phone: authUser.profile.phone || '',
        location: authUser.profile.location || '',
        website: authUser.profile.website || '',
        jobTitle: authUser.profile.jobTitle || '',
        department: authUser.profile.department || ''
      })
    }
  }, [authUser])

  // 处理飞书登录后的绑定逻辑
  useEffect(() => {
    const handleFeishuBindAfterLogin = async () => {
      const pendingBind = localStorage.getItem('pending_feishu_bind')
      const returnUrl = localStorage.getItem('bind_return_url')

      if (pendingBind === 'true' && isFeishuLoggedIn && feishuUserInfo && isAuthenticated) {
        // 清除标记
        localStorage.removeItem('pending_feishu_bind')
        localStorage.removeItem('bind_return_url')

        try {
          // 执行绑定
          const response = await fetch('/api/auth/bind-feishu', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              openId: feishuUserInfo.openId,
              unionId: feishuUserInfo.unionId,
              name: feishuUserInfo.name,
              avatar: feishuUserInfo.avatar,
              email: feishuUserInfo.email,
              mobile: feishuUserInfo.mobile
            })
          })

          const data = await response.json()

          if (data.success) {
            updateUser(data.data.user)
            setSuccess('飞书账号绑定成功！')
          } else {
            setError(data.error || '绑定失败')
          }
        } catch (error) {
          console.error('自动绑定飞书账号失败:', error)
          setError('绑定飞书账号时发生错误')
        }
      }
    }

    handleFeishuBindAfterLogin()
  }, [isFeishuLoggedIn, feishuUserInfo, isAuthenticated, updateUser])

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
    if (error) setError(null)
    if (success) setSuccess(null)
  }

  const handleSaveProfile = async () => {
    if (!isAuthenticated || !authUser) {
      setError('请先登录后再保存资料')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          profile: profileData
        })
      })

      const data = await response.json()

      if (data.success) {
        // 更新认证状态中的用户信息
        updateUser({
          profile: {
            ...authUser.profile,
            ...profileData
          }
        })
        setSuccess('个人资料保存成功！')
        setIsEditing(false)
      } else {
        setError(data.error || '保存资料失败')
      }

    } catch (error) {
      console.error('保存资料失败:', error)
      setError('保存资料失败，请稍后重试')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBindFeishu = async () => {
    if (!isAuthenticated || !authUser) {
      setError('请先登录后再绑定飞书账号')
      return
    }

    console.log('🔗 开始绑定飞书账号流程', {
      isFeishuLoggedIn,
      hasFeishuUserInfo: !!feishuUserInfo,
      feishuUserInfo
    })

    setIsBinding(true)
    setError(null)

    try {
      // 检查是否已经有飞书登录信息
      if (isFeishuLoggedIn && feishuUserInfo) {
        console.log('📋 飞书用户信息:', feishuUserInfo)

        // 验证必要字段
        if (!feishuUserInfo.openId || !feishuUserInfo.name) {
          setError('飞书用户信息不完整，请重新登录飞书')
          return
        }

        // 如果已经登录飞书，直接进行绑定
        const bindData = {
          openId: feishuUserInfo.openId,
          unionId: feishuUserInfo.unionId,
          name: feishuUserInfo.name,
          avatar: feishuUserInfo.avatar,
          email: feishuUserInfo.email,
          mobile: feishuUserInfo.mobile
        }

        console.log('📤 发送绑定数据:', bindData)

        const response = await fetch('/api/auth/bind-feishu', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(bindData)
        })

        const data = await response.json()
        console.log('📥 绑定响应:', data)

        if (data.success) {
          // 更新认证状态中的用户信息
          updateUser(data.data.user)
          setSuccess('飞书账号绑定成功！')
        } else {
          setError(data.error || '绑定失败')
        }
      } else {
        // 生成动态授权URL
        const response = await fetch('/api/feishu/qr-login/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            loginTime: Date.now().toString(),
            redirect_uri: `${window.location.origin}/feishu/bind-callback`,
            url: window.location.href
          })
        })

        const data = await response.json()

        if (data.success) {
          setSuccess('正在跳转到飞书授权页面...')

          // 延迟跳转，让用户看到提示
          setTimeout(() => {
            window.location.href = data.data.authUrl
          }, 1000)
        } else {
          setError(data.error || '生成授权链接失败')
        }
      }

    } catch (error) {
      console.error('绑定飞书账号失败:', error)
      setError('绑定飞书账号时发生错误')
    } finally {
      setIsBinding(false)
    }
  }

  const handleUnbindFeishu = async () => {
    if (!isAuthenticated || !authUser) {
      setError('请先登录后再解绑飞书账号')
      return
    }

    if (!confirm('确定要解绑飞书账号吗？解绑后将无法使用飞书相关功能。')) {
      return
    }

    try {
      const response = await fetch('/api/auth/bind-feishu', {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        // 更新认证状态中的用户信息
        updateUser(data.data.user)
        setSuccess('飞书账号解绑成功！')
      } else {
        setError(data.error || '解绑失败')
      }

    } catch (error) {
      console.error('解绑飞书账号失败:', error)
      setError('解绑飞书账号时发生错误')
    }
  }

  // 取消授权函数
  const handleRevokeAuthorization = async () => {
    if (!isAuthenticated || !authUser || !authUser.feishuBinding) {
      setError('没有可取消的授权')
      return
    }

    // 确认对话框
    const confirmed = window.confirm(
      '确定要取消飞书应用的授权吗？\n\n这将会：\n' +
      '• 撤销应用访问您飞书数据的权限\n' +
      '• 删除存储的访问令牌\n' +
      '• 保留绑定关系（您仍可以使用飞书登录）\n\n' +
      '如需完全解除关联，请使用"解绑账号"功能。'
    )

    if (!confirmed) {
      return
    }

    setIsRevoking(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/revoke-feishu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        // 更新用户信息
        updateUser(data.data.user)
        setSuccess('飞书应用授权已取消！您仍可以使用飞书登录，但应用将无法访问您的飞书数据。')
      } else {
        setError(data.error || '取消授权失败')
      }

    } catch (error) {
      console.error('取消飞书授权失败:', error)
      setError('取消授权时发生错误')
    } finally {
      setIsRevoking(false)
    }
  }

  const cancelEdit = () => {
    setIsEditing(false)
    if (authUser && authUser.profile) {
      setProfileData({
        displayName: authUser.profile.displayName || '',
        bio: authUser.profile.bio || '',
        phone: authUser.profile.phone || '',
        location: authUser.profile.location || '',
        website: authUser.profile.website || '',
        jobTitle: authUser.profile.jobTitle || '',
        department: authUser.profile.department || ''
      })
    }
    setError(null)
    setSuccess(null)
  }

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

  // 如果正在加载认证状态
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

  // 如果用户未登录
  if (!isAuthenticated || !authUser) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首页
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <User className="h-6 w-6 text-blue-600" />
                个人信息管理
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  请先登录账户才能管理个人信息和绑定飞书账号。
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

    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <User className="h-8 w-8 text-blue-600" />
              个人信息
            </h1>
            <p className="text-gray-600 mt-1">
              管理您的个人信息和账户设置
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首页
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 个人资料卡片 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    基本信息
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    管理您的个人基本信息
                  </p>
                </div>
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 头像区域 */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                      {authUser.profile?.avatar ? (
                        <img
                          src={authUser.profile.avatar}
                          alt={authUser.profile?.name || authUser.username || '用户头像'}
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-10 w-10 text-blue-600" />
                      )}
                    </div>
                    {isEditing && (
                      <Button
                        size="sm"
                        className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{authUser.profile?.displayName || authUser.username || '未设置'}</h3>
                    <p className="text-gray-600">{authUser.email || '未设置邮箱'}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={authUser.isEmailVerified ? "default" : "secondary"}>
                        {authUser.isEmailVerified ? "邮箱已验证" : "邮箱未验证"}
                      </Badge>
                      {authUser.profile?.phone && (
                        <Badge variant={authUser.isPhoneVerified ? "default" : "secondary"}>
                          {authUser.isPhoneVerified ? "手机已验证" : "手机未验证"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 表单字段 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">显示名称</Label>
                    <Input
                      id="displayName"
                      value={profileData.displayName}
                      onChange={(e) => handleInputChange('displayName', e.target.value)}
                      placeholder="请输入显示名称"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">手机号</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="请输入手机号"
                        className="pl-10"
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">地理位置</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="location"
                        value={profileData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="请输入所在地"
                        className="pl-10"
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">个人网站</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="website"
                        value={profileData.website}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        placeholder="https://example.com"
                        className="pl-10"
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">职位</Label>
                    <Input
                      id="jobTitle"
                      value={profileData.jobTitle}
                      onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                      placeholder="请输入职位"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">部门</Label>
                    <Input
                      id="department"
                      value={profileData.department}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                      placeholder="请输入部门"
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">个人简介</Label>
                  <Textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="介绍一下自己..."
                    rows={4}
                    disabled={!isEditing}
                  />
                </div>

                {/* 操作按钮 */}
                {isEditing && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          保存资料
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEdit}
                      disabled={isSaving}
                    >
                      取消
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 飞书绑定 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    飞书账号绑定
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    绑定飞书账号以享受更多功能
                  </p>
                </div>
                <Link href="/feishu/apps">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    应用管理
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {authUser.feishuBinding && authUser.feishuBinding.isActive ? (
                  <div className="space-y-4">
                    {/* 飞书用户信息 */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-blue-200">
                          {authUser.feishuBinding.avatar ? (
                            <img
                              src={authUser.feishuBinding.avatar}
                              alt={authUser.feishuBinding.name}
                              className="w-20 h-20 rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-10 w-10 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-bold text-xl text-gray-900">{authUser.feishuBinding.name}</h3>
                            <Badge className="bg-green-500 hover:bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              已绑定
                            </Badge>
                          </div>

                          {/* 基本信息网格 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {authUser.feishuBinding.email && (
                              <div className="flex items-center gap-2 text-gray-700">
                                <Mail className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">邮箱:</span>
                                <span>{authUser.feishuBinding.email}</span>
                              </div>
                            )}

                            {authUser.feishuBinding.mobile && (
                              <div className="flex items-center gap-2 text-gray-700">
                                <Phone className="h-4 w-4 text-green-500" />
                                <span className="font-medium">手机:</span>
                                <span>{authUser.feishuBinding.mobile}</span>
                              </div>
                            )}

                            {authUser.feishuBinding.department && (
                              <div className="flex items-center gap-2 text-gray-700">
                                <User className="h-4 w-4 text-purple-500" />
                                <span className="font-medium">部门:</span>
                                <span>{authUser.feishuBinding.department}</span>
                              </div>
                            )}

                            {authUser.feishuBinding.employeeId && (
                              <div className="flex items-center gap-2 text-gray-700">
                                <Shield className="h-4 w-4 text-orange-500" />
                                <span className="font-medium">员工ID:</span>
                                <span className="font-mono">{authUser.feishuBinding.employeeId}</span>
                              </div>
                            )}
                          </div>

                          {/* 技术信息 */}
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
                              <div>
                                <span className="font-medium">OpenID:</span>
                                <span className="ml-1 font-mono break-all">
                                  {authUser.feishuBinding.openId ?
                                    `${authUser.feishuBinding.openId.substring(0, 12)}...` :
                                    '未获取'
                                  }
                                </span>
                              </div>

                              {authUser.feishuBinding.unionId && (
                                <div>
                                  <span className="font-medium">UnionID:</span>
                                  <span className="ml-1 font-mono break-all">
                                    {authUser.feishuBinding.unionId.substring(0, 12)}...
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 绑定详情 */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        绑定详情
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label className="text-gray-600 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            绑定时间
                          </Label>
                          <p className="font-medium text-gray-900 mt-1">
                            {authUser.feishuBinding?.bindTime
                              ? new Date(authUser.feishuBinding.bindTime).toLocaleString('zh-CN')
                              : '暂无记录'
                            }
                          </p>
                        </div>
                        <div>
                          <Label className="text-gray-600 flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            最后同步
                          </Label>
                          <p className="font-medium text-gray-900 mt-1">
                            {authUser.feishuBinding?.lastSyncTime
                              ? new Date(authUser.feishuBinding.lastSyncTime).toLocaleString('zh-CN')
                              : '暂无记录'
                            }
                          </p>
                        </div>
                        <div>
                          <Label className="text-gray-600 flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            绑定状态
                          </Label>
                          <div className="font-medium mt-1">
                            <Badge variant={authUser.feishuBinding?.isActive ? "default" : "secondary"}>
                              {authUser.feishuBinding?.isActive ? "活跃" : "非活跃"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* 集成状态 */}
                      {authUser.feishuBinding?.integration && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-green-500" />
                            集成状态
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <Label className="text-gray-600">API集成</Label>
                              <div className="font-medium">
                                <Badge variant={authUser.feishuBinding.integration.isActive ? "default" : "secondary"}>
                                  {authUser.feishuBinding.integration.isActive ? "已启用" : "未启用"}
                                </Badge>
                              </div>
                            </div>
                            {authUser.feishuBinding.integration.calendarId && (
                              <div>
                                <Label className="text-gray-600">日历集成</Label>
                                <p className="font-medium text-green-600">已连接</p>
                              </div>
                            )}
                            {authUser.feishuBinding.integration.tokenExpiresAt && (
                              <div>
                                <Label className="text-gray-600">Token过期时间</Label>
                                <p className="font-medium text-gray-900">
                                  {new Date(authUser.feishuBinding.integration.tokenExpiresAt).toLocaleString('zh-CN')}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* 重新授权按钮 */}
                          {!authUser.feishuBinding.integration.isActive && (
                            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <div className="flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm text-orange-800 mb-2">
                                    应用授权已取消，部分功能可能无法正常使用。
                                  </p>
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch('/api/auth/revoke-feishu', {
                                          method: 'PUT',
                                          credentials: 'include'
                                        })
                                        const data = await response.json()
                                        if (data.success) {
                                          window.location.href = data.data.authUrl
                                        } else {
                                          setError(data.error || '生成授权链接失败')
                                        }
                                      } catch (error) {
                                        setError('生成授权链接失败')
                                      }
                                    }}
                                    className="bg-orange-600 hover:bg-orange-700"
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    重新授权
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* 功能说明 */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">已启用功能：</h4>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          ✓ 飞书登录
                        </Badge>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          ✓ 日程同步
                        </Badge>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          ✓ 消息通知
                        </Badge>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          ✓ 用户信息同步
                        </Badge>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="space-y-3">
                      {/* 主要操作 */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // 模拟同步操作
                            setSuccess('飞书信息同步成功！')
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          同步信息
                        </Button>

                        {/* 取消授权按钮 */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRevokeAuthorization}
                          disabled={isRevoking || !authUser.feishuBinding?.integration?.isActive}
                          className="text-orange-600 hover:text-orange-700 hover:border-orange-300"
                        >
                          {isRevoking ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              取消中...
                            </>
                          ) : (
                            <>
                              <UserX className="h-4 w-4 mr-2" />
                              取消授权
                            </>
                          )}
                        </Button>
                      </div>

                      {/* 危险操作 */}
                      <div className="pt-2 border-t border-gray-200">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUnbindFeishu}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          <Unlink className="h-4 w-4 mr-2" />
                          完全解绑
                        </Button>
                      </div>

                      {/* 授权状态提示 */}
                      {authUser.feishuBinding?.integration && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Lock className="h-3 w-3" />
                            <span>
                              授权状态: {authUser.feishuBinding.integration.isActive ? (
                                <span className="text-green-600 font-medium">已授权</span>
                              ) : (
                                <span className="text-orange-600 font-medium">已取消授权</span>
                              )}
                            </span>
                          </div>
                          {authUser.feishuBinding.integration.tokenExpiresAt && (
                            <div className="mt-1">
                              Token过期: {new Date(authUser.feishuBinding.integration.tokenExpiresAt).toLocaleString('zh-CN')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 未绑定状态 */}
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LinkIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="font-medium text-gray-900 mb-2">尚未绑定飞书账号</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        绑定飞书账号后，您可以享受以下功能：
                      </p>
                    </div>

                    {/* 功能介绍 */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>飞书快速登录</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>日程管理同步</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>消息推送通知</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>团队协作功能</span>
                      </div>
                    </div>

                    {/* 应用配置提示 */}
                    <Alert className="border-blue-200 bg-blue-50">
                      <Settings className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        <span className="block space-y-2">
                          <span className="block font-medium">使用您自己的飞书应用</span>
                          <span className="block text-sm">
                            您可以配置自己的飞书应用来获得更好的集成体验和更高的API限额。
                          </span>
                          <Link href="/feishu/apps" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 underline">
                            <Settings className="h-3 w-3" />
                            配置飞书应用
                          </Link>
                        </span>
                      </AlertDescription>
                    </Alert>

                    <Button
                      onClick={handleBindFeishu}
                      disabled={isBinding}
                      className="w-full"
                    >
                      {isBinding ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          正在绑定...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          绑定飞书账号
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 账户信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  账户信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm text-gray-600">用户名</Label>
                  <p className="font-medium">{authUser.username}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">邮箱</Label>
                  <p className="font-medium">{authUser.email}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">角色</Label>
                  <Badge variant="outline">{authUser.role === 'user' ? '普通用户' : authUser.role}</Badge>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">状态</Label>
                  <Badge className="bg-green-500">
                    {authUser.status === 'active' ? '活跃' : authUser.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">注册时间</Label>
                  <p className="font-medium">
                    {authUser.createdAt
                      ? new Date(authUser.createdAt).toLocaleDateString('zh-CN')
                      : '暂无记录'
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">最后登录</Label>
                  <p className="font-medium">
                    {authUser.lastLoginAt
                      ? new Date(authUser.lastLoginAt).toLocaleString('zh-CN')
                      : '暂无记录'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 使用统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  使用统计
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm text-gray-600">总会话数</Label>
                  <p className="font-medium text-lg">{authUser.statistics?.totalSessions || 0}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">总消息数</Label>
                  <p className="font-medium text-lg">{authUser.statistics?.totalMessages || 0}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Token使用量</Label>
                  <p className="font-medium text-lg">{(authUser.statistics?.totalTokens || 0).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">最后活跃</Label>
                  <p className="font-medium">
                    {authUser.statistics?.lastActiveAt
                      ? new Date(authUser.statistics.lastActiveAt).toLocaleString('zh-CN')
                      : '暂无记录'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 快捷操作 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  快捷操作
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  验证邮箱
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Phone className="h-4 w-4 mr-2" />
                  验证手机
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  修改密码
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新数据
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
