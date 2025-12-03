/**
 * API代理工具
 * 用于前端API路由转发请求到后端服务
 */

import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG, DEFAULT_HEADERS, ApiResponse } from './config';

/**
 * 代理请求到后端服务
 */
export async function proxyToBackend(
  request: NextRequest,
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    requireAuth?: boolean;
  } = {}
): Promise<NextResponse> {
  try {
    const {
      method = request.method,
      body,
      headers = {},
      requireAuth = true
    } = options;

    // 构建请求头
    const requestHeaders: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...headers
    };

    // 如果需要认证，添加认证头
    if (requireAuth) {
      const authHeader = request.headers.get('authorization');
      const cookieHeader = request.headers.get('cookie');
      
      if (authHeader) {
        requestHeaders['Authorization'] = authHeader;
      }
      
      if (cookieHeader) {
        requestHeaders['Cookie'] = cookieHeader;
      }
    }

    // 构建请求体
    let requestBody: string | undefined;
    if (body) {
      requestBody = typeof body === 'string' ? body : JSON.stringify(body);
    } else if (request.method !== 'GET' && request.method !== 'HEAD') {
      // 从原始请求中读取body
      const clonedRequest = request.clone();
      requestBody = await clonedRequest.text();
    }

    // 构建完整的后端URL
    const backendUrl = API_CONFIG.getFullUrl(endpoint);
    
    console.log(`🔀 代理请求: ${method} ${backendUrl}`);
    
    // 发送请求到后端
    const response = await fetch(backendUrl, {
      method,
      headers: requestHeaders,
      body: requestBody,
      // 保持原始请求的credentials
      credentials: 'include'
    });

    // 获取响应数据
    const responseData = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(responseData);
    } catch {
      data = responseData;
    }

    console.log(`📥 后端响应: ${response.status}`, responseData.slice(0, 200));

    // 创建响应
    const nextResponse = NextResponse.json(
      data,
      { 
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'application/json'
        }
      }
    );

    // 转发Set-Cookie头
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('set-cookie', setCookieHeader);
    }

    return nextResponse;

  } catch (error) {
    console.error('❌ 代理请求失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '代理请求失败',
        code: 'PROXY_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * 创建标准化的错误响应
 */
export function createErrorResponse(
  message: string,
  code: string = 'INTERNAL_ERROR',
  status: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      details: details || null,
      timestamp: new Date().toISOString()
    },
    { status }
  );
}

/**
 * 创建标准化的成功响应
 */
export function createSuccessResponse(
  data: any,
  message?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message: message || '操作成功',
      timestamp: new Date().toISOString()
    },
    { status }
  );
}

/**
 * 验证必填字段
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter(field => !data[field]);
  
  return {
    valid: missing.length === 0,
    missing
  };
}