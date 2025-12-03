/**
 * LLM配置API路由
 * 获取和更新用户的LLM配置
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取用户的LLM配置
 * GET /api/auth/llm-config
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authToken = request.cookies.get('auth-token')?.value
    
    if (!authToken) {
      return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
    }

    // 调用后端API
    const backendUrl = API_CONFIG.getFullUrl('/auth/llm-config')
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Cookie': `auth-token=${authToken}`
      },
      credentials: 'include'
    })

    const result = await response.json()
    
    if (!response.ok) {
      return createErrorResponse(result.detail || '获取配置失败', 'FETCH_ERROR', response.status)
    }

    return createSuccessResponse(result.data ?? result, '获取配置成功')
  } catch (error) {
    console.error('获取LLM配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
}

/**
 * 更新用户的LLM配置
 * PUT /api/auth/llm-config
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证用户身份
    const authToken = request.cookies.get('auth-token')?.value
    
    if (!authToken) {
      return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
    }

    const body = await request.json()

    // 调用后端API
    const backendUrl = API_CONFIG.getFullUrl('/auth/llm-config')
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cookie': `auth-token=${authToken}`
      },
      credentials: 'include',
      body: JSON.stringify(body)
    })

    const result = await response.json()
    
    if (!response.ok) {
      return createErrorResponse(result.detail || '更新配置失败', 'UPDATE_ERROR', response.status)
    }

    return createSuccessResponse(result.data ?? result, '更新配置成功')
  } catch (error) {
    console.error('更新LLM配置失败:', error)
    return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
  }
}
