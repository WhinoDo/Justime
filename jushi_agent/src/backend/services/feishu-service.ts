/**
 * 飞书服务
 * 处理飞书API调用
 */

import { backendConfig } from '../core/config';
import { 
  FeishuTokenInfo, 
  FeishuUserInfo, 
  FeishuCalendarListResponse, 
  FeishuCalendarEventsResponse,
  ApiResponse 
} from '../models/feishu';
import { ExternalServiceException } from '../core/exceptions';

export class FeishuService {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.baseUrl = backendConfig.FEISHU_BASE_URL;
    this.clientId = backendConfig.FEISHU_CLIENT_ID;
    this.clientSecret = backendConfig.FEISHU_CLIENT_SECRET;
  }

  private genUrl(uri: string): string {
    return `${this.baseUrl}${uri}`;
  }

  /**
   * 使用授权码获取访问令牌
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<ApiResponse<FeishuTokenInfo>> {
    try {
      const url = this.genUrl('/authen/v1/oidc/access_token');
      
      const payload = {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri
      };
      
      console.log('🔄 交换授权码获取访问令牌...');
      console.log('📤 请求URL:', url);
      console.log('📤 请求参数:', { ...payload, code: code.substring(0, 10) + '...' });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log('📥 飞书Token API响应:', data);
      
      if (data.code === 0) {
        console.log('✅ 成功获取访问令牌');
        return {
          success: true,
          data: {
            access_token: data.access_token,
            token_type: data.token_type || 'Bearer',
            expires_in: data.expires_in,
            scope: data.scope,
            refresh_token: data.refresh_token,
            refresh_expires_in: data.refresh_expires_in
          }
        };
      } else {
        const errorMsg = data.msg || '获取访问令牌失败';
        console.log('❌ 获取访问令牌失败:', errorMsg);
        throw new ExternalServiceException(errorMsg, '飞书Token服务');
      }
    } catch (error) {
      console.error('❌ 交换授权码异常:', error);
      if (error instanceof ExternalServiceException) {
        throw error;
      }
      throw new ExternalServiceException('网络请求失败', '飞书Token服务');
    }
  }

  /**
   * 使用访问令牌获取用户信息
   */
  async getUserInfo(accessToken: string): Promise<ApiResponse<FeishuUserInfo>> {
    try {
      const url = this.genUrl('/authen/v1/user_info');
      
      console.log('🔄 获取飞书用户信息...');
      console.log('📤 请求URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
      
      const data = await response.json();
      console.log('📥 飞书用户信息API响应:', data);
      
      if (data.code === 0) {
        const userData = data.data;
        console.log('✅ 成功获取用户信息');
        return {
          success: true,
          data: {
            open_id: userData.open_id,
            union_id: userData.union_id,
            name: userData.name,
            avatar_url: userData.avatar_url,
            email: userData.email,
            mobile: userData.mobile
          }
        };
      } else {
        const errorMsg = data.msg || '获取用户信息失败';
        console.log('❌ 获取用户信息失败:', errorMsg);
        throw new ExternalServiceException(errorMsg, '飞书用户信息服务');
      }
    } catch (error) {
      console.error('❌ 获取用户信息异常:', error);
      if (error instanceof ExternalServiceException) {
        throw error;
      }
      throw new ExternalServiceException('网络请求失败', '飞书用户信息服务');
    }
  }

  /**
   * 获取日历列表
   */
  async getCalendars(
    userAccessToken: string,
    pageSize: number = 50,
    pageToken?: string,
    syncToken?: string
  ): Promise<ApiResponse<FeishuCalendarListResponse>> {
    try {
      const url = this.genUrl('/calendar/v4/calendars');
      
      const params = new URLSearchParams({
        page_size: pageSize.toString()
      });
      
      if (pageToken) params.append('page_token', pageToken);
      if (syncToken) params.append('sync_token', syncToken);
      
      console.log('📅 获取飞书日历列表...');
      console.log('📤 请求URL:', url);
      console.log('📤 请求参数:', Object.fromEntries(params));
      
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
      
      const data = await response.json();
      console.log('📥 飞书日历列表API响应:', data);
      
      if (data.code === 0) {
        console.log('✅ 成功获取日历列表');
        return {
          success: true,
          data: {
            calendars: data.data.calendars || [],
            has_more: data.data.has_more || false,
            page_token: data.data.page_token || '',
            sync_token: data.data.sync_token || ''
          }
        };
      } else {
        const errorMsg = data.msg || '获取日历列表失败';
        console.log('❌ 获取日历列表失败:', errorMsg);
        throw new ExternalServiceException(errorMsg, '飞书日历服务');
      }
    } catch (error) {
      console.error('❌ 获取日历列表异常:', error);
      if (error instanceof ExternalServiceException) {
        throw error;
      }
      throw new ExternalServiceException('网络请求失败', '飞书日历服务');
    }
  }

  /**
   * 获取日历事件
   */
  async getCalendarEvents(
    userAccessToken: string,
    calendarId: string,
    pageSize: number = 50,
    pageToken?: string,
    syncToken?: string,
    startTime?: string,
    endTime?: string,
    anchorTime?: string
  ): Promise<ApiResponse<FeishuCalendarEventsResponse>> {
    try {
      const url = this.genUrl(`/calendar/v4/calendars/${calendarId}/events`);
      
      const params = new URLSearchParams({
        page_size: pageSize.toString()
      });
      
      if (pageToken) params.append('page_token', pageToken);
      if (syncToken) params.append('sync_token', syncToken);
      if (startTime) params.append('start_time', startTime);
      if (endTime) params.append('end_time', endTime);
      if (anchorTime) params.append('anchor_time', anchorTime);
      
      console.log('📅 获取飞书日历事件...');
      console.log('📤 请求URL:', url);
      console.log('📤 请求参数:', Object.fromEntries(params));
      
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
      
      const data = await response.json();
      console.log('📥 飞书日历事件API响应:', data);
      
      if (data.code === 0) {
        console.log('✅ 成功获取日历事件');
        return {
          success: true,
          data: {
            items: data.data.items || [],
            has_more: data.data.has_more || false,
            page_token: data.data.page_token || '',
            sync_token: data.data.sync_token || ''
          }
        };
      } else {
        const errorMsg = data.msg || '获取日历事件失败';
        console.log('❌ 获取日历事件失败:', errorMsg);
        throw new ExternalServiceException(errorMsg, '飞书日历事件服务');
      }
    } catch (error) {
      console.error('❌ 获取日历事件异常:', error);
      if (error instanceof ExternalServiceException) {
        throw error;
      }
      throw new ExternalServiceException('网络请求失败', '飞书日历事件服务');
    }
  }
}
