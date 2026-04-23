/**
 * API代理工具
 * 用于前端API路由转发请求到后端服务
 */

import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG, DEFAULT_HEADERS, ApiResponse } from './config';

function normalizeAuthToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return null;
  }

  const unquotedToken = trimmedToken.replace(/^(['"])(.*)\1$/, '$2').trim();
  if (!unquotedToken) {
    return null;
  }

  // Ignore common placeholder values from broken cookie/header writes.
  if (/^(undefined|null)$/i.test(unquotedToken)) {
    return null;
  }

  const bearerMatch = unquotedToken.match(/^Bearer(?:\s+(.+))?$/i);
  if (bearerMatch) {
    const bearerPayload = bearerMatch[1]?.trim();
    if (!bearerPayload || /^(undefined|null)$/i.test(bearerPayload)) {
      return null;
    }
    return `Bearer ${bearerPayload}`;
  }

  return `Bearer ${unquotedToken}`;
}

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

      const normalizedAuthHeader = authHeader ? normalizeAuthToken(authHeader) : null;
      if (normalizedAuthHeader) {
        requestHeaders['Authorization'] = normalizedAuthHeader;
      } else if (cookieHeader) {
        // 如果没有 Authorizaton 头但有 Cookie，尝试从 Cookie 提取 access_token
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const trimmed = cookie.trim();
          const separatorIndex = trimmed.indexOf('=');
          if (separatorIndex <= 0) {
            return acc;
          }

          const key = trimmed.slice(0, separatorIndex);
          const value = trimmed.slice(separatorIndex + 1);
          if (key && value) acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

        const accessToken = cookies['access_token'];
        if (accessToken) {
          // Cookie 中 token 可能是 URL 编码值，先安全解码再规范化 Bearer 头格式
          let decodedToken = accessToken;
          try {
            decodedToken = decodeURIComponent(accessToken.replace(/\+/g, '%20'));
          } catch {
            decodedToken = accessToken;
          }

          const normalizedToken = normalizeAuthToken(decodedToken);
          if (normalizedToken) {
            requestHeaders['Authorization'] = normalizedToken;
          }
        }
      }

      if (cookieHeader) {
        requestHeaders['Cookie'] = cookieHeader;
      }
    }

    // 构建请求体
    let requestBody: BodyInit | undefined;
    if (body !== undefined) {
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

    // 生产环境禁用调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔀 代理请求: ${method} ${backendUrl}`);
    }

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
      // 仅在非生产环境保留 422 调试 URL，避免生产暴露内部地址细节
      if (response.status === 422 && process.env.NODE_ENV !== 'production') {
        data._debugUrl = backendUrl;
      }
    } catch {
      data = responseData;
    }

    if (process.env.NODE_ENV === 'production') {
      console.log(`📥 后端响应: ${response.status}`, {
        responseLength: responseData.length
      });
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`📥 后端响应: ${response.status}`, responseData.slice(0, 200));
    }

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
  const missing = requiredFields.filter(field => {
    if (!Object.prototype.hasOwnProperty.call(data, field)) {
      return true;
    }

    const value = data[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });

  return {
    valid: missing.length === 0,
    missing
  };
}

export function getAccessToken(request: NextRequest): string | null {
  return request.cookies.get('access_token')?.value ?? null
}

export function resolveAuthorizationHeader(request: NextRequest): string | null {
  const requestAuthHeader = request.headers.get('authorization')
  if (requestAuthHeader) {
    return requestAuthHeader.startsWith('Bearer ')
      ? requestAuthHeader
      : `Bearer ${requestAuthHeader}`
  }

  const authToken = getAccessToken(request)
  if (!authToken) {
    return null
  }

  return authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
}

function resolveErrorMessage(result: any, fallbackMessage: string): string {
  if (typeof result?.detail === 'string' && result.detail) return result.detail
  if (typeof result?.message === 'string' && result.message) return result.message
  if (typeof result?.error === 'string' && result.error) return result.error
  return fallbackMessage
}

async function parseProxyResponse(response: Response): Promise<any> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function proxyWithAuth(
  request: NextRequest,
  endpoint: string,
  options: {
    method?: string
    body?: any
    successMessage: string
    errorMessage: string
    errorCode: string
    cache?: RequestCache
  }
): Promise<NextResponse> {
  try {
    const authorization = resolveAuthorizationHeader(request)
    if (!authorization) {
      return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
    }

    const {
      method = request.method,
      body,
      successMessage,
      errorMessage,
      errorCode,
      cache,
    } = options

    const headers: Record<string, string> = {
      Authorization: authorization,
    }

    let requestBody: string | undefined
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      requestBody = typeof body === 'string' ? body : JSON.stringify(body)
    }

    let backendUrl = API_CONFIG.getFullUrl(endpoint)
    const query = request.nextUrl.searchParams.toString()
    if (query) {
      backendUrl += backendUrl.includes('?') ? `&${query}` : `?${query}`
    }

    const response = await fetch(backendUrl, {
      method,
      headers,
      body: requestBody,
      credentials: 'include',
      ...(cache ? { cache } : {}),
    })

    const result = await parseProxyResponse(response)
    if (!response.ok) {
      return createErrorResponse(resolveErrorMessage(result, errorMessage), errorCode, response.status)
    }

    return createSuccessResponse(result, successMessage)
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : '服务器内部错误',
      'INTERNAL_ERROR',
      500,
    )
  }
}
