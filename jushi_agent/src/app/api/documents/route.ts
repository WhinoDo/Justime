/**
 * 工作文档API - 代理到后端
 * GET - 获取文档内容
 * POST - 保存文档内容
 */

import { NextRequest } from 'next/server'
import { proxyWithAuth, createErrorResponse } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
    const eventId = request.nextUrl.searchParams.get('eventId')
    if (!eventId) {
        return createErrorResponse('缺少必需参数 eventId', 'VALIDATION_ERROR', 400)
    }
    
    return proxyWithAuth(request, `/documents?eventId=${eventId}`, {
        successMessage: '获取文档成功',
        errorMessage: '获取文档失败',
        errorCode: 'DOCUMENT_ERROR',
    })
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { eventId, content } = body
        
        if (!eventId) {
            return createErrorResponse('缺少必需字段 eventId', 'VALIDATION_ERROR', 400)
        }
        
        return proxyWithAuth(request, '/documents', {
            method: 'POST',
            body: { eventId, content },
            successMessage: '文档保存成功',
            errorMessage: '保存文档失败',
            errorCode: 'DOCUMENT_ERROR',
        })
    } catch (error) {
        return createErrorResponse(
            error instanceof Error ? error.message : '保存文档失败',
            'INTERNAL_ERROR',
            500
        )
    }
}
