/**
 * 认证服务
 * 处理用户认证和令牌管理
 */

import { NextRequest } from 'next/server';
import { backendConfig } from '../core/config';
import { ApiResponse } from '../models/feishu';
import { AuthenticationException, ExternalServiceException } from '../core/exceptions';

export class AuthService {
  private appId: string;
  private appSecret: string;
  private baseUrl: string;

  constructor() {
    this.appId = backendConfig.FEISHU_CLIENT_ID;
    this.appSecret = backendConfig.FEISHU_CLIENT_SECRET;
    this.baseUrl = backendConfig.FEISHU_BASE_URL;
  }

  private genUrl(uri: string): string {
    return `${this.baseUrl}${uri}`;
  }

  /**
   * 从请求中获取用户访问令牌
   */
  getUserAccessToken(request: NextRequest): string | null {
    try {
      // 调试：打印所有Cookie
      console.log('🔍 收到的所有Cookie:', Object.fromEntries(request.cookies));
      
      // 1. 从Cookie中获取
      const cookieToken = request.cookies.get('feishu_access_token')?.value;
      if (cookieToken) {
        console.log('✅ 从Cookie获取到飞书访问令牌:', cookieToken.substring(0, 20) + '...');
        return cookieToken;
      }

      // 2. 从Authorization Header中获取
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
        console.log('✅ 从Authorization Header获取到飞书访问令牌');
        return token;
      }

      // 3. 从Query参数中获取（用于测试）
      const url = new URL(request.url);
      const queryToken = url.searchParams.get('feishu_token');
      if (queryToken) {
        console.log('✅ 从Query参数获取到飞书访问令牌');
        return queryToken;
      }

      console.log('⚠️ 未找到飞书访问令牌');
      return null;
    } catch (error) {
      console.error('❌ 获取用户访问令牌失败:', error);
      return null;
    }
  }

  /**
   * 验证访问令牌是否有效
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const url = this.genUrl('/authen/v1/user_info');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
      
      const data = await response.json();
      return data.code === 0;
    } catch (error) {
      console.error('❌ 验证令牌失败:', error);
      return false;
    }
  }

  /**
   * 获取飞书应用身份令牌
   */
  async getTenantAccessToken(): Promise<ApiResponse<{ tenant_access_token: string; expire: number }>> {
    try {
      if (!this.appId || !this.appSecret) {
        return {
          success: false,
          error: '飞书应用配置不完整，请检查 FEISHU_CLIENT_ID 和 FEISHU_CLIENT_SECRET',
          code: 'CONFIG_ERROR'
        };
      }
      
      const url = this.genUrl('/auth/v3/tenant_access_token/internal');
      const payload = {
        app_id: this.appId,
        app_secret: this.appSecret
      };
      
      console.log('🔄 请求飞书 tenant_access_token...');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log('📥 飞书 tenant_access_token 响应:', data);
      
      if (data.code === 0) {
        console.log('✅ 成功获取飞书 tenant_access_token');
        return {
          success: true,
          data: {
            tenant_access_token: data.tenant_access_token,
            expire: data.expire || 7200
          }
        };
      } else {
        const errorMsg = data.msg || '获取 tenant_access_token 失败';
        console.log('❌ 获取 tenant_access_token 失败:', errorMsg);
        throw new ExternalServiceException(errorMsg, '飞书认证服务');
      }
    } catch (error) {
      console.error('❌ 获取 tenant_access_token 异常:', error);
      if (error instanceof ExternalServiceException) {
        throw error;
      }
      throw new ExternalServiceException('网络请求失败', '飞书认证服务');
    }
  }

  /**
   * 获取认证错误响应
   */
  getAuthErrorResponse(): ApiResponse {
    return {
      success: false,
      error: '未找到有效的飞书访问令牌，请先完成飞书登录',
      code: 'AUTHENTICATION_ERROR'
    };
  }
}
