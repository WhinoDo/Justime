/**
 * 日历事件API
 * GET - 获取事件列表
 * POST - 创建新事件
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/database/mongodb'
import CalendarEvent, { EventType, EventPriority, EventStatus } from '@/lib/database/models/CalendarEvent'

// GET - 获取事件列表
export async function GET(request: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      )
    }

    let events

    // 按日期范围查询
    if (startDate && endDate) {
      events = await CalendarEvent.findByDateRange(
        userId,
        new Date(startDate),
        new Date(endDate)
      )
    }
    // 按类型查询
    else if (type) {
      events = await CalendarEvent.findByType(userId, type as EventType)
    }
    // 获取所有事件
    else {
      events = await CalendarEvent.findByUserId(userId)
    }

    return NextResponse.json({
      success: true,
      data: { events }
    })

  } catch (error) {
    console.error('获取日历事件失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取事件失败'
      },
      { status: 500 }
    )
  }
}

// POST - 创建新事件
export async function POST(request: NextRequest) {
  try {
    await connectDB()

    const body = await request.json()
    const {
      userId,
      title,
      description,
      start,
      end,
      allDay = false,
      type = EventType.OTHER,
      priority = EventPriority.MEDIUM,
      status = EventStatus.PENDING,
      color,
      location,
      reminders,
      emotionScore,
      aiGenerated = false,
      taskId,
      resources
    } = body

    // 验证必需字段
    if (!userId || !title || !start || !end) {
      return NextResponse.json(
        { success: false, error: '缺少必需字段' },
        { status: 400 }
      )
    }

    // 验证时间
    const startDate = new Date(start)
    const endDate = new Date(end)

    if (startDate >= endDate) {
      return NextResponse.json(
        { success: false, error: '结束时间必须晚于开始时间' },
        { status: 400 }
      )
    }

    // 创建事件
    const event = await CalendarEvent.create({
      userId,
      title,
      description,
      start: startDate,
      end: endDate,
      allDay,
      type,
      priority,
      status,
      color,
      location,
      reminders,
      emotionScore,
      aiGenerated,
      taskId,
      resources
    })

    return NextResponse.json({
      success: true,
      data: { event },
      message: '事件创建成功'
    })

  } catch (error) {
    console.error('创建日历事件失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建事件失败'
      },
      { status: 500 }
    )
  }
}
