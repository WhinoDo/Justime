import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace('/api/study/', '')
  const backendPath = `/study/${path}`
  return proxyToBackend(request, backendPath)
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname.replace('/api/study/', '')
  const backendPath = `/study/${path}`
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      return proxyToBackend(request, backendPath, { method: 'POST' })
    }
    const body = await request.json()
    return proxyToBackend(request, backendPath, { method: 'POST', body })
  } catch {
    return proxyToBackend(request, backendPath, { method: 'POST' })
  }
}

export async function PUT(request: NextRequest) {
  const path = request.nextUrl.pathname.replace('/api/study/', '')
  const backendPath = `/study/${path}`
  try {
    const body = await request.json()
    return proxyToBackend(request, backendPath, { method: 'PUT', body })
  } catch {
    return proxyToBackend(request, backendPath, { method: 'PUT' })
  }
}

export async function PATCH(request: NextRequest) {
  const path = request.nextUrl.pathname.replace('/api/study/', '')
  const backendPath = `/study/${path}`
  try {
    const body = await request.json()
    return proxyToBackend(request, backendPath, { method: 'PATCH', body })
  } catch {
    return proxyToBackend(request, backendPath, { method: 'PATCH' })
  }
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.pathname.replace('/api/study/', '')
  const backendPath = `/study/${path}`
  return proxyToBackend(request, backendPath, { method: 'DELETE' })
}
