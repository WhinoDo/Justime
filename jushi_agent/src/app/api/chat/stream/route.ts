import { NextRequest, NextResponse } from 'next/server'

// 后端 SSE 端点
const BACKEND_STREAM_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const SSE_ENDPOINT = `${BACKEND_STREAM_URL}/api/v1/chat/stream`

export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const body = await request.json()
    
    // 获取认证信息
    const authHeader = request.headers.get('authorization')
    const cookieHeader = request.headers.get('cookie')
    
    // 获取 Last-Event-ID（断点续传）
    const lastEventId = request.headers.get('last-event-id')
    
    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    }
    
    if (authHeader) {
      headers['Authorization'] = authHeader
    }
    
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader
    }
    
    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId
    }
    
    // 转发请求到后端
    const response = await fetch(SSE_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    
    // 检查响应类型
    const contentType = response.headers.get('content-type') || ''
    
    if (!response.ok) {
      // 非 2xx 响应，返回错误
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      
      return NextResponse.json(
        { error: errorData.detail || errorData.error || '请求失败' },
        { status: response.status }
      )
    }
    
    if (!contentType.includes('text/event-stream')) {
      // 非 SSE 响应，直接返回
      const data = await response.text()
      return new NextResponse(data, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
        },
      })
    }
    
    // SSE 响应 - 流式转发
    const reader = response.body?.getReader()
    
    if (!reader) {
      return NextResponse.json(
        { error: '无法获取响应流' },
        { status: 500 }
      )
    }
    
    // 创建 TransformStream 用于流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()
        
        try {
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) {
              controller.close()
              break
            }
            
            const chunk = decoder.decode(value, { stream: true })
            controller.enqueue(encoder.encode(chunk))
          }
        } catch (error) {
          console.error('SSE stream error:', error)
          controller.error(error)
        }
      },
      
      async cancel() {
        // 客户端断开连接时取消后端请求
        await reader.cancel()
      },
    })
    
    // 返回 SSE 流式响应
    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用 nginx 缓冲
      },
    })
    
  } catch (error) {
    console.error('SSE proxy error:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Last-Event-ID',
      'Access-Control-Max-Age': '86400',
    },
  })
}
