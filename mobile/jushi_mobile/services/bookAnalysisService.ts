import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { BookAnalysisProject } from '@/types/book-analysis';

function authHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function listProjects(
  baseUrl: string,
  token: string | null
): Promise<BookAnalysisProject[]> {
  const response = await fetch(
    `${baseUrl}${API_ENDPOINTS.BOOK_ANALYSIS.PROJECTS}`,
    { headers: authHeaders(token) }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result?.detail || result?.error || '获取项目列表失败');
  }
  return (result.data?.projects || []) as BookAnalysisProject[];
}

export async function getProject(
  baseUrl: string,
  projectId: string,
  token: string | null
): Promise<BookAnalysisProject> {
  const response = await fetch(
    `${baseUrl}${API_ENDPOINTS.BOOK_ANALYSIS.PROJECT(projectId)}`,
    { headers: authHeaders(token) }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result?.detail || result?.error || '获取项目详情失败');
  }
  return result.data.project as BookAnalysisProject;
}

export async function getProjectStatus(
  baseUrl: string,
  projectId: string,
  token: string | null
): Promise<{
  id: string;
  status: string;
  currentStage: string;
  currentChapterIndex: number;
  totalChapters: number;
  progressPercent: number;
  error: string | null;
  updatedAt: string;
}> {
  const response = await fetch(
    `${baseUrl}${API_ENDPOINTS.BOOK_ANALYSIS.PROJECT_STATUS(projectId)}`,
    { headers: authHeaders(token) }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result?.detail || result?.error || '获取任务状态失败');
  }
  return result.data;
}

export async function createProject(
  baseUrl: string,
  file: FormData,
  token: string | null
): Promise<BookAnalysisProject> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${baseUrl}${API_ENDPOINTS.BOOK_ANALYSIS.PROJECTS}`,
    { method: 'POST', headers, body: file }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result?.detail || result?.error || '创建项目失败');
  }
  return result.data.project as BookAnalysisProject;
}

export async function updateChapters(
  baseUrl: string,
  projectId: string,
  chapters: { title: string; startPage: number; endPage: number }[],
  token: string | null
): Promise<BookAnalysisProject> {
  const response = await fetch(
    `${baseUrl}${API_ENDPOINTS.BOOK_ANALYSIS.PROJECT_CHAPTERS(projectId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ chapters }),
    }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result?.detail || result?.error || '保存章节失败');
  }
  return result.data.project as BookAnalysisProject;
}

export async function startAnalysis(
  baseUrl: string,
  projectId: string,
  token: string | null
): Promise<BookAnalysisProject> {
  const response = await fetch(
    `${baseUrl}${API_ENDPOINTS.BOOK_ANALYSIS.PROJECT_RUN(projectId)}`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result?.detail || result?.error || '启动分析失败');
  }
  return result.data.project as BookAnalysisProject;
}
