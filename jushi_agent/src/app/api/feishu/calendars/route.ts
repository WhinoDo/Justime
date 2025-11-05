/**
 * 飞书日历列表API
 * 获取用户的飞书日历列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeishuBusiness } from '@/backend/business/feishu-business';
import { createErrorResponse, createSuccessResponse } from '@/backend/core/exceptions';

export async function GET(request: NextRequest) {
  try {
    console.log('📅 开始获取飞书日历列表...');
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const pageToken = searchParams.get('page_token') || undefined;
    const syncToken = searchParams.get('sync_token') || undefined;
    
    console.log('📤 请求参数:', { pageSize, pageToken, syncToken });
    
    // 创建业务逻辑实例
    const feishuBusiness = new FeishuBusiness();
    
    // 调用业务逻辑
    const result = await feishuBusiness.getCalendars(
      request,
      pageSize,
      pageToken,
      syncToken
    );
    
    if (result.success) {
      console.log('✅ 飞书日历列表获取成功');
      return createSuccessResponse(result.data, '日历列表获取成功');
    } else {
      console.log('❌ 飞书日历列表获取失败:', result.error);
      return createErrorResponse(
        new Error(result.error || '获取日历列表失败'),
        { code: result.code }
      );
    }
    
  } catch (error) {
    console.error('❌ 获取飞书日历列表异常:', error);
    return createErrorResponse(
      error instanceof Error ? error : new Error('服务器内部错误')
    );
  }
}
