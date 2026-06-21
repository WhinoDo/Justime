// 云 RAG 知识库类型定义
// 与后端 JUS-436 云 RAG 契约一致

/** 知识库同步（云端 RAG 同步）任务状态 */
export type KnowledgeSyncTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 云知识库服务状态（包括降级态） */
export type KnowledgeServiceStatus = 'available' | 'disabled' | 'unavailable'

/** 知识库文档 */
export interface KnowledgeDocument {
  name: string
  size: number
  modified: number
}

/** 知识库列表响应 */
export interface KnowledgeListResponse {
  success: boolean
  files: KnowledgeDocument[]
}

/** 同步到云端 RAG 的响应 */
export interface KnowledgeSyncResponse {
  success: boolean
  message: string
  task_id: string
  status_endpoint: string
}

/** 同步任务状态响应 */
export interface KnowledgeSyncStatusResponse {
  success: boolean
  task_id: string
  status: KnowledgeSyncTaskStatus
  message?: string
  created_at?: number
  started_at?: number | null
  completed_at?: number | null
  error?: string | null
}

/** 文档上传响应 */
export interface KnowledgeUploadResponse {
  success: boolean
  message: string
  filename: string
  size: number
}

/** 文档预览内容响应 */
export interface KnowledgeContentResponse {
  success: boolean
  path: string
  fileName: string
  content: string
  truncated: boolean
  charCount: number
  maxChars: number
}

/** 文档删除响应 */
export interface KnowledgeDeleteResponse {
  success: boolean
  message: string
}

/** 分片上传初始化响应 */
export interface KnowledgeChunkedInitResponse {
  success: boolean
  upload_id: string
  total_chunks: number
  chunk_size: number
  total_size: number
}

/** 分片上传状态响应 */
export interface KnowledgeChunkedStatusResponse {
  success: boolean
  upload_id: string
  filename?: string
  total_size?: number
  chunk_size?: number
  total_chunks: number
  uploaded_chunks: number
  progress: number
  status: string
  created_at?: number
  updated_at?: number
}

/** 分片上传完成响应 */
export interface KnowledgeChunkedCompleteResponse {
  success: boolean
  message: string
  filename: string
  size: number
}

/** 知识库通用错误响应（含降级态） */
export interface KnowledgeErrorResponse {
  success: false
  error?: string
  detail?: string
  service_status?: KnowledgeServiceStatus
}
