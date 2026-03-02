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

    // 判断是否为 multipart/form-data 文件上传请求
    const sourceContentType = request.headers.get('content-type') || '';
    const isMultipart = sourceContentType.includes('multipart/form-data');

    // 构建请求头
    const requestHeaders: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...headers
    };

    // 对 multipart 请求移除默认 JSON Content-Type，让 fetch 自动附加带 boundary 的 header
    if (isMultipart) {
      delete requestHeaders['Content-Type'];
      delete requestHeaders['content-type'];
    }

    // 如果需要认证，添加认证头
    if (requireAuth) {
      const authHeader = request.headers.get('authorization');
      const cookieHeader = request.headers.get('cookie');

      if (authHeader) {
        requestHeaders['Authorization'] = authHeader;
      } else if (cookieHeader) {
        // 如果没有 Authorizaton 头但有 Cookie，尝试从 Cookie 提取 access_token
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          if (key && value) acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

        const accessToken = cookies['access_token'];
        if (accessToken) {
          // 确保 token 格式正确
          const tokenValue = accessToken.startsWith('Bearer%20')
            ? accessToken.replace('Bearer%20', 'Bearer ')
            : `Bearer ${accessToken}`;

          requestHeaders['Authorization'] = tokenValue;
        }
      }

      if (cookieHeader) {
        requestHeaders['Cookie'] = cookieHeader;
      }
    }

    // 构建请求体
    let requestBody: BodyInit | undefined;
    if (body) {
      if (typeof body === 'string') {
        requestBody = body;
      } else if (body instanceof FormData) {
        requestBody = body;
      } else {
        requestBody = JSON.stringify(body);
      }
    } else if (method !== 'GET' && method !== 'HEAD') {
      if (isMultipart) {
        requestBody = await request.formData();
      } else {
        // 从原始请求中读取 body 文本（JSON 等）
        const clonedRequest = request.clone();
        requestBody = await clonedRequest.text();
      }
    }

    // 构建完整的后端URL
    let backendUrl = API_CONFIG.getFullUrl(endpoint);

    // 如果原请求带有查询参数，将其附加到后端URL
    if (request.nextUrl && request.nextUrl.searchParams) {
      const queryStr = request.nextUrl.searchParams.toString();
      if (queryStr) {
        if (backendUrl.includes('?')) {
          backendUrl += `&${queryStr}`;
        } else {
          backendUrl += `?${queryStr}`;
        }
      }
    }

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
      // 🔥 关键调试点：如果后端返回了 422，强制把代理时拼凑的具体 URL 塞进响应里，供前端查看
      if (response.status === 422) {
        data._debugUrl = backendUrl;
      }
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
