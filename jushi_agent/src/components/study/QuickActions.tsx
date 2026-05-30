'use client'

import Link from 'next/link'
import { CalendarPlus, Upload, BarChart3, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAction {
  icon: typeof CalendarPlus
  label: string
  href: string
  color: string
  bgColor: string
}

const actions: QuickAction[] = [
  {
    icon: CalendarPlus,
    label: '制定计划',
    href: '/plan',
    color: 'text-blue-300',
    bgColor: 'bg-blue-500/20',
  },
  {
    icon: Upload,
    label: '上传资料',
    href: '/materials',
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-500/20',
  },
  {
    icon: BarChart3,
    label: '查看进度',
    href: '/progress',
    color: 'text-amber-300',
    bgColor: 'bg-amber-500/20',
  },
  {
    icon: MessageSquare,
    label: '学习助手',
    href: '/chat?mode=study',
    color: 'text-purple-300',
    bgColor: 'bg-purple-500/20',
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((action, i) => (
        <Link
          key={i}
          href={action.href}
          className={cn(
            'flex flex-col items-center gap-2 p-3 rounded-2xl border',
            'bg-white/5 border-white/10',
            'hover:bg-white/10 hover:border-white/20',
            'transition-all duration-200'
          )}
        >
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', action.bgColor)}>
            <action.icon className={cn('h-5 w-5', action.color)} />
          </div>
          <span className="text-xs text-white/60">{action.label}</span>
        </Link>
      ))}
    </div>
  )
}
