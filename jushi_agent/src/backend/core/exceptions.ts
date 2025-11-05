/**
 * 后端异常处理
 */

import { NextResponse } from 'next/server';

export class BackendException extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationException extends BackendException {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationException extends BackendException {
  constructor(message: string = '未找到有效的访问令牌') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationException extends BackendException {
  constructor(message: string = '权限不足') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundException extends BackendException {
  constructor(message: string = '资源未找到') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ExternalServiceException extends BackendException {
  constructor(message: string, service: string) {
    super(`${service}服务错误: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
  }
}

/**
 * 创建标准化的错误响应
 */
export function createErrorResponse(
  error: BackendException | Error,
  details?: any
): NextResponse {
  const statusCode = error instanceof BackendException ? error.statusCode : 500;
  const code = error instanceof BackendException ? error.code : 'INTERNAL_ERROR';
  
  return NextResponse.json(
    {
      success: false,
      error: error.message,
      code,
      details: details || null,
      timestamp: new Date().toISOString()
    },
    { status: statusCode }
  );
}

/**
 * 创建成功响应
 */
export function createSuccessResponse(
  data: any,
  message?: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message: message || '操作成功',
      timestamp: new Date().toISOString()
    },
    { status: statusCode }
  );
}
