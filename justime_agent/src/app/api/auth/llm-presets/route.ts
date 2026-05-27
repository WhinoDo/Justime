/**
 * LLM模型预设API路由
 * 获取系统支持的LLM模型预设
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取LLM模型预设
 * GET /api/auth/llm-presets
 */
export async function GET(request: NextRequest) {
    try {
        // 调用后端API
        // 注意：获取预设可能不需要认证，根据后端实现决定。这里保持简单直接获取。
        const backendUrl = API_CONFIG.getFullUrl('/auth/llm-presets')
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        const result = await response.json()

        if (!response.ok) {
            return createErrorResponse(result.detail || '获取模型预设失败', 'FETCH_ERROR', response.status)
        }

        return createSuccessResponse(result.data ?? result, '获取模型预设成功')
    } catch (error) {
        console.error('获取LLM预设失败:', error)
        return NextResponse.json({
            success: false,
            error: '服务器内部错误'
        }, { status: 500 })
    }
}
