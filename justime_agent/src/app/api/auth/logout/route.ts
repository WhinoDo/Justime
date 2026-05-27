/**
 * 用户登出API
 */

import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookies } from '@/lib/api/auth-cookies'

/**
 * 用户登出
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: '登出成功'
    })

    return clearAuthCookies(response)

  } catch (error) {
    console.error('❌ 登出API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
}
