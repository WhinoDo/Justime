// 用户相关类型
export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

// 用户画像类型
export interface UserProfile {
  id: string
  user_id: string
  high_efficiency_hours: string[]
  anxiety_triggers: string[]
  motivation_preference: 'positive_encouragement' | 'data_feedback'
  task_habits: {
    pomodoro_duration: number
    break_preference: number
    max_daily_tasks: number
  }
  created_at: string
  updated_at: string
}

// 情绪分析类型
export interface EmotionAnalysis {
  score: number // 1-10情绪评分
  tags: string[] // 情绪标签
  reasoning: string // 分析理由
}

// 情绪记录类型
export interface EmotionRecord {
  id: string
  user_id: string
  score: number
  emotion_tags: string[]
  context: string
  created_at: string
}

// 对话消息类型
export interface RagReference {
  referenceId: string
  docPath: string
  fileName: string
  score: number
  snippets: string[]
  queries: string[]
}

export interface Message {
  id: string
  user_id: string
  task_id?: string
  role: 'user' | 'assistant'
  content: string
  emotion_score?: number
  created_at: string
  suggestedEvents?: SuggestedCalendarEvent[]
  timingStrategy?: TimingStrategy
  taskAnalysis?: TaskAnalysis
  taskDecomposition?: TaskDecomposition
  multiTaskDecompositions?: TaskDecomposition[]
  ragReferences?: RagReference[]
}

export interface TimingStrategy {
  profileKey: string
  taskType: 'recitation' | 'thinking' | 'general'
  difficultyLevel: number
  urgency: 'low' | 'medium' | 'high'
  interactionDurationSeconds: number
  intervalSeconds: number
  maxSteps: number
  timeoutSeconds: number
  contextWindowMessages: number
  nextSuggestedAt: string
  strategySource: string
  analysisMeta?: TaskAnalysis
}

export interface TaskAnalysis {
  source?: 'llm' | 'heuristic' | string
  confidence?: number
  reason?: string
  taskType?: 'recitation' | 'thinking' | 'general'
  difficultyLevel?: number
  urgency?: 'low' | 'medium' | 'high'
}

export interface TaskDecompositionProject {
  name: string
  description?: string
  total_days?: number
  start_date?: string
  subtask_count?: number
}

export interface TaskDecomposition {
  success?: boolean
  type?: string
  project?: TaskDecompositionProject
  projectTitle?: string
  projectDescription?: string
  subtasks: SubtaskItem[]
  estimatedTotalHours?: number
  confidence?: number
  reasoning?: string
  message?: string
}

export interface SubtaskItem {
  id: string
  title: string
  description?: string
  startTime?: string
  endTime?: string
  duration_hours?: number
  priority?: 'high' | 'medium' | 'low'
  category?: string
  dependencies?: string[]
  order?: number
  resources?: Array<{ title: string; url: string; type?: string }>
}

export interface ModelConfig {
  modelId: string
  name?: string
  enabled?: boolean
  isActive?: boolean
}

export interface MessageFromAPI {
  _id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  taskDecomposition?: TaskDecomposition
  multiTaskDecompositions?: TaskDecomposition[]
  suggestedEvents?: SuggestedCalendarEvent[]
  timingStrategy?: TimingStrategy
  taskAnalysis?: TaskAnalysis
  ragReferences?: RagReference[]
  emotion_score?: number
}

export interface EventConflict {
  eventId: string
  eventTitle: string
  startTime: string
  endTime: string
  overlapMinutes: number
}

export interface SuggestedCalendarEvent {
  _id?: string
  title: string
  description?: string
  start: string
  end: string
  type?: 'task' | 'meeting' | 'reminder' | 'deadline' | 'other'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  location?: string
  allDay?: boolean
  aiGenerated?: boolean
  conflicts?: EventConflict[]
  resources?: Array<{ title: string; url: string; type?: string }>
}

export type { Subject, TaskStatus, TaskType } from './study'
export type {
  StudyProfile,
  StudyPlan,
  PlanPhase,
  StudyTask,
  StudyProgress,
  ReviewSchedule,
  StudyMaterial,
  ProgressStats,
} from './study'
export type {
  TaskProcess,
  Milestone,
  Blocker,
  AISuggestion,
  AIAssessment,
  Evidence,
  KnowledgeOutput,
  VaultConfig,
  TaskPhase,
  TaskPriority,
  TaskCategory,
  ProgressSource,
  KnowledgeFormat,
} from './taskProcess'

// 任务类型
export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  original_input: string
  difficulty_level: number
  status: 'pending' | 'in_progress' | 'completed' | 'paused'
  created_at: string
  updated_at: string
  subtasks?: SubTask[]
}

// 子任务类型
export interface SubTask {
  id: string
  task_id: string
  title: string
  description?: string
  order_index: number
  estimated_minutes: number
  actual_minutes?: number
  status: 'pending' | 'in_progress' | 'completed' | 'paused'
  emotion_score_when_created: number
  created_at: string
  completed_at?: string
}

// 番茄钟会话类型
export interface PomodoroSession {
  id: string
  user_id: string
  subtask_id?: string
  duration_minutes: number
  actual_duration_minutes?: number
  status: 'completed' | 'interrupted' | 'paused'
  started_at: string
  ended_at?: string
}

// 成长笔记类型
export interface GrowthNote {
  id: string
  user_id: string
  task_id?: string
  content: string
  note_type: 'reflection' | 'achievement' | 'insight'
  created_at: string
}

// API响应类型
export interface APIError {
  code: string
  message: string
  details?: string | Record<string, unknown>
}

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: APIError
  timestamp: string
}

// 任务拆解策略类型
export interface DecompositionStrategy {
  type: 'atomic' | 'process-oriented' | 'goal-oriented'
  maxDuration: number
  complexity: 'minimal' | 'moderate' | 'flexible'
  guidance: 'step-by-step' | 'structured' | 'framework'
}

// 任务提取类型
export interface TaskExtraction {
  hasTask: boolean
  taskTitle?: string
  taskDescription?: string
  taskType?: 'study' | 'assignment' | 'project' | 'exam_prep' | 'research' | 'other'
  urgency?: 'low' | 'medium' | 'high'
  estimatedDuration?: string
  requirements?: string[]
  reasoning?: string
}

// Chat API 请求/响应类型
export interface ChatRequest {
  message: string
  taskId?: string
  emotionScore?: number
  sessionId?: string
  useWebSearch?: boolean
  useOpenClaw?: boolean
  taskType?: 'recitation' | 'thinking' | 'general'
  difficultyLevel?: 1 | 2 | 3 | 4 | 5
  urgency?: 'low' | 'medium' | 'high'
}

export interface ChatResponse {
  response: string
  emotionScore: number
  emotionTags: string[]
  needsEmotionInput?: boolean
  sessionId?: string
  timingStrategy?: {
    profileKey: string
    taskType: 'recitation' | 'thinking' | 'general'
    difficultyLevel: number
    urgency: 'low' | 'medium' | 'high'
    interactionDurationSeconds: number
    intervalSeconds: number
    maxSteps: number
    timeoutSeconds: number
    contextWindowMessages: number
    nextSuggestedAt: string
    strategySource: string
    analysisMeta?: {
      source?: 'llm' | 'heuristic' | string
      confidence?: number
      reason?: string
      taskType?: 'recitation' | 'thinking' | 'general'
      difficultyLevel?: number
      urgency?: 'low' | 'medium' | 'high'
    }
  }
  taskAnalysis?: {
    source?: 'llm' | 'heuristic' | string
    confidence?: number
    reason?: string
    taskType?: 'recitation' | 'thinking' | 'general'
    difficultyLevel?: number
    urgency?: 'low' | 'medium' | 'high'
  }
  suggestedActions?: string[]
  task?: Task
  taskExtraction?: TaskExtraction
  ragReferences?: RagReference[]
  taskResult?: {
    hasTasks: boolean
    tasks: Array<{
      id: string
      title: string
      description?: string
      startTime: string
      endTime: string
      priority: 'high' | 'medium' | 'low'
      category?: string
      location?: string
      reminders?: number[]
    }>
    planText: string
  }
}

// 任务拆解请求/响应类型
export interface TaskDecomposeRequest {
  taskDescription: string
  emotionScore: number
  userProfile?: Partial<UserProfile>
}

export interface TaskDecomposeResponse {
  task: Task
  subtasks: SubTask[]
  strategy: DecompositionStrategy
} 
