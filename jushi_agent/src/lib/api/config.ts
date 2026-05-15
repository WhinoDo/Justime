/**
 * API配置
 * 前后端分离架构下的API代理配置
 */

// 后端服务地址配置
const rawBaseUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://127.0.0.1:8080';

export const API_CONFIG = {
  // 后端服务基础地址
  BASE_URL: rawBaseUrl.replace(/\/+$/, ''),
  
  // API版本前缀
  API_PREFIX: '/api/v1',
  
  // 获取完整的API地址
  getFullUrl: (endpoint: string): string => {
    // 如果endpoint已经是完整URL，直接返回
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    
    // 确保endpoint以/开头
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // endpoint 已经包含 API 前缀时，避免重复拼接 /api/v1
    if (
      cleanEndpoint === API_CONFIG.API_PREFIX ||
      cleanEndpoint.startsWith(`${API_CONFIG.API_PREFIX}/`) ||
      cleanEndpoint.startsWith(`${API_CONFIG.API_PREFIX}?`)
    ) {
      return `${API_CONFIG.BASE_URL}${cleanEndpoint}`;
    }

    return `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}${cleanEndpoint}`;
  }
};

// 外部API服务配置
export const EXTERNAL_API_ENDPOINTS = {
  SILICONFLOW: {
    BASE_URL: 'https://api.siliconflow.cn/v1',
    CHAT_COMPLETIONS: 'https://api.siliconflow.cn/v1/chat/completions',
  },
} as const;

// CORS配置
export const CORS_CONFIG = {
  // 允许的来源
  ALLOWED_ORIGINS: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://192.168.1.4:3000',
    'http://192.168.6.17:3000'
  ],
  
  // 允许的请求头
  ALLOWED_HEADERS: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Accept-Language',
    'Content-Language',
    'Cache-Control'
  ]
};

// 默认请求头
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// 错误码定义
export const ERROR_CODES = {
  SUCCESS: 0,
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502
} as const;

// API响应类型定义
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string | number;
  message?: string;
  timestamp?: string;
}

// 分页响应类型
export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  next_page?: string;
  prev_page?: string;
}
