/**
 * 飞书业务逻辑层
 * 处理飞书相关的业务逻辑，分离API层和Service层
 */

import { NextRequest } from 'next/server';
import { FeishuService } from '../services/feishu-service';
import { AuthService } from '../services/auth-service';
import { 
  OAuthCallbackRequest, 
  ApiResponse, 
  FeishuCalendarListResponse, 
  FeishuCalendarEventsResponse 
} from '../models/feishu';
import { AuthenticationException } from '../core/exceptions';

export class FeishuBusiness {
  private feishuService: FeishuService;
  private authService: AuthService;

  constructor() {
    this.feishuService = new FeishuService();
    this.authService = new AuthService();
  }

  /**
   * 获取日历列表业务逻辑
   */
  async getCalendars(
    request: NextRequest,
    pageSize: number = 50,
    pageToken?: string,
    syncToken?: string
  ): Promise<ApiResponse<FeishuCalendarListResponse>> {
    try {
      console.log('📅 开始获取飞书日历列表...');
      
      // 获取用户访问令牌
      const userAccessToken = this.authService.getUserAccessToken(request);
      
      if (!userAccessToken) {
        throw new AuthenticationException();
      }
      
      // 调用服务层获取日历列表
      const result = await this.feishuService.getCalendars(
        userAccessToken,
        pageSize,
        pageToken,
        syncToken
      );
      
      if (!result.success) {
        return result;
      }
      
      console.log('✅ 飞书日历列表获取成功');
      return {
        success: true,
        data: result.data,
        message: '日历列表获取成功'
      };
      
    } catch (error) {
      console.error('❌ 获取飞书日历列表失败:', error);
      if (error instanceof AuthenticationException) {
        return {
          success: false,
          error: error.message,
          code: 'AUTHENTICATION_ERROR'
        };
      }
      return {
        success: false,
        error: '服务器内部错误',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * 获取日历事件业务逻辑
   */
  async getCalendarEvents(
    request: NextRequest,
    calendarId: string,
    pageSize: number = 50,
    pageToken?: string,
    syncToken?: string,
    startTime?: string,
    endTime?: string,
    anchorTime?: string
  ): Promise<ApiResponse<FeishuCalendarEventsResponse>> {
    try {
      console.log(`📅 开始获取日历 ${calendarId} 的事件列表...`);
      
      // 获取用户访问令牌
      const userAccessToken = this.authService.getUserAccessToken(request);
      
      if (!userAccessToken) {
        throw new AuthenticationException();
      }
      
      // 调用服务层获取日历事件
      const result = await this.feishuService.getCalendarEvents(
        userAccessToken,
        calendarId,
        pageSize,
        pageToken,
        syncToken,
        startTime,
        endTime,
        anchorTime
      );
      
      if (!result.success) {
        return result;
      }
      
      console.log('✅ 飞书日历事件列表获取成功');
      return {
        success: true,
        data: result.data,
        message: '日历事件列表获取成功'
      };
      
    } catch (error) {
      console.error('❌ 获取飞书日历事件失败:', error);
      if (error instanceof AuthenticationException) {
        return {
          success: false,
          error: error.message,
          code: 'AUTHENTICATION_ERROR'
        };
      }
      return {
        success: false,
        error: '服务器内部错误',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * 处理OAuth回调业务逻辑
   */
  async handleOAuthCallback(request: OAuthCallbackRequest): Promise<ApiResponse> {
    try {
      console.log("🔄 开始处理飞书OAuth回调...");
      console.log(`📥 收到回调请求: code=${request.code.substring(0, 10)}..., state=${request.state}`);
      
      // 使用默认重定向URI或提供的URI
      const redirectUri = request.redirect_uri || "http://localhost:3000/feishu/bind-callback";
      
      // 1. 交换授权码获取访问令牌
      const tokenResult = await this.feishuService.exchangeCodeForToken(request.code, redirectUri);
      
      if (!tokenResult.success) {
        return {
          success: false,
          error: tokenResult.error || '获取访问令牌失败',
          code: 'TOKEN_ERROR'
        };
      }
      
      // 2. 获取用户信息
      const userResult = await this.feishuService.getUserInfo(tokenResult.data!.access_token);
      
      if (!userResult.success) {
        return {
          success: false,
          error: userResult.error || '获取用户信息失败',
          code: 'USER_INFO_ERROR'
        };
      }
      
      // 3. 构建响应数据
      const responseData = {
        user: {
          id: userResult.data!.open_id,
          username: userResult.data!.name,
          displayName: userResult.data!.name,
          hasFeishuBinding: true,
          feishuBinding: {
            openId: userResult.data!.open_id,
            unionId: userResult.data!.union_id,
            name: userResult.data!.name,
            avatar: userResult.data!.avatar_url || '',
            email: userResult.data!.email || '',
            mobile: userResult.data!.mobile || '',
            bindTime: new Date().toISOString()
          }
        },
        tokenInfo: {
          accessToken: tokenResult.data!.access_token,
          tokenType: tokenResult.data!.token_type,
          expiresIn: tokenResult.data!.expires_in,
          scope: tokenResult.data!.scope,
          refreshToken: tokenResult.data!.refresh_token,
          refreshExpiresIn: tokenResult.data!.refresh_expires_in
        }
      };
      
      console.log("✅ 飞书OAuth回调处理成功");
      return {
        success: true,
        data: responseData,
        message: "飞书账号绑定成功"
      };
      
    } catch (error) {
      console.error("❌ 处理OAuth回调异常:", error);
      return {
        success: false,
        error: `处理OAuth回调失败: ${error instanceof Error ? error.message : '未知错误'}`,
        code: 'CALLBACK_ERROR'
      };
    }
  }

  /**
   * 获取应用令牌业务逻辑
   */
  async getTenantToken(): Promise<ApiResponse<{ tenant_access_token: string; expire: number }>> {
    try {
      console.log("🔄 开始获取飞书 tenant_access_token...");
      
      const result = await this.authService.getTenantAccessToken();
      
      if (result.success) {
        console.log("✅ 飞书 tenant_access_token 获取成功");
        return {
          success: true,
          data: result.data!,
          message: "应用令牌获取成功"
        };
      } else {
        console.log(`❌ 飞书 tenant_access_token 获取失败: ${result.error}`);
        return {
          success: false,
          error: result.error || '获取应用令牌失败',
          code: result.code || 'TOKEN_ERROR'
        };
      }
      
    } catch (error) {
      console.error("❌ 获取 tenant_access_token 异常:", error);
      return {
        success: false,
        error: `获取 tenant_access_token 失败: ${error instanceof Error ? error.message : '未知错误'}`,
        code: 'TOKEN_ERROR'
      };
    }
  }
}
