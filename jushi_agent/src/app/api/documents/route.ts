/**
 * 工作文档API
 * GET - 获取文档内容
 * POST - 保存文档内容
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/database/mongodb'
import WorkDocument from '@/lib/database/models/WorkDocument'
import CalendarEvent from '@/lib/database/models/CalendarEvent'
import { TokenPayload } from '@/types/auth'
import { createErrorResponse } from '@/lib/api/proxy'
import jwt from 'jsonwebtoken'

function getCurrentUserId(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization')
    const cookieToken = request.cookies.get('access_token')?.value

    let token = cookieToken

    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice('Bearer '.length)
    }

    if (!token) {
        return null
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
        console.error('JWT_SECRET environment variable is not set')
        return null
    }

    try {
        const normalizedToken = decodeURIComponent(token).replace(/^Bearer\s+/i, '')
        const payload = jwt.verify(normalizedToken, jwtSecret) as TokenPayload
        return payload?.userId || null
    } catch {
        return null
    }
}

// GET - 获取文档
export async function GET(request: NextRequest) {
    try {
        const userId = getCurrentUserId(request)
        if (!userId) {
            return createErrorResponse('未登录', 'AUTHENTICATION_ERROR', 401)
        }

        await connectDB()

        const { searchParams } = new URL(request.url)
        const eventId = searchParams.get('eventId')

        if (!eventId) {
            return createErrorResponse('缺少必需参数 eventId', 'VALIDATION_ERROR', 400)
        }

        const event = await CalendarEvent.findOne({ _id: eventId, userId })
        if (!event) {
            return createErrorResponse('未找到相关日程或无权访问', 'NOT_FOUND', 404)
        }

        const document = await WorkDocument.findOne({ eventId, userId })

        return NextResponse.json({
            success: true,
            data: {
                document: document || {
                    eventId,
                    userId,
                    content: '',
                    version: 0,
                },
            },
        })
    } catch (error) {
        return createErrorResponse(
            error instanceof Error ? error.message : '获取文档失败',
            'INTERNAL_ERROR',
            500
        )
    }
}

// POST - 保存文档
export async function POST(request: NextRequest) {
    try {
        const userId = getCurrentUserId(request)
        if (!userId) {
            return createErrorResponse('未登录', 'AUTHENTICATION_ERROR', 401)
        }

        await connectDB()

        const body = await request.json()
        const payload = { ...body }
        delete payload.userId

        const { eventId, content } = payload

        if (!eventId) {
            return createErrorResponse('缺少必需字段 eventId', 'VALIDATION_ERROR', 400)
        }

        const event = await CalendarEvent.findOne({ _id: eventId, userId })
        if (!event) {
            return createErrorResponse('未找到相关日程或无权访问', 'NOT_FOUND', 404)
        }

        const document = await WorkDocument.findOneAndUpdate(
            { eventId, userId },
            {
                $set: { content, lastSavedAt: new Date() },
                $inc: { version: 1 },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )

        return NextResponse.json({
            success: true,
            data: { document },
            message: '文档保存成功',
        })
    } catch (error) {
        return createErrorResponse(
            error instanceof Error ? error.message : '保存文档失败',
            'INTERNAL_ERROR',
            500
        )
    }
}
