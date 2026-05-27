/**
 * LLM配置测试API
 * 测试用户提供的LLM配置是否有效
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 测试LLM配置
 * POST /api/llm/test
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { modelId, apiKey, baseUrl, timeout } = body

    // 验证必需参数
    if (!modelId || !apiKey || !baseUrl) {
      return createErrorResponse('缺少必需的配置参数', 'VALIDATION_ERROR', 400)
    }

    // 调用后端API测试配置
    const backendUrl = API_CONFIG.getFullUrl('/llm/test-config')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId,
        apiKey,
        baseUrl,
        timeout: timeout || 60
      })
    })

    const result = await response.json()
    
    if (!response.ok) {
      return createErrorResponse(result.detail || result.error || '配置测试失败', 'LLM_TEST_ERROR', response.status)
    }

    return createSuccessResponse(result.data ?? result, '配置测试成功')
  } catch (error) {
    console.error('测试LLM配置失败:', error)
    return createErrorResponse('测试配置时发生错误', 'INTERNAL_ERROR', 500)
  }
}
