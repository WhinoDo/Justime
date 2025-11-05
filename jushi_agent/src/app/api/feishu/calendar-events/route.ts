/**
 * 飞书日历事件API
 * 获取指定日历的事件列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeishuBusiness } from '@/backend/business/feishu-business';
import { createErrorResponse, createSuccessResponse } from '@/backend/core/exceptions';

export async function GET(request: NextRequest) {
  try {
    console.log('📅 开始获取飞书日历事件...');
    
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendar_id');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const pageToken = searchParams.get('page_token') || undefined;
    const syncToken = searchParams.get('sync_token') || undefined;
    const startTime = searchParams.get('start_time') || undefined;
    const endTime = searchParams.get('end_time') || undefined;
    const anchorTime = searchParams.get('anchor_time') || undefined;
    
    // 验证必需参数
    if (!calendarId) {
      return createErrorResponse(
        new Error('calendar_id 参数是必需的'),
        { code: 'MISSING_PARAMETER' }
      );
    }
    
    console.log('📤 请求参数:', { 
      calendarId, 
      pageSize, 
      pageToken, 
      syncToken, 
      startTime, 
      endTime, 
      anchorTime 
    });
    
    // 创建业务逻辑实例
    const feishuBusiness = new FeishuBusiness();
    
    // 调用业务逻辑
    const result = await feishuBusiness.getCalendarEvents(
      request,
      calendarId,
      pageSize,
      pageToken,
      syncToken,
      startTime,
      endTime,
      anchorTime
    );
    
    if (result.success) {
      console.log('✅ 飞书日历事件获取成功');
      return createSuccessResponse(result.data, '日历事件获取成功');
    } else {
      console.log('❌ 飞书日历事件获取失败:', result.error);
      return createErrorResponse(
        new Error(result.error || '获取日历事件失败'),
        { code: result.code }
      );
    }
    
  } catch (error) {
    console.error('❌ 获取飞书日历事件异常:', error);
    return createErrorResponse(
      error instanceof Error ? error : new Error('服务器内部错误')
    );
  }
}
