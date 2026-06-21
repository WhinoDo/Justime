'use client'

import { GraduationCap, CalendarDays, BookOpen, BarChart3, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StudyQuickCommandsProps {
  onCommand: (text: string) => void
}

const commands = [
  { icon: CalendarDays, label: '制定学习计划', prompt: '帮我制定一份考研学习计划', color: 'text-blue-300' },
  { icon: BookOpen, label: '查看今日任务', prompt: '今天有哪些学习任务？', color: 'text-emerald-300' },
  { icon: RotateCcw, label: '复习提醒', prompt: '哪些知识点需要复习？', color: 'text-violet-300' },
  { icon: BarChart3, label: '进度分析', prompt: '分析一下我的学习进度', color: 'text-purple-300' },
]

export function StudyQuickCommands({ onCommand }: StudyQuickCommandsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-white/40">
        <GraduationCap className="h-4 w-4" />
        <span className="text-xs font-medium">考研学习快捷指令</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {commands.map((cmd, i) => (
          <button
            key={i}
            onClick={() => onCommand(cmd.prompt)}
            className={cn(
              'flex items-center gap-2 p-2.5 rounded-xl border text-left',
              'bg-white/5 border-white/10',
              'hover:bg-white/10 hover:border-white/20',
              'transition-all duration-200'
            )}
          >
            <cmd.icon className={cn('h-4 w-4 flex-shrink-0', cmd.color)} />
            <span className="text-xs text-white/60">{cmd.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
