'use client'

import { CheckCircle2, XCircle, Cpu, Wrench } from 'lucide-react'
import type { AgentStatusResponse } from '@/types/agent'

interface AgentStatusCardProps {
  status: AgentStatusResponse | null
  loading: boolean
  error: string | null
}

export function AgentStatusCard({ status, loading, error }: AgentStatusCardProps) {
  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/20 rounded w-1/3" />
          <div className="h-8 bg-white/20 rounded w-1/2" />
          <div className="h-4 bg-white/20 rounded w-2/3" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4">Agent 服务状态</h3>

      {error ? (
        <div className="text-red-300 text-sm">{error}</div>
      ) : status ? (
        <div className="space-y-4">
          {/* 可用性 */}
          <div className="flex items-center gap-3">
            {status.available ? (
              <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400 shrink-0" />
            )}
            <div>
              <p className="text-white font-medium">
                {status.available ? '服务正常' : '服务不可用'}
              </p>
              <p className="text-white/60 text-sm">{status.message}</p>
            </div>
          </div>

          {/* 当前模型 */}
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-white/70 text-sm">当前模型</p>
              <p className="text-white font-medium">{status.model || '未配置'}</p>
            </div>
          </div>

          {/* 工具数量 */}
          <div className="flex items-center gap-3">
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-white/70 text-sm">可用工具</p>
              <p className="text-white font-medium">{status.tools_count} 个</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-white/50 text-sm">暂无数据</p>
      )}
    </div>
  )
}
