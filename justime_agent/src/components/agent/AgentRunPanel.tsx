'use client'

import { useState } from 'react'
import { Send, Loader2, Terminal, ChevronDown, ChevronRight } from 'lucide-react'
import type { AgentRunResponse, AgentStep } from '@/types/agent'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

interface AgentRunPanelProps {
  providers: { name: string }[] | null
}

function renderResult(value: unknown): string {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

export function AgentRunPanel({ providers }: AgentRunPanelProps) {
  const [task, setTask] = useState('')
  const [provider, setProvider] = useState('')
  const [maxSteps, setMaxSteps] = useState(10)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AgentRunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState(false)

  const handleRun = async () => {
    if (!task.trim()) return

    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(API_ENDPOINTS.AGENT.RUN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: task.trim(),
          ...(provider ? { provider } : {}),
          max_steps: maxSteps,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || json.message || '任务执行失败')
      }

      setResult(json.data || json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '任务执行失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4">执行 Agent 任务</h3>

      {/* 任务输入 */}
      <div className="space-y-3">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="请输入任务描述..."
          rows={4}
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-sm"
          disabled={running}
        />

        <div className="flex flex-wrap gap-3">
          {/* 提供者选择 */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-white/60 mb-1">LLM 提供者（可选）</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              disabled={running}
            >
              <option value="">默认提供者</option>
              {providers?.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 最大步数 */}
          <div className="w-24">
            <label className="block text-xs text-white/60 mb-1">最大步数</label>
            <input
              type="number"
              value={maxSteps}
              onChange={(e) => setMaxSteps(Math.max(1, Math.min(100, Number(e.target.value) || 10)))}
              min={1}
              max={100}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              disabled={running}
            />
          </div>
        </div>

        {/* 执行按钮 */}
        <button
          onClick={handleRun}
          disabled={running || !task.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium transition-colors text-sm"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              执行中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              执行任务
            </>
          )}
        </button>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* 执行结果 */}
      {result && (
        <div className="mt-4 space-y-3">
          {/* 结果摘要 */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-sm font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? '执行成功' : '执行失败'}
              </span>
              {result.provider && (
                <span className="text-xs text-white/50">使用提供者: {result.provider}</span>
              )}
            </div>

            {/* 执行结果内容 */}
            {result.result != null && (
              <div className="mt-2">
                <p className="text-xs text-white/60 mb-1">执行结果</p>
                <pre className="text-white text-sm whitespace-pre-wrap font-sans bg-black/20 rounded p-3 max-h-60 overflow-y-auto">
                  {renderResult(result.result)}
                </pre>
              </div>
            )}
          </div>

          {/* 执行步骤 */}
          {result.steps && result.steps.length > 0 && (
            <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
              <button
                onClick={() => setExpandedSteps(!expandedSteps)}
                className="w-full flex items-center justify-between px-4 py-3 text-white/80 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium">执行步骤 ({result.steps.length})</span>
                </div>
                {expandedSteps ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {expandedSteps && (
                <div className="px-4 pb-3 space-y-2">
                  {result.steps.map((step: AgentStep) => (
                    <div
                      key={step.step_number}
                      className="p-3 rounded-lg bg-black/20 border border-white/5"
                    >
                      <p className="text-xs text-blue-300 font-medium mb-1">
                        步骤 {step.step_number}
                      </p>
                      {step.thought && (
                        <p className="text-white/70 text-xs mb-1">
                          <span className="text-white/50">思考:</span> {step.thought}
                        </p>
                      )}
                      {step.action && (
                        <p className="text-white/70 text-xs mb-1">
                          <span className="text-white/50">动作:</span> {step.action}
                        </p>
                      )}
                      {step.observation && (
                        <p className="text-white/70 text-xs">
                          <span className="text-white/50">观察:</span> {step.observation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
