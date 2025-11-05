'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { 
  Calendar, 
  RefreshCw, 
  Info, 
  Code, 
  Play,
  Copy,
  Download,
  Upload,
  Settings,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

interface ApiCallResult {
  timestamp: string
  method: string
  url: string
  success: boolean
  status?: number
  requestHeaders?: Record<string, string>
  requestBody?: any
  responseHeaders?: Record<string, string>
  responseBody?: any
  error?: string
  duration?: number
}

export default function FeishuCalendarApiDemoPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginInfo, setLoginInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // API调用相关状态
  const [apiResults, setApiResults] = useState<ApiCallResult[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [pageToken, setPageToken] = useState('')
  const [syncToken, setSyncToken] = useState('')
  const [fullQuery, setFullQuery] = useState(true)
  const [showSensitiveData, setShowSensitiveData] = useState(false)

  // 当前API调用结果
  const [currentResult, setCurrentResult] = useState<ApiCallResult | null>(null)

  useEffect(() => {
    checkLoginStatus()
  }, [])

  const checkLoginStatus = () => {
    const loggedIn = FeishuTokenManager.isLoggedIn()
    setIsLoggedIn(loggedIn)

    if (loggedIn) {
      const info = FeishuTokenManager.getLoginSummary()
      setLoginInfo(info)
      console.log('🔍 飞书登录状态:', info)
    }
  }

  const callCalendarListApi = async () => {
    if (!isLoggedIn) {
      setError('请先登录飞书账号')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    const startTime = Date.now()

    try {
      // 获取访问令牌
      const accessToken = FeishuTokenManager.getValidAccessToken()
      if (!accessToken) {
        const tokenInfo = FeishuTokenManager.getTokenInfo()
        console.error('❌ 无法获取有效访问令牌:', {
          hasTokenInfo: !!tokenInfo,
          hasAccessToken: !!tokenInfo?.accessToken,
          expiresAt: tokenInfo?.expiresAt ? new Date(tokenInfo.expiresAt).toISOString() : 'unknown',
          currentTime: new Date().toISOString(),
          isExpired: tokenInfo?.expiresAt ? Date.now() >= tokenInfo.expiresAt : false
        })
        setError('访问令牌无效，请重新登录')
        return
      }

      console.log('✅ 成功获取访问令牌:', {
        hasToken: !!accessToken,
        tokenLength: accessToken.length,
        tokenPreview: `${accessToken.substring(0, 10)}...`
      })

      // 构造URL
      const params = new URLSearchParams({
        page_size: pageSize.toString()
      })
      
      if (pageToken) params.append('page_token', pageToken)
      if (syncToken) params.append('sync_token', syncToken)
      if (fullQuery) params.append('full', 'true')

      const url = `/api/feishu/calendars?${params.toString()}`

      console.log('📅 开始调用日历列表API:', { url, params: Object.fromEntries(params) })

      const requestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }

      // 发起请求
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // 尝试解析响应
      let responseBody: any
      const responseText = await response.text()
      
      try {
        responseBody = JSON.parse(responseText)
      } catch (parseError) {
        responseBody = { error: 'Response parsing failed', rawText: responseText }
      }

      // 记录API调用结果
      const result: ApiCallResult = {
        timestamp: new Date().toISOString(),
        method: 'GET',
        url,
        success: response.ok && responseBody.success,
        status: response.status,
        requestHeaders,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseBody,
        duration
      }

      if (!response.ok || !responseBody.success) {
        result.error = responseBody.error || `HTTP ${response.status}: ${response.statusText}`
      }

      // 添加到结果历史
      setApiResults(prev => [result, ...prev.slice(0, 9)]) // 只保留最近10次结果
      setCurrentResult(result)

      if (result.success) {
        const calendars = responseBody.data?.calendars || []
        setSuccess(`✅ API调用成功！获取到${calendars.length}个日历`)
        
        // 如果响应包含sync_token，自动填入
        if (responseBody.data?.sync_token) {
          setSyncToken(responseBody.data.sync_token)
        }
      } else {
        setError(`❌ API调用失败: ${result.error}`)
      }

    } catch (err) {
      const endTime = Date.now()
      const duration = endTime - startTime

      const errorMessage = err instanceof Error ? err.message : '未知错误'
      
      const result: ApiCallResult = {
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: `/api/feishu/calendars`,
        success: false,
        error: errorMessage,
        duration
      }

      setApiResults(prev => [result, ...prev.slice(0, 9)])
      setCurrentResult(result)
      setError(`❌ 请求失败: ${errorMessage}`)
      
      console.error('❌ API调用失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text)
    setSuccess(`${description}已复制到剪贴板`)
  }

  const formatJson = (obj: any): string => {
    if (!obj) return ''
    return JSON.stringify(obj, null, 2)
  }

  const maskSensitiveData = (text: string): string => {
    if (showSensitiveData) return text
    
    // 隐藏敏感信息
    return text
      .replace(/Bearer\s+[a-zA-Z0-9_-]+/g, 'Bearer ***')
      .replace(/"access_token":\s*"[^"]+"/g, '"access_token": "***"')
      .replace(/"calendar_id":\s*"[^"]+"/g, '"calendar_id": "***"')
  }

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <Code className="h-12 w-12 mx-auto mb-4 text-blue-600" />
            <CardTitle>飞书日历API演示</CardTitle>
            <CardDescription>
              请先登录飞书账号以测试API调用
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => FeishuLoginRedirect.redirectToLogin(true, '/feishu/calendar-api-demo')}
              className="w-full"
            >
              前往登录
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">飞书日历API演示</h1>
          <p className="text-gray-600 mt-2">测试和调试飞书日历列表查询接口</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={checkLoginStatus}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            刷新状态
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowSensitiveData(!showSensitiveData)}
            className="flex items-center gap-2"
          >
            {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSensitiveData ? '隐藏' : '显示'}敏感信息
          </Button>
        </div>
      </div>

      {/* 登录信息 */}
      {loginInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              当前登录状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <Label>用户名</Label>
                <p className="font-medium">{loginInfo.user?.name}</p>
              </div>
              <div>
                <Label>Token状态</Label>
                <Badge variant={loginInfo.token?.isExpired ? "destructive" : "default"}>
                  {loginInfo.token?.isExpired ? "已过期" : "有效"}
                </Badge>
              </div>
              <div>
                <Label>登录时间</Label>
                <p>{loginInfo.session?.loginTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误和成功提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* API参数配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            API参数配置
          </CardTitle>
          <CardDescription>
            配置飞书日历列表查询接口的请求参数
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pageSize">页面大小 (page_size)</Label>
              <Input
                id="pageSize"
                type="number"
                min="1"
                max="1000"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value) || 50)}
                placeholder="50-1000"
              />
              <p className="text-xs text-gray-500 mt-1">单次请求返回的最大日历数量</p>
            </div>
            <div>
              <Label>查询模式</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant={fullQuery ? 'default' : 'outline'}
                  onClick={() => setFullQuery(true)}
                >
                  全量查询
                </Button>
                <Button
                  size="sm"
                  variant={!fullQuery ? 'default' : 'outline'}
                  onClick={() => setFullQuery(false)}
                >
                  分页查询
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pageToken">分页标识 (page_token)</Label>
              <Input
                id="pageToken"
                value={pageToken}
                onChange={(e) => setPageToken(e.target.value)}
                placeholder="从响应中获取..."
                disabled={fullQuery}
              />
              <p className="text-xs text-gray-500 mt-1">用于获取下一页数据</p>
            </div>
            <div>
              <Label htmlFor="syncToken">同步标识 (sync_token)</Label>
              <Input
                id="syncToken"
                value={syncToken}
                onChange={(e) => setSyncToken(e.target.value)}
                placeholder="从响应中获取..."
              />
              <p className="text-xs text-gray-500 mt-1">用于增量同步</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={callCalendarListApi}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              调用API
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setPageToken('')
                setSyncToken('')
                setPageSize(50)
                setFullQuery(true)
              }}
            >
              重置参数
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API调用结果 */}
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current">当前结果</TabsTrigger>
          <TabsTrigger value="history">调用历史 ({apiResults.length})</TabsTrigger>
          <TabsTrigger value="documentation">API文档</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          {currentResult ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>最新API调用结果</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={currentResult.success ? 'default' : 'destructive'}>
                      {currentResult.success ? '成功' : '失败'}
                    </Badge>
                    <Badge variant="outline">
                      {currentResult.duration}ms
                    </Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  {currentResult.timestamp} | {currentResult.method} {currentResult.url}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 请求信息 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>请求信息</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(
                        `${currentResult.method} ${currentResult.url}\n${formatJson(currentResult.requestHeaders)}`,
                        '请求信息'
                      )}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      复制
                    </Button>
                  </div>
                  <Textarea
                    value={maskSensitiveData(`${currentResult.method} ${currentResult.url}\n\n请求头:\n${formatJson(currentResult.requestHeaders)}`)}
                    readOnly
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                {/* 响应信息 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>响应信息</Label>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        状态码: {currentResult.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(
                          maskSensitiveData(formatJson(currentResult.responseBody)),
                          '响应内容'
                        )}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        复制
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={maskSensitiveData(`状态码: ${currentResult.status}\n\n响应头:\n${formatJson(currentResult.responseHeaders)}\n\n响应体:\n${formatJson(currentResult.responseBody)}`)}
                    readOnly
                    rows={15}
                    className="font-mono text-sm"
                  />
                </div>

                {/* 错误信息 */}
                {currentResult.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>错误信息:</strong> {currentResult.error}
                    </AlertDescription>
                  </Alert>
                )}

                {/* 成功结果解析 */}
                {currentResult.success && currentResult.responseBody?.data && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">结果解析</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label>日历数量</Label>
                          <p className="text-2xl font-bold text-blue-600">
                            {currentResult.responseBody.data.calendars?.length || 0}
                          </p>
                        </div>
                        <div>
                          <Label>是否有更多</Label>
                          <p className="text-lg font-medium">
                            {currentResult.responseBody.data.has_more ? '是' : '否'}
                          </p>
                        </div>
                        <div>
                          <Label>下一页标识</Label>
                          <p className="text-xs font-mono">
                            {currentResult.responseBody.data.page_token || '无'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Play className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">暂无API调用结果</h3>
                <p className="text-gray-500 mb-4">
                  点击"调用API"按钮开始测试飞书日历列表接口
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {apiResults.length > 0 ? (
            <div className="space-y-3">
              {apiResults.map((result, index) => (
                <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCurrentResult(result)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={result.success ? 'default' : 'destructive'}>
                            {result.success ? '成功' : '失败'}
                          </Badge>
                          <Badge variant="outline">{result.method}</Badge>
                          <Badge variant="outline">{result.duration}ms</Badge>
                          {result.status && (
                            <Badge variant="secondary">HTTP {result.status}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(result.timestamp).toLocaleString()}
                        </p>
                        {result.error && (
                          <p className="text-sm text-red-600 mt-1">{result.error}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {result.success && result.responseBody?.data?.calendars && (
                          <p className="text-sm font-medium">
                            {result.responseBody.data.calendars.length} 个日历
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">暂无调用历史</h3>
                <p className="text-gray-500">API调用历史将显示在这里</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documentation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>飞书日历列表查询接口文档</CardTitle>
              <CardDescription>calendar-v4/calendars 接口详细说明</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">接口信息</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>请求方式:</strong> GET</p>
                  <p><strong>请求URL:</strong> https://open.feishu.cn/open-apis/calendar/v4/calendars</p>
                  <p><strong>速率限制:</strong> 1000次/分钟 & 50次/秒</p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">查询参数</h3>
                <div className="space-y-3 text-sm">
                  <div className="border rounded p-3">
                    <p><strong>page_size</strong> (可选)</p>
                    <p>类型: int | 取值范围: 50-1000 | 默认值: 500</p>
                    <p>说明: 单次请求返回的最大日历数量</p>
                  </div>
                  <div className="border rounded p-3">
                    <p><strong>page_token</strong> (可选)</p>
                    <p>类型: string</p>
                    <p>说明: 分页标识，首次请求不填；当响应has_more为true时使用</p>
                  </div>
                  <div className="border rounded p-3">
                    <p><strong>sync_token</strong> (可选)</p>
                    <p>类型: string</p>
                    <p>说明: 增量同步标识，分页结束后用于获取日历变更数据</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">响应结构</h3>
                <Textarea
                  value={`{
  "code": 0,
  "msg": "success",
  "data": {
    "has_more": false,
    "page_token": "",
    "sync_token": "ListCalendarsSyncToken_xxx",
    "calendar_list": [
      {
        "calendar_id": "feishu.cn_xxx@group.calendar.feishu.cn",
        "summary": "Test calendar",
        "description": "Create a calendar by calling an open API",
        "permissions": "private",
        "color": -1,
        "type": "shared",
        "summary_alias": "Calendar alias",
        "is_deleted": false,
        "is_third_party": false,
        "role": "owner"
      }
    ]
  }
}`}
                  readOnly
                  rows={25}
                  className="font-mono text-xs"
                />
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">常见错误码</h3>
                <div className="space-y-2 text-sm">
                  <div className="border rounded p-3">
                    <p><strong>190002:</strong> 请求参数无效</p>
                  </div>
                  <div className="border rounded p-3">
                    <p><strong>190008:</strong> page_token/sync_token 过期</p>
                  </div>
                  <div className="border rounded p-3">
                    <p><strong>191002:</strong> 无日历访问权限</p>
                  </div>
                  <div className="border rounded p-3">
                    <p><strong>195100:</strong> 用户已离职或不在租户内</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
