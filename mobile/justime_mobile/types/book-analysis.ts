export type BookAnalysisStatus =
  | 'draft'
  | 'running'
  | 'completed'
  | 'failed'
  | 'completed_with_errors';

export interface BookAnalysisChapter {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  status: BookAnalysisStatus;
  summary: string;
  keyPoints: string[];
  arguments: string[];
  examples: string[];
  evidence: string[];
  quotedEvidence: string[];
  openQuestions: string[];
  rawAnswer: string;
  error: string | null;
}

export interface BookAnalysisProject {
  id: string;
  userId: string;
  title: string;
  originalFilename: string;
  sourcePath: string;
  sourceRawUrl?: string;
  pageCount: number;
  notebookId?: string | null;
  status: BookAnalysisStatus;
  currentStage: string;
  currentChapterIndex: number;
  totalChapters: number;
  progressPercent: number;
  error?: string | null;
  chapters: BookAnalysisChapter[];
  exportHtmlPath?: string | null;
  exportHtmlUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}
