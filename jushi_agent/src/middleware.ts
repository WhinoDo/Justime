import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const token = request.cookies.get('access_token')?.value
  const isAuthenticated = !!token

  const isProtectedRoute = protectedRoutes.some((route) => isRouteMatched(pathname, route))
  const isPublicOnlyRoute = publicOnlyRoutes.some((route) => isRouteMatched(pathname, route))

  if (!isAuthenticated && isProtectedRoute) {
    const redirectUrl = new URL('/auth', request.url)
    redirectUrl.searchParams.set('mode', 'login')
    redirectUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }

  if (isAuthenticated && isPublicOnlyRoute) {
    const redirectPath = getSafeRedirectPath(searchParams.get('redirect'))
    return NextResponse.redirect(new URL(redirectPath, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
}
