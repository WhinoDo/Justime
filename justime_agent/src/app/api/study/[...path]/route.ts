import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy'

function backendPath(request: NextRequest) {
  const path = request.nextUrl.pathname.replace('/api/study/', '')
  return `/study/${path}`
}

export async function GET(request: NextRequest) {
  return proxyToBackend(request, backendPath(request))
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      return proxyToBackend(request, backendPath(request), { method: 'POST' })
    }
    const body = await request.json()
    return proxyToBackend(request, backendPath(request), { method: 'POST', body })
  } catch {
    return proxyToBackend(request, backendPath(request), { method: 'POST' })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    return proxyToBackend(request, backendPath(request), { method: 'PUT', body })
  } catch {
    return proxyToBackend(request, backendPath(request), { method: 'PUT' })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    return proxyToBackend(request, backendPath(request), { method: 'PATCH', body })
  } catch {
    return proxyToBackend(request, backendPath(request), { method: 'PATCH' })
  }
}

export async function DELETE(request: NextRequest) {
  return proxyToBackend(request, backendPath(request), { method: 'DELETE' })
}
