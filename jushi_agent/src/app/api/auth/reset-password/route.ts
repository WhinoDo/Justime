/**
 * 重置密码API
 * 将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse, validateRequiredFields } from '@/lib/api/proxy'

/**
 * 重置密码
 * POST /api/auth/reset-password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, new_password } = body

    // 验证必填字段
    const validation = validateRequiredFields({ token, new_password }, ['token', 'new_password'])
    if (!validation.valid) {
      return createErrorResponse(`缺少必填字段: ${validation.missing.join(', ')}`, 'VALIDATION_ERROR', 400)
    }

    // 验证密码长度
    if (new_password.length < 8) {
      return createErrorResponse('密码至少需要8个字符', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的重置密码API
    const backendUrl = API_CONFIG.getFullUrl('/auth/reset-password')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, new_password })
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '重置密码失败', 'RESET_PASSWORD_ERROR', response.status)
    }

    return createSuccessResponse(null, data.message || '密码重置成功，请使用新密码登录')

  } catch (error) {
    console.error('❌ 重置密码API错误:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '服务器内部错误',
      'INTERNAL_ERROR',
      500
    )
  }
}
