'use client'

import { CheckCircle2, XCircle, Server } from 'lucide-react'
import type { LLMProviderInfo } from '@/types/agent'

interface AgentProviderListProps {
  providers: LLMProviderInfo[] | null
  defaultProvider: string | null
  loading: boolean
  error: string | null
}

export function AgentProviderList({ providers, defaultProvider, loading, error }: AgentProviderListProps) {
  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/20 rounded w-1/4" />
          <div className="h-10 bg-white/20 rounded" />
          <div className="h-10 bg-white/20 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4">LLM 提供者</h3>

      {error ? (
        <div className="text-red-300 text-sm">{error}</div>
      ) : providers && providers.length > 0 ? (
        <div className="space-y-2">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              {provider.available ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm truncate">{provider.name}</p>
                  {provider.name === defaultProvider && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                      默认
                    </span>
                  )}
                </div>
                <p className="text-white/50 text-xs truncate">{provider.model_id}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-white/50 text-sm">暂无可用提供者</p>
      )}
    </div>
  )
}
