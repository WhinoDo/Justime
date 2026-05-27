/**
 * 忘记密码API
 * 将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse, validateRequiredFields } from '@/lib/api/proxy'

/**
 * 请求密码重置
 * POST /api/auth/forgot-password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // 验证必填字段
    const validation = validateRequiredFields({ email }, ['email'])
    if (!validation.valid) {
      return createErrorResponse(`缺少必填字段: ${validation.missing.join(', ')}`, 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的忘记密码API
    const backendUrl = API_CONFIG.getFullUrl('/auth/forgot-password')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email })
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '发送重置邮件失败', 'FORGOT_PASSWORD_ERROR', response.status)
    }

    return createSuccessResponse(null, data.message || '如果该邮箱已注册，您将收到密码重置邮件')

  } catch (error) {
    console.error('❌ 忘记密码API错误:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '服务器内部错误',
      'INTERNAL_ERROR',
      500
    )
  }
}
