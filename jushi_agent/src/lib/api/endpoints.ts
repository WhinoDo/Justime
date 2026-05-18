export const API_ENDPOINTS = {
  AUTH: {
    ME: '/api/auth/me',
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    PROFILE: '/api/auth/profile',
    LLM_CONFIG: '/api/auth/llm-config',
    LLM_CONFIGS: '/api/auth/llm-configs',
    LLM_CONFIG_DETAIL: (id: string) => `/api/auth/llm-configs/${id}`,
    LLM_CONFIG_ACTIVE: (id: string) => `/api/auth/llm-configs/${id}/active`,
    LLM_USAGE_DAILY: (days: number, scope: string) => `/api/auth/llm-usage/daily?days=${days}&scope=${scope}`,
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
  },

  CHAT: {
    BASE: '/api/chat',
    SESSIONS: '/api/chat/sessions',
    SESSION_MESSAGES: (sessionId: string) => `/api/chat/sessions/${sessionId}/messages`,
    MESSAGE: (messageId: string) => `/api/chat/messages/${messageId}`,
  },

  CALENDAR: {
    EVENTS: '/api/calendar/events',
    EVENT: (eventId: string) => `/api/calendar/events/${eventId}`,
    EVENT_YOUTUBE_SUMMARY_JOBS: (eventId: string) => `/api/calendar/events/${eventId}/youtube-summary/jobs`,
    EVENT_YOUTUBE_SUMMARY_JOB: (eventId: string, jobId: string) => `/api/calendar/events/${eventId}/youtube-summary/jobs/${jobId}`,
  },

  DOCUMENTS: {
    BASE: '/api/documents',
    BY_EVENT: (eventId: string) => `/api/documents?eventId=${eventId}`,
  },

  KNOWLEDGE: {
    FILES: '/api/knowledge/files',
    FILE: (filename: string) => `/api/knowledge/files/${filename}`,
    UPLOAD: '/api/knowledge/upload',
    REBUILD: '/api/knowledge/rebuild',
    REBUILD_STATUS: (taskId: string) => `/api/knowledge/rebuild/status/${taskId}`,
    CONTENT: (path: string, maxChars: number = 20000) => `/api/knowledge/content?path=${encodeURIComponent(path)}&max_chars=${maxChars}`,
    RAW: (path: string) => `/api/knowledge/raw?path=${encodeURIComponent(path)}`,
    CHUNKED_INIT: '/api/knowledge/chunked/init',
    CHUNKED_CHUNK: '/api/knowledge/chunked/chunk',
    CHUNKED_COMPLETE: '/api/knowledge/chunked/complete',
    CHUNKED_STATUS: (uploadId: string) => `/api/knowledge/chunked/status/${uploadId}`,
    CHUNKED_CANCEL: (uploadId: string) => `/api/knowledge/chunked/${uploadId}`,
  },

  ADMIN: {
    USERS: '/api/admin/users',
    USER: (userId: string) => `/api/admin/users/${userId}`,
    USER_ROLE: (userId: string) => `/api/admin/users/${userId}/role`,
    USER_STATUS: (userId: string) => `/api/admin/users/${userId}/status`,
    USER_MODELS: (userId: string) => `/api/admin/users/${userId}/models`,
    MODELS: '/api/admin/models',
    MODEL: (modelId: string) => `/api/admin/models/${modelId}`,
    API_KEYS: '/api/admin/apikeys',
    API_KEY: (keyId: string) => `/api/admin/apikeys/${keyId}`,
    STATS: '/api/admin/stats',
  },

  BOOK_ANALYSIS: {
    PROJECTS: '/api/book-analysis/projects',
    PROJECT: (projectId: string) => `/api/book-analysis/projects/${projectId}`,
    PROJECT_CHAPTERS: (projectId: string) => `/api/book-analysis/projects/${projectId}/chapters`,
    PROJECT_RUN: (projectId: string) => `/api/book-analysis/projects/${projectId}/run`,
  },
} as const
