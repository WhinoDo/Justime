import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  return proxyToBackend(request, `/book-analysis/${path}`)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  return proxyToBackend(request, `/book-analysis/${path}`)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  return proxyToBackend(request, `/book-analysis/${path}`)
}
