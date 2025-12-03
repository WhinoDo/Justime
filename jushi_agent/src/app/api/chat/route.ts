import { NextRequest, NextResponse } from 'next/server'
import { APIResponse, ChatRequest, ChatResponse } from '@/types'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 聊天API路由
 * 现在将请求转发到后端Python服务
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const { message, taskId } = body

    // 输入验证
    if (!message || typeof message !== 'string') {
      throw new Error('消息内容无效')
    }
    
    if (message.length > 1000) {
      throw new Error('消息内容过长，请缩短到1000字符以内')
    }

    // 清理输入
    const cleanMessage = message.trim()
    if (!cleanMessage) {
      throw new Error('消息内容不能为空')
    }

    // 获取认证token（从cookie或Authorization header）
    const authToken = request.cookies.get('auth-token')?.value || 
                      request.headers.get('authorization')?.replace('Bearer ', '')
    
    // 构建请求头
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // 如果有token，添加到请求头
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    console.log('Chat API: 转发请求到后端服务:', {
      message: cleanMessage.substring(0, 100),
      taskId,
      messageLength: cleanMessage.length,
      backendUrl: API_CONFIG.BASE_URL,
      hasAuthToken: !!authToken
    })

    // 调用后端Python服务的聊天API
    const backendUrl = API_CONFIG.getFullUrl('/chat/chat')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: cleanMessage,
        taskId: taskId
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
    }

    const backendResponse = await response.json()
    
    // 转换后端响应格式为前端期望的格式
    const frontendResponse: APIResponse<ChatResponse> = {
      success: backendResponse.success,
      data: backendResponse.data,
      error: backendResponse.error,
      timestamp: backendResponse.timestamp || new Date().toISOString()
    }

    console.log('Chat API: 后端响应成功')
    return NextResponse.json(frontendResponse)
    
  } catch (error) {
    console.error('Chat API Error详情:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })
    
    const errorResponse: APIResponse<ChatResponse> = {
      success: false,
      error: {
        code: 'CHAT_ERROR',
        message: '抱歉，我现在遇到了一些技术问题。请稍后再试，或者描述一下您遇到的具体情况。',
        details: process.env.NODE_ENV === 'development' ? String(error) : 
                 `Error: ${error instanceof Error ? error.message : String(error)}`
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}
