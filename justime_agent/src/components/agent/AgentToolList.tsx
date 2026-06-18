'use client'

import { Wrench, Loader2 } from 'lucide-react'
import type { AgentToolInfo } from '@/types/agent'

interface AgentToolListProps {
  tools: AgentToolInfo[] | null
  loading: boolean
  error: string | null
}

export function AgentToolList({ tools, loading, error }: AgentToolListProps) {
  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/20 rounded w-1/4" />
          <div className="h-10 bg-white/20 rounded" />
          <div className="h-10 bg-white/20 rounded" />
          <div className="h-10 bg-white/20 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4">可用工具</h3>

      {error ? (
        <div className="text-red-300 text-sm">{error}</div>
      ) : tools && tools.length > 0 ? (
        <div className="space-y-2">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Wrench className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium text-sm">{tool.name}</p>
                <p className="text-white/50 text-xs mt-0.5">{tool.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-white/50 text-sm">暂无可用工具</p>
      )}
    </div>
  )
}
