import { NextResponse } from 'next/server'

function isSecureCookie() {
  return process.env.NODE_ENV === 'production'
}

export function setAuthCookies(
  response: NextResponse,
  options: {
    accessToken?: string | null
    refreshToken?: string | null
    rememberMe?: boolean
  }
) {
  const { accessToken, refreshToken, rememberMe = false } = options
  const accessMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60
  const refreshMaxAge = 30 * 24 * 60 * 60

  if (accessToken) {
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: 'lax',
      maxAge: accessMaxAge,
      path: '/'
    })
  }

  if (refreshToken) {
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: 'lax',
      maxAge: refreshMaxAge,
      path: '/'
    })
  }

  return response
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set('access_token', '', {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })

  return response
}
