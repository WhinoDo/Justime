/**
 * 飞书OAuth回调API
 * 处理飞书OAuth授权回调
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeishuBusiness } from '@/backend/business/feishu-business';
import { createErrorResponse, createSuccessResponse } from '@/backend/core/exceptions';
import { OAuthCallbackRequest } from '@/backend/models/feishu';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 开始处理飞书OAuth回调...');
    
    // 解析请求体
    const body = await request.json();
    console.log('📥 收到回调请求:', { 
      code: body.code ? body.code.substring(0, 10) + '...' : 'undefined',
      state: body.state,
      redirect_uri: body.redirect_uri 
    });
    
    // 验证必需参数
    if (!body.code) {
      return createErrorResponse(
        new Error('授权码(code)参数是必需的'),
        { code: 'MISSING_CODE' }
      );
    }
    
    // 构建回调请求对象
    const callbackRequest: OAuthCallbackRequest = {
      code: body.code,
      state: body.state,
      redirect_uri: body.redirect_uri
    };
    
    // 创建业务逻辑实例
    const feishuBusiness = new FeishuBusiness();
    
    // 调用业务逻辑
    const result = await feishuBusiness.handleOAuthCallback(callbackRequest);
    
    if (result.success) {
      console.log('✅ 飞书OAuth回调处理成功');
      
      // 创建响应并设置Cookie
      const response = createSuccessResponse(result.data, '飞书账号绑定成功');
      
      // 设置访问令牌Cookie
      if (result.data?.tokenInfo?.accessToken) {
        response.cookies.set('feishu_access_token', result.data.tokenInfo.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: result.data.tokenInfo.expiresIn || 7200
        });
      }
      
      return response;
    } else {
      console.log('❌ 飞书OAuth回调处理失败:', result.error);
      return createErrorResponse(
        new Error(result.error || 'OAuth回调处理失败'),
        { code: result.code }
      );
    }
    
  } catch (error) {
    console.error('❌ 处理飞书OAuth回调异常:', error);
    return createErrorResponse(
      error instanceof Error ? error : new Error('服务器内部错误')
    );
  }
}
