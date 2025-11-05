'use client'

import { useFeishuAuth } from '@/lib/hooks/useFeishuAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Phone, Building, LogOut, Loader2 } from 'lucide-react'

export default function UserProfile() {
  const { isAuthenticated, isLoading, userInfo, tokenInfo, logout } = useFeishuAuth()

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">加载用户信息...</span>
        </CardContent>
      </Card>
    )
  }

  if (!isAuthenticated || !userInfo) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="text-center p-6">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">未登录</p>
        </CardContent>
      </Card>
    )
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={userInfo.avatarUrl} alt={userInfo.name} />
            <AvatarFallback>
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
        </div>
        <CardTitle className="text-xl font-bold">{userInfo.name}</CardTitle>
        <Badge variant="secondary" className="w-fit mx-auto">
          飞书用户
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 用户信息 */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3 text-sm">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">用户ID:</span>
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
              {userInfo.openId}
            </span>
          </div>

          {userInfo.email && (
            <div className="flex items-center space-x-3 text-sm">
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">邮箱:</span>
              <span>{userInfo.email}</span>
            </div>
          )}

          {userInfo.mobile && (
            <div className="flex items-center space-x-3 text-sm">
              <Phone className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">手机:</span>
              <span>{userInfo.mobile}</span>
            </div>
          )}

          <div className="flex items-center space-x-3 text-sm">
            <Building className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">租户:</span>
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
              {userInfo.tenantKey}
            </span>
          </div>
        </div>

        {/* Token信息 */}
        {tokenInfo && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">访问令牌信息</h4>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>令牌类型:</span>
                <span>{tokenInfo.tokenType}</span>
              </div>
              <div className="flex justify-between">
                <span>有效期:</span>
                <span>{tokenInfo.expiresIn}秒</span>
              </div>
              <div>
                <span>访问令牌:</span>
                <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono break-all">
                  {tokenInfo.accessToken.substring(0, 20)}...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="border-t pt-4">
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <LogOut className="h-4 w-4 mr-2" />
            退出登录
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
