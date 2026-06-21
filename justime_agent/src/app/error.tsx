'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <JustimePageShell blur="xl" contentClassName="flex items-center justify-center px-4">
      <JustimeGlassPanel className="max-w-md rounded-3xl px-8 py-10 text-center">
        <div className="space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">出错了</h2>
            <p className="text-sm text-muted-foreground">
              {error.message || '发生了未知错误，请稍后重试'}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => reset()}
              className="h-11 bg-foreground text-background hover:bg-foreground/90 rounded-xl font-semibold"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              重试
            </Button>

            <Link href="/">
              <Button
                variant="outline"
                className="h-11 w-full bg-muted/30 border-border text-foreground hover:bg-accent/50 hover:border-ring hover:text-foreground rounded-xl"
              >
                <Home className="mr-2 h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>
        </div>
      </JustimeGlassPanel>
    </JustimePageShell>
  )
}