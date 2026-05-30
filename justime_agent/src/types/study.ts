export type Subject = "数学" | "英语" | "政治" | "专业课"
export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped"
export type TaskType = "study" | "review" | "practice" | "mock_exam"

export interface StudyProfile {
  id: string
  userId: string
  targetSchool: string
  targetMajor: string
  examDate: string
  subjects: Subject[]
  dailyStudyHours: number
  createdAt: string
  updatedAt: string
}

export interface StudyPlan {
  id: string
  userId: string
  planName: string
  startDate: string
  endDate: string
  phases: PlanPhase[]
  dailyHours: number
  createdAt: string
  updatedAt: string
}

export interface PlanPhase {
  phaseName: string
  startDate: string
  endDate: string
  subjects: Subject[]
  goals: string[]
}

export interface StudyTask {
  id: string
  userId: string
  planId?: string
  subject: Subject
  taskType: TaskType
  title: string
  description: string
  scheduledDate: string
  durationHours: number
  feishuEventId?: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

export interface StudyProgress {
  id: string
  userId: string
  date: string
  subject: Subject
  plannedHours: number
  actualHours: number
  completionRate: number
  notes: string
  createdAt: string
}

export interface ReviewSchedule {
  id: string
  userId: string
  knowledgePoint: string
  subject: Subject
  lastReviewed?: string
  nextReview: string
  reviewCount: number
  easeFactor: number
  createdAt: string
}

export interface StudyMaterial {
  id: string
  userId: string
  subject: Subject
  filename: string
  notebooklmSourceId?: string
  uploadedAt: string
}

export interface ProgressStats {
  totalStudyHours: number
  weeklyStudyHours: number
  dailyAverageHours: number
  streakDays: number
  subjectBreakdown: Record<Subject, number>
  completionRate: number
  daysUntilExam: number
}
