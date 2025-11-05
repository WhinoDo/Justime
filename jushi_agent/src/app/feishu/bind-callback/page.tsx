'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle, ArrowLeft, Info } from 'lucide-react'
import { FeishuAuthOptimized } from '@/lib/feishu/feishu-auth-optimized'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'
import { FEISHU_CONFIG } from '@/lib/feishu/config'

export default function FeishuBindCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'info'>('loading')
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const processCallback = async () => {
      // 防止重复处理
      if (isProcessing) {
        console.log('🔄 已在处理中，跳过重复请求')
        return
      }

      try {
        setIsProcessing(true)
        
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        console.log('🔄 处理飞书绑定回调:', { 
          code: code ? `${code.substring(0, 10)}...` : '不存在', 
          state, 
          error,
          errorDescription
        })

        // 处理授权失败
        if (error) {
          setStatus('error')
          setMessage(`授权失败: ${error}`)
          setDetails({
            error,
            errorDescription,
            state
          })
          setIsProcessing(false)
          return
        }

        // 检查授权码是否存在
        if (!code) {
          setStatus('error')
          setMessage('缺少授权码，请重新尝试绑定')
          setDetails({ state })
          setIsProcessing(false)
          return
        }

        // 检查授权码是否已经被处理过（改进版本）
        const usedCodeKey = `feishu_used_code_${code}`
        const processingKey = `feishu_processing_${code}`
        
        if (typeof window !== 'undefined') {
          const usedTime = localStorage.getItem(usedCodeKey)
          const processingTime = localStorage.getItem(processingKey)
          const now = Date.now()
          
          // 如果授权码在5分钟内被使用过，且不是正在处理中，则跳过
          if (usedTime && !processingTime) {
            const timeDiff = now - parseInt(usedTime)
            if (timeDiff < 5 * 60 * 1000) { // 5分钟内
              console.log('⚠️ 授权码在5分钟内已被使用过，跳过处理')
              setStatus('error')
              setMessage('该授权码在5分钟内已被使用过，请重新进行授权')
              setDetails({ 
                code: `${code.substring(0, 10)}...`,
                state,
                error: '授权码重复使用',
                usedTime: new Date(parseInt(usedTime)).toLocaleString('zh-CN')
              })
              setIsProcessing(false)
              return
            } else {
              // 超过5分钟，清理旧的记录
              localStorage.removeItem(usedCodeKey)
            }
          }
          
          // 如果正在处理中，等待处理完成
          if (processingTime) {
            const timeDiff = now - parseInt(processingTime)
            if (timeDiff < 30 * 1000) { // 30秒内
              console.log('🔄 授权码正在处理中，等待完成...')
              setStatus('info')
              setMessage('授权码正在处理中，请稍候...')
              setDetails({
                code: `${code.substring(0, 10)}...`,
                state,
                processingTime: new Date(parseInt(processingTime)).toLocaleString('zh-CN')
              })
              setIsProcessing(false)
              return
            } else {
              // 超过30秒，清理处理记录，允许重新处理
              localStorage.removeItem(processingKey)
            }
          }
          
          // 标记授权码为正在处理中
          localStorage.setItem(processingKey, now.toString())
        }

        // 显示授权成功信息
        setStatus('info')
        setMessage('飞书授权成功！正在处理绑定...')
        setDetails({
          code: `${code.substring(0, 10)}...`,
          state,
          timestamp: new Date().toLocaleString('zh-CN')
        })

        // 模拟处理延迟，让用户看到成功状态
        await new Promise(resolve => setTimeout(resolve, 2000))

        // 尝试调用后端API进行绑定
        try {
          console.log('🔗 尝试调用后端绑定API...')
          
          console.log('🔍 准备发送绑定请求')

          // 使用固定的redirect_uri，与授权时保持一致
          const redirectUri = FEISHU_CONFIG.REDIRECT_URI
          
          // 从state参数中解析returnTo信息
          const returnToFromState = state ? FeishuLoginRedirect.parseReturnToFromState(state) : null
          const finalReturnTo = returnToFromState || searchParams.get('return_to') || '/profile'
          
          console.log('🔍 回调参数解析:', {
            code: code ? `${code.substring(0, 10)}...` : '不存在',
            state,
            redirectUri,
            returnToFromState,
            finalReturnTo
          })
          
          const bindData: any = {
            code,
            state,
            redirect_uri: redirectUri
          }
          
          console.log('📤 发送的请求数据 (固定redirect_uri):', {
            code: `${code.substring(0, 10)}...`,
            state,
            redirect_uri: redirectUri
          })

          const response = await fetch('http://localhost:8080/api/feishu/oauth/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(bindData)
          })

          const result = await response.json()
          console.log('📥 绑定API响应:', result)

          if (!response.ok) {
            // 如果API返回了具体的错误信息，使用它；否则使用HTTP状态
            const errorMessage = result.error || `HTTP ${response.status}: ${response.statusText}`
            throw new Error(errorMessage)
          }

          if (result.success) {
            console.log('✅ 绑定成功，开始保存登录信息:', result.data)
            
            // 保存登录信息到 FeishuTokenManager
            try {
              const tokenInfo = result.data?.tokenInfo
              const userInfo = result.data?.user?.feishuBinding
              
              console.log('🔍 准备保存的信息:', {
                hasTokenInfo: !!tokenInfo,
                hasUserInfo: !!userInfo,
                tokenFields: tokenInfo ? Object.keys(tokenInfo) : [],
                userFields: userInfo ? Object.keys(userInfo) : []
              })
              
              if (tokenInfo && userInfo) {
                // 构造符合 FeishuTokenManager 期望的格式
                const feishuTokenInfo = {
                  accessToken: tokenInfo.accessToken,
                  refreshToken: tokenInfo.refreshToken,
                  tokenType: tokenInfo.tokenType || 'Bearer',
                  expiresIn: tokenInfo.expiresIn
                }
                
                const feishuUserInfo = {
                  name: userInfo.name,
                  openId: userInfo.openId,
                  userId: userInfo.openId, // 使用 openId 作为 userId
                  tenantKey: userInfo.tenantKey || 'unknown',
                  avatarUrl: userInfo.avatar || '',
                  email: userInfo.email || '',
                  mobile: userInfo.mobile || ''
                }
                
                console.log('💾 保存登录会话:', {
                  tokenInfo: feishuTokenInfo,
                  userInfo: feishuUserInfo
                })
                
                const saveSuccess = FeishuTokenManager.saveLoginSession(feishuTokenInfo, feishuUserInfo)
                
                // 清理处理记录，标记为已使用
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(processingKey)
                  localStorage.setItem(usedCodeKey, Date.now().toString())
                }
                
                if (saveSuccess) {
                  console.log('✅ 登录信息保存成功')
                  
                  // 同时设置Cookie，供后端API使用
                  if (typeof window !== 'undefined' && tokenInfo.accessToken) {
                    // 设置Cookie，允许跨域访问
                    document.cookie = `feishu_access_token=${tokenInfo.accessToken}; path=/; max-age=7200; samesite=lax`
                    console.log('✅ 设置飞书访问令牌Cookie:', tokenInfo.accessToken.substring(0, 20) + '...')
                  }
                } else {
                  console.warn('⚠️ 登录信息保存失败')
                }
              } else {
                console.warn('⚠️ 缺少必要的登录信息，无法保存到TokenManager', {
                  hasTokenInfo: !!tokenInfo,
                  hasUserInfo: !!userInfo
                })
              }
            } catch (saveError) {
              console.error('❌ 保存登录信息失败:', saveError)
            }
            
            // 获取回调地址参数，如果没有则默认跳转到个人资料页面
            console.log('🔗 绑定成功，准备跳转到:', finalReturnTo)
            
            // 根据跳转目标显示不同的消息
            let jumpMessage = '即将跳转到个人资料页面...'
            if (finalReturnTo.includes('/feishu/calendar-management')) {
              jumpMessage = '即将跳转到日历管理页面...'
            } else if (finalReturnTo.includes('/feishu/calendar')) {
              jumpMessage = '即将跳转到日程管理页面...'
            } else if (finalReturnTo.includes('/feishu/calendar-api-demo')) {
              jumpMessage = '即将跳转到API演示页面...'
            }
            
            setStatus('success')
            setMessage(`飞书账号绑定成功！${jumpMessage}`)
            setDetails({
              user: result.data?.user,
              bindTime: new Date().toLocaleString('zh-CN'),
              returnTo: finalReturnTo
            })
            
            // 成功处理后清理授权码标记
            if (typeof window !== 'undefined') {
              const usedCodeKey = `feishu_used_code_${code}`
              localStorage.removeItem(usedCodeKey)
            }
            
            // 3秒后跳转到指定页面
            setTimeout(() => {
              router.push(finalReturnTo)
            }, 3000)
          } else {
            setStatus('error')
            setMessage(result.error || '绑定失败')
            setDetails({
              error: result.error,
              suggestion: result.suggestion,
              details: result.details,
              code: result.details?.code,
              errorDescription: result.details?.error_description
            })
          }

        } catch (apiError) {
          console.error('❌ 调用绑定API失败:', apiError)
          
          // 清理处理记录，允许重新尝试
          if (typeof window !== 'undefined') {
            localStorage.removeItem(processingKey)
          }
          
          // 检查是否是API返回的具体错误
          if (apiError instanceof Error && apiError.message.includes('授权码')) {
            // 如果是授权码相关错误，显示为错误状态
            setStatus('error')
            setMessage(apiError.message)
            setDetails({
              code: `${code.substring(0, 10)}...`,
              state,
              error: apiError.message,
              suggestion: '请重新进行飞书授权'
            })
          } else {
            // 其他错误显示为部分成功状态
            setStatus('info')
            setMessage('飞书授权成功，但绑定处理遇到问题')
            setDetails({
              code: `${code.substring(0, 10)}...`,
              state,
              error: apiError instanceof Error ? apiError.message : 'API调用失败',
              suggestion: '您可以稍后在个人资料页面重试绑定'
            })
          }
        }

      } catch (error) {
        console.error('❌ 处理绑定回调失败:', error)
        setStatus('error')
        setMessage(`处理绑定回调时发生错误: ${error instanceof Error ? error.message : '未知错误'}`)
        setDetails({ error: error instanceof Error ? error.message : '未知错误' })
      } finally {
        setIsProcessing(false)
      }
    }

    processCallback()
  }, [searchParams, router])

  const handleRetry = () => {
    router.push('/profile')
  }

  const handleGoHome = () => {
    router.push('/')
  }

  const handleGoToProfile = () => {
    router.push('/profile')
  }

  const handleJumpNow = () => {
    // 需要重新解析state参数
    const state = searchParams.get('state')
    const returnToFromState = state ? FeishuLoginRedirect.parseReturnToFromState(state) : null
    const finalReturnTo = returnToFromState || searchParams.get('return_to') || '/profile'
    router.push(finalReturnTo)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
            {status === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
            {status === 'info' && <Info className="h-6 w-6 text-blue-600" />}
            飞书账号绑定
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="text-center space-y-2">
              <p className="text-gray-600">正在处理绑定请求...</p>
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            </div>
          )}

          {status === 'success' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{message}</p>
                  {details?.user && (
                    <div className="text-sm text-gray-600">
                      <p>用户名: {details.user.displayName || details.user.username}</p>
                      <p>绑定时间: {details.bindTime}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    3秒后自动跳转{details?.returnTo ? `到${details.returnTo === '/profile' ? '个人资料页面' : '目标页面'}` : ''}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {status === 'info' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{message}</p>
                  {details && (
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>授权码: {details.code}</p>
                      <p>时间: {details.timestamp}</p>
                      {details.error && (
                        <p className="text-orange-600">错误: {details.error}</p>
                      )}
                      {details.suggestion && (
                        <p className="text-blue-600">{details.suggestion}</p>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{message}</p>
                  {details && (
                    <div className="text-sm text-gray-600 space-y-1">
                      {details.suggestion && (
                        <p className="text-blue-600 font-medium">💡 {details.suggestion}</p>
                      )}
                      {details.code && (
                        <p>错误码: {details.code}</p>
                      )}
                      {details.errorDescription && (
                        <p>详细描述: {details.errorDescription}</p>
                      )}
                      {details.state && (
                        <p>状态: {details.state}</p>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {status === 'success' && (
              <Button 
                onClick={handleJumpNow}
                className="flex-1"
              >
                立即跳转
              </Button>
            )}
            {status !== 'success' && (
              <Button 
                variant="outline" 
                onClick={handleGoToProfile}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                个人资料
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleGoHome}
              className="flex-1"
            >
              返回首页
            </Button>
            {status === 'error' && (
              <Button 
                onClick={handleRetry}
                className="flex-1"
              >
                重试
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
