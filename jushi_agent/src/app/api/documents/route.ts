/**
 * 工作文档API
 * GET - 获取文档内容
 * POST - 保存文档内容
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/database/mongodb'
import WorkDocument from '@/lib/database/models/WorkDocument'
import CalendarEvent from '@/lib/database/models/CalendarEvent'

// GET - 获取文档
export async function GET(request: NextRequest) {
    try {
        await connectDB()

        const { searchParams } = new URL(request.url)
        const eventId = searchParams.get('eventId')
        const userId = searchParams.get('userId')

        if (!eventId || !userId) {
            return NextResponse.json(
                { success: false, error: '缺少必需参数' },
                { status: 400 }
            )
        }

        // 验证事件所有权
        const event = await CalendarEvent.findOne({ _id: eventId, userId })
        if (!event) {
            return NextResponse.json(
                { success: false, error: '未找到相关日程或无权访问' },
                { status: 404 }
            )
        }

        // 查找文档
        const document = await WorkDocument.findOne({ eventId, userId })

        return NextResponse.json({
            success: true,
            data: {
                document: document || {
                    eventId,
                    userId,
                    content: '',
                    version: 0
                }
            }
        })

    } catch (error) {
        console.error('获取文档失败:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '获取文档失败'
            },
            { status: 500 }
        )
    }
}

// POST - 保存文档
export async function POST(request: NextRequest) {
    try {
        await connectDB()

        const body = await request.json()
        const { userId, eventId, content } = body

        if (!userId || !eventId) {
            return NextResponse.json(
                { success: false, error: '缺少必需字段' },
                { status: 400 }
            )
        }

        // 验证事件所有权
        const event = await CalendarEvent.findOne({ _id: eventId, userId })
        if (!event) {
            return NextResponse.json(
                { success: false, error: '未找到相关日程或无权访问' },
                { status: 404 }
            )
        }

        // 更新或创建文档
        const document = await WorkDocument.findOneAndUpdate(
            { eventId, userId },
            {
                $set: { content, lastSavedAt: new Date() },
                $inc: { version: 1 }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )

        return NextResponse.json({
            success: true,
            data: { document },
            message: '文档保存成功'
        })

    } catch (error) {
        console.error('保存文档失败:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '保存文档失败'
            },
            { status: 500 }
        )
    }
}
