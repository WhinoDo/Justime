# 测试与质量保障体系 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立全面的测试覆盖，确保前后端代码质量和稳定性

**Architecture:** 
- 前端使用 Jest + React Testing Library 进行单元测试和组件测试
- 后端使用 Python unittest 进行服务层和业务逻辑测试
- 分层测试策略：单元测试 -> 集成测试 -> API 端点测试

**Tech Stack:** Jest, React Testing Library, Python unittest, FastAPI TestClient

---

## 当前测试状态

### 前端 (justime_agent)
已有测试：
- `src/lib/api/__tests__/proxy.test.ts` - API代理认证处理
- `src/lib/api/__tests__/config.test.ts` - API配置
- `src/lib/task/__tests__/decomposer.test.ts` - 任务拆解
- `src/lib/ai/__tests__/emotion-analyzer.test.ts` - 情绪分析
- `src/components/chat/__tests__/ChatInterface.test.tsx` - 聊天界面
- `src/app/api/chat/__tests__/route.test.ts` - 聊天API

缺失测试：
- Hooks: useAuth, useLLMConfig, useChatSessions, useAuthRedirect
- Components: auth forms, calendar, document editor
- API Routes: auth/*, calendar/*, admin/*
- Utils: time.ts, api-logger.ts, auth-utils.ts

### 后端 (justime_backend)
已有测试：
- `tests/services/test_user_service_auth_logging.py` - 用户服务认证日志
- `tests/services/test_chat_endpoint_session_auth.py` - 聊天端点会话认证
- `tests/services/test_book_analysis_service.py`
- `tests/services/test_youtube_summary_service.py`
- `tests/services/test_model_router_service.py`

缺失测试：
- Services: security_service, session_service, upload_service, agent_service
- Business: auth_business, chat_business, admin_business, chat_router

---

## Task 1: 前端 Hooks 测试 - useAuth

**Files:**
- Create: `justime_agent/src/hooks/__tests__/useAuth.test.ts`
- Test: `justime_agent/src/hooks/useAuth.ts`

**Step 1: Write the failing test**

```typescript
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '../useAuth'

global.fetch = jest.fn()

describe('useAuth', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should return initial auth state', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should login successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
    } as Response)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login('test@example.com', 'password')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe('test@example.com')
  })

  it('should handle login failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    } as Response)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      try {
        await result.current.login('test@example.com', 'wrong')
      } catch (e) {
        expect(e).toBeDefined()
      }
    })

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should logout successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd justime_agent && npm test -- src/hooks/__tests__/useAuth.test.ts`
Expected: Tests may pass or fail depending on hook implementation

**Step 3: Commit**

```bash
git add justime_agent/src/hooks/__tests__/useAuth.test.ts
git commit -m "test: add useAuth hook tests"
```

---

## Task 2: 前端 Hooks 测试 - useLLMConfig

**Files:**
- Create: `justime_agent/src/hooks/__tests__/useLLMConfig.test.ts`
- Test: `justime_agent/src/hooks/useLLMConfig.ts`

**Step 1: Write the failing test**

```typescript
import { renderHook, act } from '@testing-library/react'
import { useLLMConfig } from '../useLLMConfig'

global.fetch = jest.fn()

describe('useLLMConfig', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should fetch LLM configs on mount', async () => {
    const mockConfigs = [
      { id: '1', name: 'Config 1', provider: 'openai', model: 'gpt-4' },
      { id: '2', name: 'Config 2', provider: 'anthropic', model: 'claude-3' },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ configs: mockConfigs }),
    } as Response)

    const { result } = renderHook(() => useLLMConfig())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.configs).toEqual(mockConfigs)
  })

  it('should create new config', async () => {
    const newConfig = { name: 'New Config', provider: 'openai', model: 'gpt-4' }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ config: { id: '3', ...newConfig } }),
    } as Response)

    const { result } = renderHook(() => useLLMConfig())

    await act(async () => {
      await result.current.createConfig(newConfig)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/llm-configs',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should set active config', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    const { result } = renderHook(() => useLLMConfig())

    await act(async () => {
      await result.current.setActiveConfig('config-id')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/llm-configs/config-id/active',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should test config connection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Connection OK' }),
    } as Response)

    const { result } = renderHook(() => useLLMConfig())

    const testResult = await act(async () => {
      return await result.current.testConfig('config-id')
    })

    expect(testResult.success).toBe(true)
  })
})
```

**Step 2: Run test to verify**

Run: `cd justime_agent && npm test -- src/hooks/__tests__/useLLMConfig.test.ts`

**Step 3: Commit**

```bash
git add justime_agent/src/hooks/__tests__/useLLMConfig.test.ts
git commit -m "test: add useLLMConfig hook tests"
```

---

## Task 3: 前端 Hooks 测试 - useChatSessions

**Files:**
- Create: `justime_agent/src/hooks/__tests__/useChatSessions.test.ts`
- Test: `justime_agent/src/hooks/useChatSessions.ts`

**Step 1: Write the failing test**

```typescript
import { renderHook, act } from '@testing-library/react'
import { useChatSessions } from '../useChatSessions'

global.fetch = jest.fn()

describe('useChatSessions', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should fetch sessions on mount', async () => {
    const mockSessions = [
      { id: '1', title: 'Session 1', created_at: '2024-01-01' },
      { id: '2', title: 'Session 2', created_at: '2024-01-02' },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sessions: mockSessions }),
    } as Response)

    const { result } = renderHook(() => useChatSessions())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.sessions).toEqual(mockSessions)
  })

  it('should create new session', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ session: { id: '3', title: 'New Session' } }),
    } as Response)

    const { result } = renderHook(() => useChatSessions())

    await act(async () => {
      await result.current.createSession('New Session')
    })

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should delete session', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)

    const { result } = renderHook(() => useChatSessions())

    await act(async () => {
      await result.current.deleteSession('session-id')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('session-id'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})
```

**Step 2: Run test to verify**

Run: `cd justime_agent && npm test -- src/hooks/__tests__/useChatSessions.test.ts`

**Step 3: Commit**

```bash
git add justime_agent/src/hooks/__tests__/useChatSessions.test.ts
git commit -m "test: add useChatSessions hook tests"
```

---

## Task 4: 前端 Utils 测试 - time.ts

**Files:**
- Create: `justime_agent/src/lib/utils/__tests__/time.test.ts`
- Test: `justime_agent/src/lib/utils/time.ts`

**Step 1: Read the time.ts file**

Run: Read `justime_agent/src/lib/utils/time.ts`

**Step 2: Write the failing test**

```typescript
import { 
  formatTime, 
  parseTime, 
  getTimeRange,
  isWithinTimeRange,
  formatDuration,
  getRelativeTime
} from '../time'

describe('time utils', () => {
  describe('formatTime', () => {
    it('should format time correctly', () => {
      const date = new Date('2024-01-15T10:30:00')
      expect(formatTime(date, 'HH:mm')).toBe('10:30')
    })

    it('should handle different formats', () => {
      const date = new Date('2024-01-15T10:30:00')
      expect(formatTime(date, 'YYYY-MM-DD')).toBe('2024-01-15')
    })
  })

  describe('parseTime', () => {
    it('should parse time string', () => {
      const result = parseTime('10:30')
      expect(result.getHours()).toBe(10)
      expect(result.getMinutes()).toBe(30)
    })

    it('should return null for invalid time', () => {
      expect(parseTime('invalid')).toBeNull()
    })
  })

  describe('getTimeRange', () => {
    it('should return time range from string', () => {
      const result = getTimeRange('09:00-11:00')
      expect(result.start).toBe('09:00')
      expect(result.end).toBe('11:00')
    })

    it('should return null for invalid range', () => {
      expect(getTimeRange('invalid')).toBeNull()
    })
  })

  describe('isWithinTimeRange', () => {
    it('should return true when time is within range', () => {
      expect(isWithinTimeRange('10:00', '09:00-11:00')).toBe(true)
    })

    it('should return false when time is outside range', () => {
      expect(isWithinTimeRange('08:00', '09:00-11:00')).toBe(false)
    })
  })

  describe('formatDuration', () => {
    it('should format minutes to human readable', () => {
      expect(formatDuration(25)).toBe('25分钟')
      expect(formatDuration(60)).toBe('1小时')
      expect(formatDuration(90)).toBe('1小时30分钟')
    })
  })

  describe('getRelativeTime', () => {
    it('should return relative time string', () => {
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
      expect(getRelativeTime(fiveMinutesAgo)).toBe('5分钟前')
    })
  })
})
```

**Step 3: Run test to verify**

Run: `cd justime_agent && npm test -- src/lib/utils/__tests__/time.test.ts`

**Step 4: Commit**

```bash
git add justime_agent/src/lib/utils/__tests__/time.test.ts
git commit -m "test: add time utils tests"
```

---

## Task 5: 前端 API 路由测试 - Auth Routes

**Files:**
- Create: `justime_agent/src/app/api/auth/__tests__/login.test.ts`
- Create: `justime_agent/src/app/api/auth/__tests__/register.test.ts`
- Create: `justime_agent/src/app/api/auth/__tests__/refresh.test.ts`
- Test: `justime_agent/src/app/api/auth/login/route.ts`
- Test: `justime_agent/src/app/api/auth/register/route.ts`
- Test: `justime_agent/src/app/api/auth/refresh/route.ts`

**Step 1: Write the failing test for login**

```typescript
import { POST } from '../login/route'

const mockNextResponseJson = jest.fn()
jest.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => mockNextResponseJson(...args),
  },
}))

global.fetch = jest.fn()

describe('POST /api/auth/login', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
    mockNextResponseJson.mockReset()
  })

  it('should login successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 
        access_token: 'token', 
        user: { id: '1', email: 'test@example.com' } 
      }),
      headers: new Headers({ 'set-cookie': 'access_token=token' }),
    } as Response)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    })

    await POST(request)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should return error for invalid credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    } as Response)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
    })

    await POST(request)

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      expect.objectContaining({ status: 401 })
    )
  })
})
```

**Step 2: Run test**

Run: `cd justime_agent && npm test -- src/app/api/auth/__tests__/login.test.ts`

**Step 3: Commit**

```bash
git add justime_agent/src/app/api/auth/__tests__/
git commit -m "test: add auth API route tests"
```

---

## Task 6: 后端 Service 测试 - SecurityService

**Files:**
- Create: `justime_backend/tests/services/test_security_service.py`
- Test: `justime_backend/app/services/security_service.py`

**Step 1: Read the security_service.py file**

Run: Read `justime_backend/app/services/security_service.py`

**Step 2: Write the failing test**

```python
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import asyncio


class TestSecurityService(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_db = MagicMock()
        self.mock_db.users = MagicMock()

    async def test_get_current_user_valid_token(self):
        """Test getting current user with valid token"""
        from app.services.security_service import SecurityService
        
        mock_user = {
            "_id": "user_id_123",
            "email": "test@example.com",
            "role": "user"
        }
        
        self.mock_db.users.find_one = AsyncMock(return_value=mock_user)
        
        with patch('app.services.security_service.decode_token', return_value={"sub": "user_id_123"}):
            result = await SecurityService.get_current_user("valid_token", self.mock_db)
            
        self.assertEqual(result["email"], "test@example.com")

    async def test_get_current_user_invalid_token(self):
        """Test getting current user with invalid token"""
        from app.services.security_service import SecurityService
        
        with patch('app.services.security_service.decode_token', return_value=None):
            with self.assertRaises(Exception):
                await SecurityService.get_current_user("invalid_token", self.mock_db)

    async def test_get_current_user_expired_token(self):
        """Test getting current user with expired token"""
        from app.services.security_service import SecurityService
        
        with patch('app.services.security_service.decode_token', side_effect=Exception("Token expired")):
            with self.assertRaises(Exception):
                await SecurityService.get_current_user("expired_token", self.mock_db)

    async def test_verify_password_correct(self):
        """Test password verification with correct password"""
        from app.services.security_service import SecurityService
        
        hashed = SecurityService.hash_password("password123")
        result = SecurityService.verify_password("password123", hashed)
        
        self.assertTrue(result)

    async def test_verify_password_incorrect(self):
        """Test password verification with incorrect password"""
        from app.services.security_service import SecurityService
        
        hashed = SecurityService.hash_password("password123")
        result = SecurityService.verify_password("wrong_password", hashed)
        
        self.assertFalse(result)

    def test_hash_password_returns_string(self):
        """Test that hash_password returns a string"""
        from app.services.security_service import SecurityService
        
        result = SecurityService.hash_password("password123")
        
        self.assertIsInstance(result, str)
        self.assertTrue(len(result) > 0)


if __name__ == "__main__":
    unittest.main()
```

**Step 3: Run test**

Run: `cd justime_backend && python -m pytest tests/services/test_security_service.py -v`

**Step 4: Commit**

```bash
git add justime_backend/tests/services/test_security_service.py
git commit -m "test: add security service tests"
```

---

## Task 7: 后端 Service 测试 - SessionService

**Files:**
- Create: `justime_backend/tests/services/test_session_service.py`
- Test: `justime_backend/app/services/session_service.py`

**Step 1: Read the session_service.py file**

Run: Read `justime_backend/app/services/session_service.py`

**Step 2: Write the failing test**

```python
import unittest
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime


class TestSessionService(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_db = MagicMock()
        self.mock_db.chat_sessions = MagicMock()

    async def test_create_session(self):
        """Test creating a new chat session"""
        from app.services.session_service import SessionService
        
        user_id = "user_123"
        title = "Test Session"
        
        self.mock_db.chat_sessions.insert_one = AsyncMock(return_value=MagicMock(inserted_id="session_123"))
        
        result = await SessionService.create_session(user_id, title, self.mock_db)
        
        self.assertIsNotNone(result)
        self.mock_db.chat_sessions.insert_one.assert_called_once()

    async def test_get_user_sessions(self):
        """Test getting all sessions for a user"""
        from app.services.session_service import SessionService
        
        mock_sessions = [
            {"_id": "session_1", "user_id": "user_123", "title": "Session 1"},
            {"_id": "session_2", "user_id": "user_123", "title": "Session 2"},
        ]
        
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=mock_sessions)
        self.mock_db.chat_sessions.find = MagicMock(return_value=mock_cursor)
        
        result = await SessionService.get_user_sessions("user_123", self.mock_db)
        
        self.assertEqual(len(result), 2)

    async def test_delete_session(self):
        """Test deleting a session"""
        from app.services.session_service import SessionService
        
        self.mock_db.chat_sessions.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        
        result = await SessionService.delete_session("session_123", "user_123", self.mock_db)
        
        self.assertTrue(result)
        self.mock_db.chat_sessions.delete_one.assert_called_once()

    async def test_delete_session_not_owner(self):
        """Test deleting a session that doesn't belong to user"""
        from app.services.session_service import SessionService
        
        self.mock_db.chat_sessions.delete_one = AsyncMock(return_value=MagicMock(deleted_count=0))
        
        result = await SessionService.delete_session("session_123", "wrong_user", self.mock_db)
        
        self.assertFalse(result)

    async def test_update_session_title(self):
        """Test updating session title"""
        from app.services.session_service import SessionService
        
        self.mock_db.chat_sessions.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        
        result = await SessionService.update_session_title(
            "session_123", "user_123", "New Title", self.mock_db
        )
        
        self.assertTrue(result)


if __name__ == "__main__":
    unittest.main()
```

**Step 3: Run test**

Run: `cd justime_backend && python -m pytest tests/services/test_session_service.py -v`

**Step 4: Commit**

```bash
git add justime_backend/tests/services/test_session_service.py
git commit -m "test: add session service tests"
```

---

## Task 8: 后端 Business 测试 - AuthBusiness

**Files:**
- Create: `justime_backend/tests/business/test_auth_business.py`
- Test: `justime_backend/app/business/auth_business.py`

**Step 1: Read the auth_business.py file**

Run: Read `justime_backend/app/business/auth_business.py`

**Step 2: Write the failing test**

```python
import unittest
from unittest.mock import MagicMock, AsyncMock, patch


class TestAuthBusiness(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_db = MagicMock()

    async def test_register_user_success(self):
        """Test successful user registration"""
        from app.business.auth_business import AuthBusiness
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.find_one = AsyncMock(return_value=None)
        self.mock_db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="user_123"))
        
        with patch('app.business.auth_business.send_email', new_callable=AsyncMock):
            result = await AuthBusiness.register_user(
                email="test@example.com",
                password="password123",
                db=self.mock_db
            )
        
        self.assertIsNotNone(result)

    async def test_register_user_email_exists(self):
        """Test registration with existing email"""
        from app.business.auth_business import AuthBusiness
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.find_one = AsyncMock(return_value={"email": "test@example.com"})
        
        with self.assertRaises(Exception) as context:
            await AuthBusiness.register_user(
                email="test@example.com",
                password="password123",
                db=self.mock_db
            )
        
        self.assertIn("already exists", str(context.exception).lower())

    async def test_login_user_success(self):
        """Test successful login"""
        from app.business.auth_business import AuthBusiness
        
        mock_user = {
            "_id": "user_123",
            "email": "test@example.com",
            "password": "hashed_password",
            "is_active": True
        }
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.find_one = AsyncMock(return_value=mock_user)
        
        with patch('app.business.auth_business.verify_password', return_value=True):
            with patch('app.business.auth_business.create_token', return_value="access_token"):
                result = await AuthBusiness.login_user(
                    email="test@example.com",
                    password="password123",
                    db=self.mock_db
                )
        
        self.assertIn("access_token", result)

    async def test_login_user_wrong_password(self):
        """Test login with wrong password"""
        from app.business.auth_business import AuthBusiness
        
        mock_user = {
            "_id": "user_123",
            "email": "test@example.com",
            "password": "hashed_password",
            "is_active": True
        }
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.find_one = AsyncMock(return_value=mock_user)
        
        with patch('app.business.auth_business.verify_password', return_value=False):
            with self.assertRaises(Exception):
                await AuthBusiness.login_user(
                    email="test@example.com",
                    password="wrong_password",
                    db=self.mock_db
                )

    async def test_forgot_password(self):
        """Test forgot password flow"""
        from app.business.auth_business import AuthBusiness
        
        mock_user = {
            "_id": "user_123",
            "email": "test@example.com"
        }
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.find_one = AsyncMock(return_value=mock_user)
        self.mock_db.users.update_one = AsyncMock()
        
        with patch('app.business.auth_business.send_reset_email', new_callable=AsyncMock):
            result = await AuthBusiness.forgot_password(
                email="test@example.com",
                db=self.mock_db
            )
        
        self.assertTrue(result)

    async def test_reset_password(self):
        """Test password reset"""
        from app.business.auth_business import AuthBusiness
        
        mock_user = {
            "_id": "user_123",
            "email": "test@example.com",
            "reset_token": "valid_token"
        }
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.find_one = AsyncMock(return_value=mock_user)
        self.mock_db.users.update_one = AsyncMock()
        
        with patch('app.business.auth_business.verify_reset_token', return_value="user_123"):
            result = await AuthBusiness.reset_password(
                token="valid_token",
                new_password="newpassword123",
                db=self.mock_db
            )
        
        self.assertTrue(result)


if __name__ == "__main__":
    unittest.main()
```

**Step 3: Run test**

Run: `cd justime_backend && python -m pytest tests/business/test_auth_business.py -v`

**Step 4: Commit**

```bash
git add justime_backend/tests/business/test_auth_business.py
git commit -m "test: add auth business tests"
```

---

## Task 9: 后端 Business 测试 - ChatBusiness

**Files:**
- Create: `justime_backend/tests/business/test_chat_business.py`
- Test: `justime_backend/app/business/chat_business.py`

**Step 1: Read the chat_business.py file**

Run: Read `justime_backend/app/business/chat_business.py`

**Step 2: Write the failing test**

```python
import unittest
from unittest.mock import MagicMock, AsyncMock, patch


class TestChatBusiness(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_db = MagicMock()

    async def test_process_chat_message(self):
        """Test processing chat message"""
        from app.business.chat_business import ChatBusiness
        
        mock_session = {
            "_id": "session_123",
            "user_id": "user_123"
        }
        
        self.mock_db.chat_sessions = MagicMock()
        self.mock_db.chat_sessions.find_one = AsyncMock(return_value=mock_session)
        
        self.mock_db.chat_messages = MagicMock()
        self.mock_db.chat_messages.insert_one = AsyncMock()
        
        with patch('app.business.chat_business.ChatRouter.route', new_callable=AsyncMock) as mock_route:
            mock_route.return_value = {"response": "AI response", "emotion_score": 7}
            
            result = await ChatBusiness.process_chat(
                session_id="session_123",
                message="Hello",
                user_id="user_123",
                db=self.mock_db
            )
        
        self.assertIn("response", result)

    async def test_get_session_messages(self):
        """Test getting session messages"""
        from app.business.chat_business import ChatBusiness
        
        mock_messages = [
            {"_id": "msg_1", "role": "user", "content": "Hello"},
            {"_id": "msg_2", "role": "assistant", "content": "Hi there!"},
        ]
        
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=mock_messages)
        
        self.mock_db.chat_messages = MagicMock()
        self.mock_db.chat_messages.find = MagicMock(return_value=mock_cursor)
        
        result = await ChatBusiness.get_session_messages(
            session_id="session_123",
            db=self.mock_db,
            limit=50
        )
        
        self.assertEqual(len(result), 2)

    async def test_update_message(self):
        """Test updating message interactive state"""
        from app.business.chat_business import ChatBusiness
        
        self.mock_db.chat_messages = MagicMock()
        self.mock_db.chat_messages.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        
        result = await ChatBusiness.update_message_interactive_state(
            message_id="msg_123",
            updates={"task_decomposition": {"tasks": []}},
            db=self.mock_db
        )
        
        self.assertTrue(result)

    async def test_delete_session_messages(self):
        """Test deleting all messages in a session"""
        from app.business.chat_business import ChatBusiness
        
        self.mock_db.chat_messages = MagicMock()
        self.mock_db.chat_messages.delete_many = AsyncMock(return_value=MagicMock(deleted_count=5))
        
        result = await ChatBusiness.delete_session_messages(
            session_id="session_123",
            db=self.mock_db
        )
        
        self.assertEqual(result, 5)


if __name__ == "__main__":
    unittest.main()
```

**Step 3: Run test**

Run: `cd justime_backend && python -m pytest tests/business/test_chat_business.py -v`

**Step 4: Commit**

```bash
git add justime_backend/tests/business/test_chat_business.py
git commit -m "test: add chat business tests"
```

---

## Task 10: 后端 Business 测试 - AdminBusiness

**Files:**
- Create: `justime_backend/tests/business/test_admin_business.py`
- Test: `justime_backend/app/business/admin_business.py`

**Step 1: Read the admin_business.py file**

Run: Read `justime_backend/app/business/admin_business.py`

**Step 2: Write the failing test**

```python
import unittest
from unittest.mock import MagicMock, AsyncMock


class TestAdminBusiness(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_db = MagicMock()

    async def test_get_all_users(self):
        """Test getting all users for admin"""
        from app.business.admin_business import AdminBusiness
        
        mock_users = [
            {"_id": "user_1", "email": "user1@example.com", "role": "user"},
            {"_id": "user_2", "email": "user2@example.com", "role": "admin"},
        ]
        
        mock_cursor = MagicMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=mock_users)
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.find = MagicMock(return_value=mock_cursor)
        
        result = await AdminBusiness.get_all_users(
            db=self.mock_db,
            skip=0,
            limit=10
        )
        
        self.assertEqual(len(result), 2)

    async def test_update_user_role(self):
        """Test updating user role"""
        from app.business.admin_business import AdminBusiness
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        
        result = await AdminBusiness.update_user_role(
            user_id="user_123",
            new_role="admin",
            db=self.mock_db
        )
        
        self.assertTrue(result)

    async def test_update_user_status(self):
        """Test updating user status"""
        from app.business.admin_business import AdminBusiness
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        
        result = await AdminBusiness.update_user_status(
            user_id="user_123",
            is_active=False,
            db=self.mock_db
        )
        
        self.assertTrue(result)

    async def test_get_system_stats(self):
        """Test getting system statistics"""
        from app.business.admin_business import AdminBusiness
        
        self.mock_db.users = MagicMock()
        self.mock_db.users.count_documents = AsyncMock(return_value=100)
        
        self.mock_db.chat_sessions = MagicMock()
        self.mock_db.chat_sessions.count_documents = AsyncMock(return_value=500)
        
        self.mock_db.chat_messages = MagicMock()
        self.mock_db.chat_messages.count_documents = AsyncMock(return_value=5000)
        
        result = await AdminBusiness.get_system_stats(db=self.mock_db)
        
        self.assertEqual(result["users_count"], 100)
        self.assertEqual(result["sessions_count"], 500)
        self.assertEqual(result["messages_count"], 5000)


if __name__ == "__main__":
    unittest.main()
```

**Step 3: Run test**

Run: `cd justime_backend && python -m pytest tests/business/test_admin_business.py -v`

**Step 4: Commit**

```bash
git add justime_backend/tests/business/test_admin_business.py
git commit -m "test: add admin business tests"
```

---

## Task 11: 前端组件测试 - Auth Forms

**Files:**
- Create: `justime_agent/src/components/auth/__tests__/LoginForm.test.tsx`
- Create: `justime_agent/src/components/auth/__tests__/RegisterForm.test.tsx`
- Test: `justime_agent/src/components/auth/LoginForm.tsx`
- Test: `justime_agent/src/components/auth/RegisterForm.tsx`

**Step 1: Write the failing test for LoginForm**

```typescript
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../LoginForm'

global.fetch = jest.fn()

describe('LoginForm', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>
  const mockOnSuccess = jest.fn()
  const mockOnForgotPassword = jest.fn()

  beforeEach(() => {
    mockFetch.mockClear()
    mockOnSuccess.mockClear()
    mockOnForgotPassword.mockClear()
  })

  it('should render login form', () => {
    render(<LoginForm onSuccess={mockOnSuccess} onForgotPassword={mockOnForgotPassword} />)
    
    expect(screen.getByLabelText(/邮箱/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/密码/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument()
  })

  it('should submit with valid credentials', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
    } as Response)

    render(<LoginForm onSuccess={mockOnSuccess} onForgotPassword={mockOnForgotPassword} />)
    
    await user.type(screen.getByLabelText(/邮箱/i), 'test@example.com')
    await user.type(screen.getByLabelText(/密码/i), 'password123')
    await user.click(screen.getByRole('button', { name: /登录/i }))
    
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  it('should show error for invalid credentials', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    } as Response)

    render(<LoginForm onSuccess={mockOnSuccess} onForgotPassword={mockOnForgotPassword} />)
    
    await user.type(screen.getByLabelText(/邮箱/i), 'test@example.com')
    await user.type(screen.getByLabelText(/密码/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /登录/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/登录失败/i)).toBeInTheDocument()
    })
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    
    render(<LoginForm onSuccess={mockOnSuccess} onForgotPassword={mockOnForgotPassword} />)
    
    await user.click(screen.getByRole('button', { name: /登录/i }))
    
    expect(screen.getByText(/请输入邮箱/i)).toBeInTheDocument()
    expect(screen.getByText(/请输入密码/i)).toBeInTheDocument()
  })

  it('should call onForgotPassword when clicked', async () => {
    const user = userEvent.setup()
    
    render(<LoginForm onSuccess={mockOnSuccess} onForgotPassword={mockOnForgotPassword} />)
    
    await user.click(screen.getByText(/忘记密码/i))
    
    expect(mockOnForgotPassword).toHaveBeenCalled()
  })
})
```

**Step 2: Run test**

Run: `cd justime_agent && npm test -- src/components/auth/__tests__/LoginForm.test.tsx`

**Step 3: Commit**

```bash
git add justime_agent/src/components/auth/__tests__/
git commit -m "test: add auth form component tests"
```

---

## Task 12: 添加测试覆盖率配置

**Files:**
- Modify: `justime_agent/package.json`
- Modify: `justime_agent/jest.config.js`

**Step 1: Update jest.config.js for coverage**

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/index.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
}

module.exports = createJestConfig(customJestConfig)
```

**Step 2: Add coverage scripts to package.json**

```json
{
  "scripts": {
    "test:coverage": "jest --coverage",
    "test:coverage:watch": "jest --coverage --watch",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

**Step 3: Run coverage report**

Run: `cd justime_agent && npm run test:coverage`

**Step 4: Commit**

```bash
git add justime_agent/jest.config.js justime_agent/package.json
git commit -m "chore: configure test coverage thresholds and reporting"
```

---

## Task 13: 添加后端 pytest 配置

**Files:**
- Create: `justime_backend/pytest.ini`
- Create: `justime_backend/requirements-test.txt`

**Step 1: Create pytest.ini**

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --strict-markers
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow running tests
asyncio_mode = auto
```

**Step 2: Create requirements-test.txt**

```
pytest>=7.0.0
pytest-asyncio>=0.21.0
pytest-cov>=4.0.0
httpx>=0.24.0
```

**Step 3: Commit**

```bash
git add justime_backend/pytest.ini justime_backend/requirements-test.txt
git commit -m "chore: add pytest configuration and test dependencies"
```

---

## Task 14: 创建测试文档

**Files:**
- Create: `docs/testing.md`

**Step 1: Create testing documentation**

```markdown
# 测试指南

## 概述

本文档描述了聚思项目的测试策略和指南。

## 前端测试 (justime_agent)

### 技术栈
- Jest - 测试运行器
- React Testing Library - React 组件测试
- @testing-library/user-event - 用户交互模拟

### 运行测试

\`\`\`bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- path/to/test.test.ts

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式
npm test -- --watch
\`\`\`

### 测试结构

\`\`\`
src/
├── components/
│   └── __tests__/
│       └── Component.test.tsx
├── hooks/
│   └── __tests__/
│       └── useHook.test.ts
├── lib/
│   └── __tests__/
│       └── util.test.ts
└── app/api/
    └── __tests__/
        └── route.test.ts
\`\`\`

### 测试命名约定

- 测试文件: `*.test.ts` 或 `*.test.tsx`
- 测试目录: `__tests__/`
- 测试描述: 使用中文描述测试意图

### 覆盖率目标

- 语句覆盖率: ≥ 50%
- 分支覆盖率: ≥ 50%
- 函数覆盖率: ≥ 50%
- 行覆盖率: ≥ 50%

## 后端测试 (justime_backend)

### 技术栈
- pytest - 测试运行器
- pytest-asyncio - 异步测试支持
- unittest - 内置测试框架

### 运行测试

\`\`\`bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/services/test_user_service.py

# 运行带覆盖率
pytest --cov=app --cov-report=html

# 运行特定标记的测试
pytest -m unit
pytest -m integration
\`\`\`

### 测试结构

\`\`\`
tests/
├── services/
│   └── test_service_name.py
├── business/
│   └── test_business_name.py
└── __init__.py
\`\`\`

## 最佳实践

### 1. 测试隔离
每个测试应该独立运行，不依赖其他测试的状态。

### 2. 使用 Mock
对外部依赖使用 mock 避免真实调用。

### 3. 描述性命名
测试名称应清晰描述被测试的行为。

### 4. 测试边界
测试正常路径和边界情况。

### 5. 快速执行
测试应该快速执行，避免不必要的等待。
```

**Step 2: Commit**

```bash
git add docs/testing.md
git commit -m "docs: add testing guide documentation"
```

---

## Task 15: 添加 CI 测试脚本

**Files:**
- Create: `scripts/run-tests.sh`

**Step 1: Create test runner script**

```bash
#!/bin/bash

# 前端测试
echo "Running frontend tests..."
cd justime_agent
npm ci
npm run test:ci
FRONTEND_EXIT=$?

# 后端测试
echo "Running backend tests..."
cd ../justime_backend
pip install -r requirements-test.txt
pip install -r requirements.txt
pytest --cov=app --cov-report=xml --cov-report=html
BACKEND_EXIT=$?

# 返回结果
if [ $FRONTEND_EXIT -eq 0 ] && [ $BACKEND_EXIT -eq 0 ]; then
    echo "All tests passed!"
    exit 0
else
    echo "Some tests failed!"
    exit 1
fi
```

**Step 2: Make script executable**

Run: `chmod +x scripts/run-tests.sh`

**Step 3: Commit**

```bash
git add scripts/run-tests.sh
git commit -m "chore: add unified test runner script"
```

---

## Summary

This plan establishes comprehensive test coverage for the Justime project:

**Frontend Tests Added:**
1. useAuth hook tests
2. useLLMConfig hook tests  
3. useChatSessions hook tests
4. Time utils tests
5. Auth API route tests
6. Auth form component tests

**Backend Tests Added:**
1. SecurityService tests
2. SessionService tests
3. AuthBusiness tests
4. ChatBusiness tests
5. AdminBusiness tests

**Infrastructure:**
1. Coverage configuration
2. Pytest setup
3. Testing documentation
4. CI test runner script
