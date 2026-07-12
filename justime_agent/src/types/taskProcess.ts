export type TaskStatus = 'draft' | 'planned' | 'active' | 'paused' | 'blocked' | 'completed' | 'archived'
export type TaskPhase = 'before' | 'during' | 'after'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskCategory = 'learning' | 'development' | 'writing' | 'research' | 'reading' | 'project' | 'practice' | 'other'
export type ProgressSource = 'manual' | 'ai' | 'evidence'
export type EvidenceType = 'note' | 'file' | 'chat' | 'code_commit' | 'link' | 'time_log' | 'quiz_result' | 'review' | 'milestone_complete' | 'manual'
export type KnowledgeFormat = 'summary' | 'tutorial' | 'faq' | 'cheatsheet' | 'debug_log' | 'mindmap' | 'glossary' | 'timeline' | 'comparison' | 'review' | 'notes'

export interface Milestone {
  id: string
  title: string
  description: string
  order: number
  status: 'pending' | 'active' | 'completed' | 'skipped'
  target_date?: string | null
  completed_at?: string | null
}

export interface LearningMaterial {
  title: string
  url?: string | null
  summary: string
  source: string
}

export interface PreparationItem {
  id: string
  title: string
  done: boolean
  order: number
}

export interface Blocker {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high'
  resolved: boolean
  resolution?: string | null
  created_at: string
  resolved_at?: string | null
}

export interface AISuggestion {
  id: string
  type: 'next_step' | 'resource' | 'review' | 'alert' | 'optimization'
  content: string
  accepted?: boolean | null
  created_at: string
}

export interface AIAssessment {
  progress: number
  confidence: number
  summary: string
  blockers_identified: string[]
  next_steps: string[]
  assessed_at: string
}

export interface TaskProcess {
  id: string
  userId: string
  title: string
  description: string
  goal: string
  category: TaskCategory
  tags: string[]
  status: TaskStatus
  phase: TaskPhase
  priority: TaskPriority
  progress: number
  progress_source: ProgressSource
  estimated_hours?: number | null
  actual_hours: number
  started_at?: string | null
  completed_at?: string | null
  deadline?: string | null
  materials?: LearningMaterial[]
  preparation_items?: PreparationItem[]
  milestones: Milestone[]
  blockers: Blocker[]
  ai_suggestions: AISuggestion[]
  ai_last_assessment?: AIAssessment | null
  ai_plan?: Record<string, unknown> | null
  parent_task_id?: string | null
  related_chat_session_ids: string[]
  related_calendar_event_ids: string[]
  evidence_count: number
  knowledge_output_count: number
  createdAt?: string | null
  updatedAt?: string | null
}

export interface Evidence {
  id: string
  task_id: string
  userId: string
  type: EvidenceType
  title: string
  content: string
  source: string
  milestone_id?: string | null
  metadata?: Record<string, unknown> | null
  ai_extracted: boolean
  sentiment?: 'positive' | 'neutral' | 'negative' | 'blocked' | null
  confidence: number
  createdAt?: string | null
  updatedAt?: string | null
}

export interface KnowledgeOutput {
  id: string
  task_id: string
  userId: string
  title: string
  format: KnowledgeFormat
  markdown: string
  vault_relative_path: string
  obsidian_tags: string[]
  obsidian_links: string[]
  status: 'draft' | 'reviewed' | 'published' | 'archived'
  source_evidence_ids: string[]
  absolute_path?: string | null
  published_at?: string | null
  word_count: number
  version: number
  previous_version_id?: string | null
  version_history?: KnowledgeOutputVersion[]
  createdAt?: string | null
  updatedAt?: string | null
}

export interface KnowledgeOutputVersion {
  version: number
  title: string
  markdown: string
  vault_relative_path: string
  status: KnowledgeOutput['status']
  updated_at: string
  published_at?: string | null
}

export interface VaultConfig {
  vault_root_path: string
  auto_publish: boolean
  default_category_mapping: Record<string, string>
  frontmatter_template?: Record<string, unknown>
}

export interface TaskProcessCreatePayload {
  title: string
  description: string
  goal: string
  category: TaskCategory
  tags: string[]
  priority: TaskPriority
  estimated_hours?: number | null
  deadline?: string | null
  auto_plan?: boolean
}

export interface TaskProcessUpdatePayload {
  title?: string
  description?: string
  goal?: string
  category?: TaskCategory
  tags?: string[]
  status?: TaskStatus
  phase?: TaskPhase
  priority?: TaskPriority
  progress?: number
  estimated_hours?: number | null
  deadline?: string | null
  preparation_items?: PreparationItem[]
}

export interface EvidenceCreatePayload {
  task_id: string
  type: EvidenceType
  title: string
  content: string
  source: string
  milestone_id?: string | null
  metadata?: Record<string, unknown> | null
}

export interface TimeLogCreatePayload {
  task_id: string
  hours: number
  date?: string | null
  notes: string
  milestone_id?: string | null
}

export interface GenerateKnowledgePayload {
  task_id: string
  format: KnowledgeFormat
  additional_instructions?: string
  include_evidence_ids?: string[]
}

export interface KnowledgeOutputUpdatePayload {
  title?: string
  markdown?: string
  format?: KnowledgeFormat
  status?: KnowledgeOutput['status']
  vault_relative_path?: string
  obsidian_tags?: string[]
  obsidian_links?: string[]
}

export interface KnowledgeRollbackPayload {
  version: number
}
