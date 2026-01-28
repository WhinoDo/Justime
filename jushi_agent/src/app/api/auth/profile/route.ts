/**
 * 用户资料管理API
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取用户资料
 * GET /api/auth/profile
 */
export async function GET(request: NextRequest) {
  try {
    // 从cookie中获取token
    const token = request.cookies.get('access_token')?.value

    if (!token) {
      return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
    }

    // 调用后端Python服务的获取用户资料API
    const backendUrl = API_CONFIG.getFullUrl('/auth/profile')
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '获取用户资料失败', 'FETCH_PROFILE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '获取用户资料成功')

  } catch (error) {
    console.error('❌ 获取用户资料失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 })
  }
}

/**
 * 更新用户资料
 * PUT /api/auth/profile
 */
export async function PUT(request: NextRequest) {
  try {
    // 从cookie中获取token
    const token = request.cookies.get('access_token')?.value

    if (!token) {
      return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
    }

    const body = await request.json()

    if (!body.profile) {
      return createErrorResponse('缺少资料数据', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的更新用户资料API
    const backendUrl = API_CONFIG.getFullUrl('/auth/profile')
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '更新用户资料失败', 'UPDATE_PROFILE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '更新用户资料成功')

  } catch (error) {
    console.error('❌ 更新用户资料失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '服务器内部错误', 'INTERNAL_ERROR', 500)
  }
}
