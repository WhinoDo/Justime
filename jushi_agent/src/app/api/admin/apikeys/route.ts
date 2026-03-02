import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const backendUrl = API_CONFIG.getFullUrl('/admin/apikeys')
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include',
            cache: 'no-store'
        })

        const result = await response.json()
        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '获取 API Key 列表失败', 'FETCH_ERROR', response.status)
        }

        return createSuccessResponse(result, '获取 API Key 列表成功')
    } catch (error) {
        console.error('获取 API Key 列表失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}

export async function POST(request: NextRequest) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const body = await request.json()
        const backendUrl = API_CONFIG.getFullUrl('/admin/apikeys')
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            body: JSON.stringify(body),
            credentials: 'include'
        })

        const result = await response.json()
        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '新增 API Key 失败', 'CREATE_ERROR', response.status)
        }

        return createSuccessResponse(result, '新增 API Key 成功')
    } catch (error) {
        console.error('新增 API Key 失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
