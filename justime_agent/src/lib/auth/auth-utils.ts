/**
 * 认证工具函数
 * 用于从JWT token中提取用户身份，防止客户端伪造userId
 */

import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { TokenPayload } from '@/types/auth'

export function getCurrentUserId(request: NextRequest): string | null {
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

export function requireAuth(request: NextRequest): { userId: string } | { error: string } {
    const userId = getCurrentUserId(request)
    if (!userId) {
        return { error: '请先登录' }
    }
    return { userId }
}
