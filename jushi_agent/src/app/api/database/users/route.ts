/**
 * 用户API路由
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取用户信息
 * GET /api/database/users?feishuOpenId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 构建查询参数
    const params = new URLSearchParams()
    const feishuOpenId = searchParams.get('feishuOpenId')
    const userId = searchParams.get('userId')
    const limit = searchParams.get('limit') || '50'
    
    if (feishuOpenId) params.append('feishuOpenId', feishuOpenId)
    if (userId) params.append('userId', userId)
    params.append('limit', limit)

    // 调用后端Python服务的用户API
    const backendUrl = API_CONFIG.getFullUrl(`/database/users?${params.toString()}`)
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '请求失败' }))
      return createErrorResponse(errorData.detail || errorData.error || '获取用户信息失败', 'FETCH_ERROR', response.status)
    }

    const data = await response.json()
    return createSuccessResponse(data.data ?? data, '获取用户信息成功')

  } catch (error) {
    console.error('❌ 获取用户信息失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '获取用户信息失败', 'INTERNAL_ERROR', 500)
  }
}

/**
 * 创建或更新用户
 * POST /api/database/users
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 调用后端Python服务的用户API
    const backendUrl = API_CONFIG.getFullUrl('/database/users')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '请求失败' }))
      return createErrorResponse(errorData.detail || errorData.error || '创建/更新用户失败', 'UPDATE_ERROR', response.status)
    }

    const data = await response.json()
    return createSuccessResponse(data.data ?? data, '操作成功')

  } catch (error) {
    console.error('❌ 创建/更新用户失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '创建/更新用户失败', 'INTERNAL_ERROR', 500)
  }
}

/**
 * 更新用户信息
 * PUT /api/database/users
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // 调用后端Python服务的用户API
    const backendUrl = API_CONFIG.getFullUrl('/database/users')
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '请求失败' }))
      return createErrorResponse(errorData.detail || errorData.error || '更新用户信息失败', 'UPDATE_ERROR', response.status)
    }

    const data = await response.json()
    return createSuccessResponse(data.data ?? data, '更新成功')

  } catch (error) {
    console.error('❌ 更新用户信息失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '更新用户信息失败', 'INTERNAL_ERROR', 500)
  }
}

/**
 * 删除用户
 * DELETE /api/database/users?userId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return createErrorResponse('缺少用户ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的用户API
    const backendUrl = API_CONFIG.getFullUrl(`/database/users?userId=${userId}`)
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '请求失败' }))
      return createErrorResponse(errorData.detail || errorData.error || '删除用户失败', 'DELETE_ERROR', response.status)
    }

    const data = await response.json()
    return createSuccessResponse(data.data ?? data, '删除成功')

  } catch (error) {
    console.error('❌ 删除用户失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '删除用户失败', 'INTERNAL_ERROR', 500)
  }
}
