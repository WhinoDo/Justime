import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, decodeJwt } from 'jose'

const protectedRoutes = [
  '/dashboard',
  '/chat',
  '/admin',
  '/profile',
  '/knowledge',
  '/calendar',
  '/model-config',
]

const publicOnlyRoutes = ['/auth']

function isRouteMatched(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function getSafeRedirectPath(pathname: string | null): string {
  if (!pathname) return '/dashboard'
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/dashboard'
  return pathname
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('JWT_SECRET is not configured')
      return false
    }

    const secretKey = new TextEncoder().encode(secret)
    await jwtVerify(token, secretKey)
    return true
  } catch {
    return false
  }
}

function decodeTokenExpiry(token: string): number | null {
  try {
    const payload = decodeJwt(token)
    return payload.exp ?? null
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const exp = decodeTokenExpiry(token)
  if (!exp) return true
  return Date.now() >= exp * 1000
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const token = request.cookies.get('access_token')?.value

  const isProtectedRoute = protectedRoutes.some((route) => isRouteMatched(pathname, route))
  const isPublicOnlyRoute = publicOnlyRoutes.some((route) => isRouteMatched(pathname, route))

  if (isProtectedRoute) {
    if (!token) {
      const redirectUrl = new URL('/auth', request.url)
      redirectUrl.searchParams.set('mode', 'login')
      redirectUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
      return NextResponse.redirect(redirectUrl)
    }

    if (isTokenExpired(token)) {
      const response = NextResponse.redirect(new URL('/auth?mode=login', request.url))
      response.cookies.delete('access_token')
      response.cookies.delete('refresh-token')
      return response
    }

    const isValid = await verifyToken(token)
    if (!isValid) {
      const response = NextResponse.redirect(new URL('/auth?mode=login', request.url))
      response.cookies.delete('access_token')
      response.cookies.delete('refresh-token')
      return response
    }
  }

  if (token && isPublicOnlyRoute) {
    if (!isTokenExpired(token) && await verifyToken(token)) {
      const redirectPath = getSafeRedirectPath(searchParams.get('redirect'))
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
}
