/**
 * 飞书应用身份令牌API
 * 获取飞书应用的tenant_access_token
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeishuBusiness } from '@/backend/business/feishu-business';
import { createErrorResponse, createSuccessResponse } from '@/backend/core/exceptions';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 开始获取飞书 tenant_access_token...');
    
    // 创建业务逻辑实例
    const feishuBusiness = new FeishuBusiness();
    
    // 调用业务逻辑
    const result = await feishuBusiness.getTenantToken();
    
    if (result.success) {
      console.log('✅ 飞书 tenant_access_token 获取成功');
      return createSuccessResponse(result.data, '应用令牌获取成功');
    } else {
      console.log('❌ 飞书 tenant_access_token 获取失败:', result.error);
      return createErrorResponse(
        new Error(result.error || '获取应用令牌失败'),
        { code: result.code }
      );
    }
    
  } catch (error) {
    console.error('❌ 获取飞书 tenant_access_token 异常:', error);
    return createErrorResponse(
      error instanceof Error ? error : new Error('服务器内部错误')
    );
  }
}
