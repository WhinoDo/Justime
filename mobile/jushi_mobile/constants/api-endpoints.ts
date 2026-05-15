export const API_ENDPOINTS = {
  AUTH: {
    ME: '/api/v1/auth/me',
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh',
    LLM_CONFIGS: '/api/v1/auth/llm-configs',
  },

  CHAT: {
    BASE: '/api/v1/chat/',
    SESSIONS: '/api/v1/chat/sessions',
    SESSION_MESSAGES: (sessionId: string) => `/api/v1/chat/sessions/${sessionId}/messages`,
    MESSAGE: (messageId: string) => `/api/v1/chat/messages/${messageId}`,
  },

  CALENDAR: {
    EVENTS: '/api/v1/calendar/events',
    EVENT: (eventId: string) => `/api/v1/calendar/events/${eventId}`,
  },

  DOCUMENTS: {
    BASE: '/api/v1/documents',
    BY_EVENT: (eventId: string) => `/api/v1/documents?eventId=${eventId}`,
  },

  KNOWLEDGE: {
    UPLOAD: '/api/v1/knowledge/upload',
    FILES: '/api/v1/knowledge/files',
    CONTENT: '/api/v1/knowledge/content',
    RAW: '/api/v1/knowledge/raw',
    FILE: (filename: string) => `/api/v1/knowledge/files/${encodeURIComponent(filename)}`,
    REBUILD: '/api/v1/knowledge/rebuild',
    REBUILD_STATUS: (taskId: string) => `/api/v1/knowledge/rebuild/status/${taskId}`,
  },

  HEALTH: '/api/v1/health/',
} as const
