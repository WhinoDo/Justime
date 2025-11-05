/**
 * 飞书Token调试API
 * 专门用于调试和查看完整的API响应
 */

import { NextRequest, NextResponse } from 'next/server'
import { FEISHU_CONFIG } from '@/lib/feishu/config'

interface TokenResponse {
  code: number
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

/**
 * 调用飞书API获取user_access_token（调试版本）
 */
async function getFeishuUserAccessTokenDebug(code: string, redirectUri: string): Promise<{
  success: boolean
  data?: TokenResponse
  error?: string
  requestDetails: any
  responseDetails: any
}> {
  const tokenUrl = FEISHU_CONFIG.ENDPOINTS.TOKEN
  
  const requestBody: any = {
    grant_type: 'authorization_code',
    client_id: FEISHU_CONFIG.CLIENT_ID,
    client_secret: FEISHU_CONFIG.CLIENT_SECRET,
    code: code,
    redirect_uri: redirectUri
  }

  const requestDetails = {
    url: tokenUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: requestBody
  }

  try {
    console.log('🔍 [DEBUG] 飞书Token API请求详情:', requestDetails)
    
    // 详细记录请求体（开发环境）
    if (process.env.NODE_ENV === 'development') {
    console.log('📤 [DEBUG] 飞书Token API请求体:', {
      grant_type: requestBody.grant_type,
      client_id: requestBody.client_id,
      client_secret: requestBody.client_secret ? '***' : 'missing',
      code: requestBody.code,
      redirect_uri: requestBody.redirect_uri
    })
    }
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(requestBody)
    })

    const responseText = await response.text()
    let responseData: TokenResponse
    
    try {
      responseData = JSON.parse(responseText)
    } catch (parseError) {
      return {
        success: false,
        error: '响应解析失败',
        requestDetails,
        responseDetails: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          rawResponse: responseText
        }
      }
    }

    const responseDetails = {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData
    }

    console.log('🔍 [DEBUG] 飞书Token API响应详情:', responseDetails)

    return {
      success: response.ok && responseData.code === 0,
      data: responseData,
      requestDetails,
      responseDetails
    }

  } catch (error) {
    console.error('❌ [DEBUG] 调用飞书Token API失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      requestDetails,
      responseDetails: {
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, state, redirect_uri } = body

    console.log('🔍 [DEBUG] 收到调试请求:', {
      hasCode: !!code,
      hasState: !!state,
      redirect_uri
    })

    if (!code) {
      return NextResponse.json({
        success: false,
        error: '缺少授权码',
        requestDetails: null,
        responseDetails: null
      })
    }

    const finalRedirectUri = redirect_uri || FEISHU_CONFIG.REDIRECT_URI

    // 调用调试版本的Token获取函数
    const result = await getFeishuUserAccessTokenDebug(code, finalRedirectUri)

    return NextResponse.json({
      success: result.success,
      error: result.error,
      data: result.data,
      requestDetails: result.requestDetails,
      responseDetails: result.responseDetails,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [DEBUG] 调试API错误:', error)
    return NextResponse.json({
      success: false,
      error: `调试API错误: ${error instanceof Error ? error.message : '未知错误'}`,
      requestDetails: null,
      responseDetails: null,
      timestamp: new Date().toISOString()
    })
  }
}
