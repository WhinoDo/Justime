'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle, Copy, ExternalLink } from 'lucide-react'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

export default function FeishuRedirectTestPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [urlInfo, setUrlInfo] = useState<any>({
    fullUrl: '加载中...',
    origin: '加载中...',
    pathname: '加载中...',
    search: '加载中...',
    params: {}
  })
  const [clientInfo, setClientInfo] = useState({
    userAgent: '加载中...',
    isOnline: '检测中...',
    currentTime: '加载中...',
    protocol: '加载中...',
    host: '加载中...'
  })

  useEffect(() => {
    // 防止开发环境下的双重调用和授权码重复使用
    let isProcessing = false

    // 检查授权码是否已经被处理过（改进版本）
    const code = searchParams.get('code')
    if (code) {
      const processedCodes = JSON.parse(localStorage.getItem('feishu_processed_codes') || '[]')
      const now = Date.now()
      
      // 清理过期的授权码记录（超过10分钟）
      const validCodes = processedCodes.filter((item: any) => {
        if (typeof item === 'string') {
          // 旧格式，直接清理
          return false
        }
        if (typeof item === 'object' && item.timestamp) {
          return now - item.timestamp < 10 * 60 * 1000 // 10分钟
        }
        return false
      })
      
      // 更新localStorage
      localStorage.setItem('feishu_processed_codes', JSON.stringify(validCodes))
      
      // 检查当前授权码是否在有效记录中
      const isProcessed = validCodes.some((item: any) => {
        if (typeof item === 'object' && item.code) {
          return item.code === code
        }
        return false
      })
      
      if (isProcessed) {
        console.log('🔄 授权码在10分钟内已处理过，跳过重复处理')
        setStatus('error')
        setMessage('授权码已使用，请重新授权')
        setTimeout(() => {
          FeishuLoginRedirect.redirectAfterLogin()
        }, 3000)
        return
      }
    }

    // 检查是否已经有成功的登录状态
    const loginStatus = localStorage.getItem('feishu_login_status')
    const loginComplete = localStorage.getItem('feishu_login_complete')
    if (loginStatus === 'success' && loginComplete === 'true' && code) {
      console.log('🔄 检测到已完成的登录状态，直接跳转')
      setStatus('success')
      setMessage('登录已完成，正在跳转...')
      setTimeout(() => {
        FeishuLoginRedirect.redirectAfterLogin()
      }, 1000)
      return
    }

    const handleRedirect = async () => {
      if (isProcessing) {
        console.log('🔄 已在处理中，跳过重复调用')
        return
      }
      isProcessing = true
      // 获取所有URL参数
      const params: any = {}
      searchParams.forEach((value, key) => {
        params[key] = value
      })

      // 延迟设置 URL 信息，避免水合不匹配
      setTimeout(() => {
        setUrlInfo({
          fullUrl: window.location.href,
          origin: window.location.origin,
          pathname: window.location.pathname,
          search: window.location.search,
          params: params
        })
      }, 0)

      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      console.log('📥 飞书授权回调参数:', {
        code: code ? `${code.substring(0, 10)}...` : null,
        state: state,
        error: error,
        fullUrl: window.location.href
      })

      // 处理用户拒绝授权的情况
      if (error) {
        setStatus('error')
        if (error === 'access_denied') {
          setMessage('用户拒绝了授权请求。请重新授权以使用飞书功能。')
        } else {
          setMessage(`授权失败: ${error}`)
        }

        console.error('❌ 飞书授权失败:', { error, state })

        // 5秒后跳转回原页面或主页
        setTimeout(() => {
          FeishuLoginRedirect.redirectAfterLogin()
        }, 5000)
        return
      }

      // 验证必需参数
      if (!code || !state) {
        setStatus('error')
        setMessage('授权回调参数不完整，缺少 code 或 state 参数')
        console.error('❌ 授权回调参数不完整:', { code: !!code, state: !!state })
        return
      }

      // 验证 state 参数格式
      if (!state.startsWith('success_login_')) {
        setStatus('error')
        setMessage('授权回调 state 参数格式不正确')
        console.error('❌ state 参数格式错误:', state)
        return
      }

      if (code && state) {
        // 标记授权码为已处理，防止重复使用（改进版本）
        const processedCodes = JSON.parse(localStorage.getItem('feishu_processed_codes') || '[]')
        const now = Date.now()
        
        // 添加新的授权码记录（带时间戳）
        processedCodes.push({
          code: code,
          timestamp: now
        })
        
        // 清理过期的记录（超过10分钟）和只保留最近的10个
        const validCodes = processedCodes
          .filter((item: any) => {
            if (typeof item === 'string') {
              // 旧格式，直接清理
              return false
            }
            if (typeof item === 'object' && item.timestamp) {
              return now - item.timestamp < 10 * 60 * 1000 // 10分钟
            }
            return false
          })
          .slice(-10) // 只保留最近的10个
        
        localStorage.setItem('feishu_processed_codes', JSON.stringify(validCodes))

        setStatus('success')
        setMessage('授权成功！正在处理授权码...')

        try {
          // 调用后端API获取真实的登录信息
          console.log('🔄 调用 Token API 处理授权码...')
          // 注意：API已移除，请使用统一的飞书登录接口
          throw new Error('API已移除，请使用统一的飞书登录接口')

          const result = await response.json()

          if (!response.ok || !result.success) {
            throw new Error(result.error || '获取登录信息失败')
          }

          const { tokenInfo, userInfo } = result.data

          // 🎉 在控制台详细打印访问令牌信息
          console.group('🔑 飞书访问令牌获取成功！')
          console.log('📋 令牌信息详情:')
          console.log('  🎫 访问令牌 (Access Token):', tokenInfo?.accessToken ? `${tokenInfo.accessToken.substring(0, 20)}...` : '未获取到')
          console.log('  🔄 刷新令牌 (Refresh Token):', tokenInfo?.refreshToken ? `${tokenInfo.refreshToken.substring(0, 20)}...` : '未获取到')
          console.log('  ⏰ 令牌类型 (Token Type):', tokenInfo?.tokenType || '未知')
          console.log('  ⏳ 过期时间 (Expires In):', tokenInfo?.expiresIn ? `${tokenInfo.expiresIn} 秒` : '未知')
          console.log('  📅 过期时间戳 (Expires At):', tokenInfo?.expiresAt ? new Date(tokenInfo.expiresAt).toLocaleString('zh-CN') : '未知')

          if (userInfo) {
            console.log('👤 用户信息:')
            console.log('  📛 用户名:', userInfo.name || '未知')
            console.log('  🆔 用户 ID:', userInfo.user_id || '未知')
            console.log('  🔗 Open ID:', userInfo.open_id || '未知')
            console.log('  📧 邮箱:', userInfo.email || '未知')
          }

          console.log('🔧 完整令牌对象:', tokenInfo)
          console.log('👥 完整用户对象:', userInfo)
          console.groupEnd()

          // 更新页面显示信息
          setMessage(`🎉 登录成功！已获取访问令牌，正在跳转...

🎫 访问令牌: ${tokenInfo?.accessToken ? `${tokenInfo.accessToken.substring(0, 20)}...` : '未获取到'}
👤 用户: ${userInfo?.name || '未知'}
⏰ 过期时间: ${tokenInfo?.expiresAt ? new Date(tokenInfo.expiresAt).toLocaleString('zh-CN') : '未知'}

💡 请查看浏览器控制台获取完整令牌信息！`)

          // 使用 TokenManager 保存登录信息
          const { FeishuTokenManager } = await import('@/lib/feishu/token-manager')

          // 确保保存完整的登录会话信息
          const loginSuccess = FeishuTokenManager.saveLoginSession(tokenInfo, userInfo)
          console.log('💾 TokenManager 保存结果:', loginSuccess)

          // 兼容旧版本的存储方式
          localStorage.setItem('feishu_token_info', JSON.stringify(tokenInfo))
          localStorage.setItem('feishu_user_info', JSON.stringify(userInfo))
          localStorage.setItem('feishu_login_timestamp', Date.now().toString())

          // 设置登录状态标记
          localStorage.setItem('feishu_login_status', 'success')
          localStorage.setItem('feishu_login_complete', 'true')

          console.log('💾 所有登录信息已保存到 localStorage')

          // 尝试向父窗口发送登录成功消息（用于二维码扫描场景）
          try {
            if (window.opener) {
              window.opener.postMessage({
                type: 'FEISHU_LOGIN_SUCCESS',
                data: { tokenInfo, userInfo }
              }, window.location.origin)
            }

            // 也尝试向所有同域窗口广播（使用BroadcastChannel）
            if (typeof BroadcastChannel !== 'undefined') {
              const channel = new BroadcastChannel('feishu_login')
              channel.postMessage({
                type: 'FEISHU_LOGIN_SUCCESS',
                data: { tokenInfo, userInfo }
              })
              channel.close()
            }
          } catch (e) {
            console.log('无法发送跨窗口消息:', e)
          }

          // 显示成功消息3秒后自动跳转
          setTimeout(() => {
            // 使用统一的登录跳转管理器
            FeishuLoginRedirect.redirectAfterLogin()
          }, 3000)
        } catch (error) {
          console.error('❌ 处理登录回调失败:', error)
          setStatus('error')

          // 根据错误类型提供更友好的错误信息
          let errorMessage = '登录处理失败'
          if (error instanceof Error && error.message) {
            if (error.message.includes('20014')) {
              errorMessage = '授权码已过期或无效，请重新授权'
            } else if (error.message.includes('网络')) {
              errorMessage = '网络连接失败，请检查网络后重试'
            } else if (error.message.includes('Token')) {
              errorMessage = '获取访问令牌失败，请重新授权'
            } else {
              errorMessage = `登录处理失败: ${error.message}`
            }
          }

          setMessage(errorMessage)

          // 10秒后自动跳转回原页面
          setTimeout(() => {
            setMessage(errorMessage + ' - 即将跳转回原页面...')
            setTimeout(() => {
              FeishuLoginRedirect.redirectAfterLogin()
            }, 3000)
          }, 10000)
        }
      } else {
        setStatus('error')
        setMessage('未收到有效的授权码，请重新授权')
        console.error('❌ 未收到有效的授权参数')
      }
    }

    handleRedirect()
  }, [searchParams])

  // 处理客户端特定信息，避免水合不匹配
  useEffect(() => {
    const updateClientInfo = () => {
      setClientInfo({
        userAgent: navigator.userAgent,
        isOnline: navigator.onLine ? '在线' : '离线',
        currentTime: new Date().toLocaleString(),
        protocol: window.location.protocol,
        host: window.location.host
      })
    }

    // 立即更新一次
    updateClientInfo()

    // 每秒更新时间
    const interval = setInterval(() => {
      setClientInfo(prev => ({
        ...prev,
        currentTime: new Date().toLocaleString(),
        isOnline: navigator.onLine ? '在线' : '离线'
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const goBack = () => {
    const returnUrl = localStorage.getItem('feishu_return_url') || '/feishu/qr-login'
    window.location.href = returnUrl
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-600" />
      case 'error':
        return <XCircle className="h-8 w-8 text-red-600" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            飞书重定向测试页面
          </h1>
          <p className="text-gray-600">
            用于测试飞书扫码后的重定向连接是否正常
          </p>
        </div>

        <div className="space-y-6">
          {/* 状态卡片 */}
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 mb-4">
                {getStatusIcon()}
              </div>
              <CardTitle className="text-xl font-bold text-gray-900">
                重定向状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status === 'loading' && (
                <Alert>
                  <Loader2 className="h-4 w-4" />
                  <AlertDescription>正在处理重定向...</AlertDescription>
                </Alert>
              )}
              
              {status === 'success' && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {message}
                  </AlertDescription>
                </Alert>
              )}
              
              {status === 'error' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-3">
                      <p>{message}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => FeishuLoginRedirect.redirectToLogin(true)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          重新授权
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => FeishuLoginRedirect.redirectAfterLogin()}
                        >
                          返回原页面
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* URL信息卡片 */}
          <Card>
            <CardHeader>
              <CardTitle>URL信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">完整URL</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 break-all">
                      {urlInfo.fullUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(urlInfo.fullUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Origin</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                      {urlInfo.origin}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(urlInfo.origin)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">路径</label>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm block mt-1">
                    {urlInfo.pathname}
                  </code>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">查询参数</label>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm block mt-1 break-all">
                    {urlInfo.search || '无'}
                  </code>
                </div>
              </div>

              {/* 参数详情 */}
              {Object.keys(urlInfo.params || {}).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">解析的参数</label>
                  <div className="space-y-2">
                    {Object.entries(urlInfo.params || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <span className="text-sm font-medium w-20">{key}:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 break-all">
                          {value as string}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(value as string)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex space-x-4">
            <Button onClick={goBack} className="flex-1">
              返回登录页面
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              刷新页面
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.open('/feishu/debug', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              打开调试工具
            </Button>
          </div>

          {/* 网络诊断 */}
          <Card>
            <CardHeader>
              <CardTitle>网络诊断</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>当前时间:</strong> {clientInfo.currentTime}</p>
                <p><strong>用户代理:</strong> {clientInfo.userAgent}</p>
                <p><strong>网络状态:</strong> {clientInfo.isOnline}</p>
                <p><strong>协议:</strong> {clientInfo.protocol}</p>
                <p><strong>主机:</strong> {clientInfo.host}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
