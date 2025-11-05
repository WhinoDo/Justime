'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  RefreshCw,
  CheckCircle,
  Link as LinkIcon,
  Unlink,
  ArrowLeft,
  UserX,
  Lock,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'

// 模拟飞书绑定数据生成函数
const getMockFeishuBinding = (isAuthorized: boolean) => ({
  openId: 'ou_7d8a6e6e7f8a9b0c1d2e3f4g5h6i7j8k',
  unionId: 'on_4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p',
  name: '张三',
  avatar: 'https://s1-imfile.feishucdn.com/static-resource/v1/v2_041b28bb-37b9-4f3e-9c8d-7e6f5a4b3c2d~?image_size=72x72&cut_type=&quality=&format=image&sticker_format=.webp',
  email: 'zhangsan@company.com',
  mobile: '+86 138****8888',
  department: '技术部',
  employeeId: 'EMP001',
  bindTime: new Date('2024-01-15T10:30:00'),
  lastSyncTime: new Date('2024-01-20T14:20:00'),
  isActive: true,
  integration: {
    isActive: isAuthorized,
    calendarId: 'cal_123456789',
    tokenExpiresAt: new Date('2024-02-15T10:30:00')
  }
})

export default function TestFeishuDisplayPage() {
  const [showBound, setShowBound] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(true)

  const mockFeishuBinding = getMockFeishuBinding(isAuthorized)

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              飞书绑定显示测试
            </h1>
            <p className="text-gray-600 mt-1">
              测试飞书绑定信息的显示效果
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowBound(!showBound)}
              variant="outline"
            >
              {showBound ? '显示未绑定' : '显示已绑定'}
            </Button>
            {showBound && (
              <Button
                onClick={() => setIsAuthorized(!isAuthorized)}
                variant="outline"
              >
                {isAuthorized ? '取消授权' : '重新授权'}
              </Button>
            )}
            <Link href="/profile">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回个人信息
              </Button>
            </Link>
          </div>
        </div>

        {/* 飞书绑定卡片 */}
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
            <Button variant="outline" size="sm">
              <Shield className="h-4 w-4 mr-2" />
              应用管理
            </Button>
          </CardHeader>
          <CardContent>
            {showBound ? (
              <div className="space-y-4">
                {/* 飞书用户信息 */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-blue-200">
                      {mockFeishuBinding.avatar ? (
                        <img
                          src={mockFeishuBinding.avatar}
                          alt={mockFeishuBinding.name}
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-10 w-10 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-bold text-xl text-gray-900">{mockFeishuBinding.name}</h3>
                        <Badge className="bg-green-500 hover:bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          已绑定
                        </Badge>
                      </div>
                      
                      {/* 基本信息网格 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {mockFeishuBinding.email && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Mail className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">邮箱:</span>
                            <span>{mockFeishuBinding.email}</span>
                          </div>
                        )}
                        
                        {mockFeishuBinding.mobile && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Phone className="h-4 w-4 text-green-500" />
                            <span className="font-medium">手机:</span>
                            <span>{mockFeishuBinding.mobile}</span>
                          </div>
                        )}
                        
                        {mockFeishuBinding.department && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <User className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">部门:</span>
                            <span>{mockFeishuBinding.department}</span>
                          </div>
                        )}
                        
                        {mockFeishuBinding.employeeId && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Shield className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">员工ID:</span>
                            <span className="font-mono">{mockFeishuBinding.employeeId}</span>
                          </div>
                        )}
                      </div>

                      {/* 技术信息 */}
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
                          <div>
                            <span className="font-medium">OpenID:</span>
                            <span className="ml-1 font-mono break-all">
                              {mockFeishuBinding.openId.substring(0, 12)}...
                            </span>
                          </div>
                          
                          {mockFeishuBinding.unionId && (
                            <div>
                              <span className="font-medium">UnionID:</span>
                              <span className="ml-1 font-mono break-all">
                                {mockFeishuBinding.unionId.substring(0, 12)}...
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
                        {mockFeishuBinding.bindTime.toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-600 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        最后同步
                      </Label>
                      <p className="font-medium text-gray-900 mt-1">
                        {mockFeishuBinding.lastSyncTime.toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-600 flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        绑定状态
                      </Label>
                      <p className="font-medium mt-1">
                        <Badge variant={mockFeishuBinding.isActive ? "default" : "secondary"}>
                          {mockFeishuBinding.isActive ? "活跃" : "非活跃"}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  {/* 集成状态 */}
                  {mockFeishuBinding.integration && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <LinkIcon className="h-4 w-4 text-green-500" />
                        集成状态
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <Label className="text-gray-600">API集成</Label>
                          <p className="font-medium">
                            <Badge variant={mockFeishuBinding.integration.isActive ? "default" : "secondary"}>
                              {mockFeishuBinding.integration.isActive ? "已启用" : "未启用"}
                            </Badge>
                          </p>
                        </div>
                        {mockFeishuBinding.integration.calendarId && (
                          <div>
                            <Label className="text-gray-600">日历集成</Label>
                            <p className="font-medium text-green-600">已连接</p>
                          </div>
                        )}
                        {mockFeishuBinding.integration.tokenExpiresAt && (
                          <div>
                            <Label className="text-gray-600">Token过期时间</Label>
                            <p className="font-medium text-gray-900">
                              {mockFeishuBinding.integration.tokenExpiresAt.toLocaleString('zh-CN')}
                            </p>
                          </div>
                        )}
                      </div>
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
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      同步信息
                    </Button>

                    {/* 取消授权按钮 */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAuthorized(!isAuthorized)}
                      disabled={!mockFeishuBinding.integration?.isActive}
                      className="text-orange-600 hover:text-orange-700 hover:border-orange-300"
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      取消授权
                    </Button>
                  </div>

                  {/* 危险操作 */}
                  <div className="pt-2 border-t border-gray-200">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      完全解绑
                    </Button>
                  </div>

                  {/* 授权状态提示 */}
                  {mockFeishuBinding.integration && (
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        <span>
                          授权状态: {mockFeishuBinding.integration.isActive ? (
                            <span className="text-green-600 font-medium">已授权</span>
                          ) : (
                            <span className="text-orange-600 font-medium">已取消授权</span>
                          )}
                        </span>
                      </div>
                      {mockFeishuBinding.integration.tokenExpiresAt && (
                        <div className="mt-1">
                          Token过期: {mockFeishuBinding.integration.tokenExpiresAt.toLocaleString('zh-CN')}
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

                {/* 绑定按钮 */}
                <div className="text-center pt-4">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    绑定飞书账号
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
