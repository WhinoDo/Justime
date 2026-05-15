import { API_ENDPOINTS } from '../endpoints'

describe('API_ENDPOINTS', () => {
  describe('AUTH', () => {
    it('应该定义正确的认证端点', () => {
      expect(API_ENDPOINTS.AUTH.ME).toBe('/api/auth/me')
      expect(API_ENDPOINTS.AUTH.LOGIN).toBe('/api/auth/login')
      expect(API_ENDPOINTS.AUTH.REGISTER).toBe('/api/auth/register')
      expect(API_ENDPOINTS.AUTH.LOGOUT).toBe('/api/auth/logout')
      expect(API_ENDPOINTS.AUTH.REFRESH).toBe('/api/auth/refresh')
      expect(API_ENDPOINTS.AUTH.PROFILE).toBe('/api/auth/profile')
      expect(API_ENDPOINTS.AUTH.LLM_CONFIG).toBe('/api/auth/llm-config')
      expect(API_ENDPOINTS.AUTH.LLM_CONFIGS).toBe('/api/auth/llm-configs')
      expect(API_ENDPOINTS.AUTH.FORGOT_PASSWORD).toBe('/api/auth/forgot-password')
      expect(API_ENDPOINTS.AUTH.RESET_PASSWORD).toBe('/api/auth/reset-password')
    })

    it('应该生成动态的 LLM 配置端点', () => {
      expect(API_ENDPOINTS.AUTH.LLM_CONFIG_DETAIL('123')).toBe('/api/auth/llm-configs/123')
      expect(API_ENDPOINTS.AUTH.LLM_CONFIG_ACTIVE('456')).toBe('/api/auth/llm-configs/456/active')
      expect(API_ENDPOINTS.AUTH.LLM_USAGE_DAILY(7, 'user')).toBe('/api/auth/llm-usage/daily?days=7&scope=user')
    })
  })

  describe('CHAT', () => {
    it('应该定义正确的聊天端点', () => {
      expect(API_ENDPOINTS.CHAT.BASE).toBe('/api/chat')
      expect(API_ENDPOINTS.CHAT.SESSIONS).toBe('/api/chat/sessions')
    })

    it('应该生成动态的会话消息端点', () => {
      expect(API_ENDPOINTS.CHAT.SESSION_MESSAGES('session-123')).toBe('/api/chat/sessions/session-123/messages')
      expect(API_ENDPOINTS.CHAT.MESSAGE('msg-456')).toBe('/api/chat/messages/msg-456')
    })
  })

  describe('CALENDAR', () => {
    it('应该定义正确的日历端点', () => {
      expect(API_ENDPOINTS.CALENDAR.EVENTS).toBe('/api/calendar/events')
    })

    it('应该生成动态的事件端点', () => {
      expect(API_ENDPOINTS.CALENDAR.EVENT('event-123')).toBe('/api/calendar/events/event-123')
      expect(API_ENDPOINTS.CALENDAR.EVENT_YOUTUBE_SUMMARY_JOBS('event-123')).toBe('/api/calendar/events/event-123/youtube-summary/jobs')
      expect(API_ENDPOINTS.CALENDAR.EVENT_YOUTUBE_SUMMARY_JOB('event-123', 'job-456')).toBe('/api/calendar/events/event-123/youtube-summary/jobs/job-456')
    })
  })

  describe('DOCUMENTS', () => {
    it('应该定义正确的文档端点', () => {
      expect(API_ENDPOINTS.DOCUMENTS.BASE).toBe('/api/documents')
      expect(API_ENDPOINTS.DOCUMENTS.BY_EVENT('event-123')).toBe('/api/documents?eventId=event-123')
    })
  })

  describe('KNOWLEDGE', () => {
    it('应该定义正确的知识库端点', () => {
      expect(API_ENDPOINTS.KNOWLEDGE.FILES).toBe('/api/knowledge/files')
      expect(API_ENDPOINTS.KNOWLEDGE.UPLOAD).toBe('/api/knowledge/upload')
      expect(API_ENDPOINTS.KNOWLEDGE.REBUILD).toBe('/api/knowledge/rebuild')
      expect(API_ENDPOINTS.KNOWLEDGE.CHUNKED_INIT).toBe('/api/knowledge/chunked/init')
      expect(API_ENDPOINTS.KNOWLEDGE.CHUNKED_CHUNK).toBe('/api/knowledge/chunked/chunk')
      expect(API_ENDPOINTS.KNOWLEDGE.CHUNKED_COMPLETE).toBe('/api/knowledge/chunked/complete')
    })

    it('应该生成动态的知识库端点', () => {
      expect(API_ENDPOINTS.KNOWLEDGE.FILE('test.md')).toBe('/api/knowledge/files/test.md')
      expect(API_ENDPOINTS.KNOWLEDGE.CONTENT('/path/to/file', 5000)).toBe('/api/knowledge/content?path=%2Fpath%2Fto%2Ffile&max_chars=5000')
      expect(API_ENDPOINTS.KNOWLEDGE.RAW('/path/to/file')).toBe('/api/knowledge/raw?path=%2Fpath%2Fto%2Ffile')
      expect(API_ENDPOINTS.KNOWLEDGE.CHUNKED_STATUS('upload-123')).toBe('/api/knowledge/chunked/status/upload-123')
      expect(API_ENDPOINTS.KNOWLEDGE.CHUNKED_CANCEL('upload-123')).toBe('/api/knowledge/chunked/upload-123')
    })
  })

  describe('ADMIN', () => {
    it('应该定义正确的管理端点', () => {
      expect(API_ENDPOINTS.ADMIN.USERS).toBe('/api/admin/users')
      expect(API_ENDPOINTS.ADMIN.MODELS).toBe('/api/admin/models')
      expect(API_ENDPOINTS.ADMIN.API_KEYS).toBe('/api/admin/apikeys')
      expect(API_ENDPOINTS.ADMIN.STATS).toBe('/api/admin/stats')
    })

    it('应该生成动态的管理端点', () => {
      expect(API_ENDPOINTS.ADMIN.USER('user-123')).toBe('/api/admin/users/user-123')
      expect(API_ENDPOINTS.ADMIN.USER_ROLE('user-123')).toBe('/api/admin/users/user-123/role')
      expect(API_ENDPOINTS.ADMIN.USER_STATUS('user-123')).toBe('/api/admin/users/user-123/status')
      expect(API_ENDPOINTS.ADMIN.USER_MODELS('user-123')).toBe('/api/admin/users/user-123/models')
      expect(API_ENDPOINTS.ADMIN.MODEL('model-456')).toBe('/api/admin/models/model-456')
      expect(API_ENDPOINTS.ADMIN.API_KEY('key-789')).toBe('/api/admin/apikeys/key-789')
    })
  })

  describe('BOOK_ANALYSIS', () => {
    it('应该定义正确的书籍分析端点', () => {
      expect(API_ENDPOINTS.BOOK_ANALYSIS.PROJECTS).toBe('/api/book-analysis/projects')
    })

    it('应该生成动态的书籍分析端点', () => {
      expect(API_ENDPOINTS.BOOK_ANALYSIS.PROJECT('project-123')).toBe('/api/book-analysis/projects/project-123')
      expect(API_ENDPOINTS.BOOK_ANALYSIS.PROJECT_CHAPTERS('project-123')).toBe('/api/book-analysis/projects/project-123/chapters')
      expect(API_ENDPOINTS.BOOK_ANALYSIS.PROJECT_RUN('project-123')).toBe('/api/book-analysis/projects/project-123/run')
    })
  })
})
