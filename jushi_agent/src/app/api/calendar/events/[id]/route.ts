/**
 * 单个日历事件API
 * GET - 获取事件详情
 * PUT - 更新事件
 * DELETE - 删除事件
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/database/mongodb'
import CalendarEvent from '@/lib/database/models/CalendarEvent'

// GET - 获取事件详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()

    const event = await CalendarEvent.findById(params.id)

    if (!event) {
      return NextResponse.json(
        { success: false, error: '事件不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { event }
    })

  } catch (error) {
    console.error('获取事件详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取事件失败' },
      { status: 500 }
    )
  }
}

// PUT - 更新事件
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()

    const body = await request.json()
    const { start, end, ...updateData } = body

    // 如果更新时间，验证时间有效性
    if (start && end) {
      const startDate = new Date(start)
      const endDate = new Date(end)
      
      if (startDate >= endDate) {
        return NextResponse.json(
          { success: false, error: '结束时间必须晚于开始时间' },
          { status: 400 }
        )
      }
      
      updateData.start = startDate
      updateData.end = endDate
    }

    const event = await CalendarEvent.findByIdAndUpdate(
      params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )

    if (!event) {
      return NextResponse.json(
        { success: false, error: '事件不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { event },
      message: '事件更新成功'
    })

  } catch (error) {
    console.error('更新事件失败:', error)
    return NextResponse.json(
      { success: false, error: '更新事件失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除事件
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()

    const event = await CalendarEvent.findByIdAndDelete(params.id)

    if (!event) {
      return NextResponse.json(
        { success: false, error: '事件不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '事件删除成功'
    })

  } catch (error) {
    console.error('删除事件失败:', error)
    return NextResponse.json(
      { success: false, error: '删除事件失败' },
      { status: 500 }
    )
  }
}
