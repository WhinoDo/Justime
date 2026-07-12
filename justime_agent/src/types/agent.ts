/**
 * Agent 相关 TypeScript 类型定义
 * 对应 justime_backend/app/models/agent.py 中的 Pydantic 模型
 */

/** 工具信息 */
export interface AgentToolInfo {
  name: string
  description: string
}

/** Agent 状态响应 */
export interface AgentStatusResponse {
  available: boolean
  model: string | null
  tools_count: number
  message: string
}

/** Agent 执行步骤 */
export interface AgentStep {
  step_number: number
  thought: string | null
  action: string | null
  observation: string | null
}

/** Agent 执行请求 */
export interface AgentRunRequest {
  task: string
  tools?: string[]
  max_steps?: number
  provider?: string
}

/** Agent 执行响应 */
export interface AgentRunResponse {
  success: boolean
  result: unknown
  steps: AgentStep[] | null
  error: string | null
  provider: string | null
}

/** LLM 提供者信息 */
export interface LLMProviderInfo {
  name: string
  model_id: string
  available: boolean
}

/** Agent 提供者列表响应 */
export interface AgentProvidersResponse {
  success: boolean
  providers: LLMProviderInfo[]
  default_provider: string
}

/** Agent 工具列表响应 */
export interface AgentToolsResponse {
  success: boolean
  tools: AgentToolInfo[]
}
