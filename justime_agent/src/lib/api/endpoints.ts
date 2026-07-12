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
    FEISHU_BIND: '/api/auth/feishu-bind',
  },

  CHAT: {
    BASE: '/api/chat',
    STREAM: '/api/chat/stream',
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

  TASK_PROCESS: {
    BASE: '/api/task-processes',
    LIST: (query: string) => `/api/task-processes${query ? `?${query}` : ''}`,
    DETAIL: (taskId: string) => `/api/task-processes/${taskId}`,
    AGENT: (taskId: string) => `/api/task-processes/${taskId}/agent`,
    EVIDENCE: (taskId: string) => `/api/task-processes/${taskId}/evidence`,
    TIME_LOG: (taskId: string) => `/api/task-processes/${taskId}/evidence/time-log`,
    KNOWLEDGE_OUTPUTS: (taskId: string) => `/api/task-processes/${taskId}/knowledge-outputs`,
    GENERATE_KNOWLEDGE: (taskId: string) => `/api/task-processes/${taskId}/knowledge-outputs/generate`,
    KNOWLEDGE_OUTPUT_DETAIL: (outputId: string) => `/api/task-processes/knowledge-outputs/${outputId}`,
    PUBLISH_KNOWLEDGE: (outputId: string) => `/api/task-processes/knowledge-outputs/${outputId}/publish`,
    ROLLBACK_KNOWLEDGE: (outputId: string) => `/api/task-processes/knowledge-outputs/${outputId}/rollback`,
    VAULT_CONFIG: '/api/task-processes/vault-config',
  },

  STUDY: {
    PROFILE: '/api/study/profile',
    PLAN: '/api/study/plan',
    TASKS: '/api/study/tasks',
    TASK_DETAIL: (taskId: string) => `/api/study/tasks/${taskId}`,
    PROGRESS: '/api/study/progress',
    MATERIALS: '/api/study/materials',
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
    NOTEBOOKLM: '/api/admin/notebooklm',
  },

  AGENT: {
    STATUS: '/api/agent/status',
    PROVIDERS: '/api/agent/providers',
    TOOLS: '/api/agent/tools',
    RUN: '/api/agent/run',
  },
} as const
