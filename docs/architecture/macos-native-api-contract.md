# macOS Native API Contract

This document specifies the exact API, authentication, and SSE contract that the macOS native shell must follow. The native app reuses the existing Web/FastAPI endpoints without modification; this contract prevents endpoint drift between the web frontend and the native shell.

## Base URL Resolution

The native shell communicates with the same backend as the web frontend. All endpoint paths listed below are **relative to the BFF origin** (the Next.js API proxy), which forwards requests to FastAPI at `/api/v1/*`.

In production the BFF origin is derived from the app's deployment domain. During local development it defaults to `http://localhost:3000`. The native shell must never hardcode the backend FastAPI port (`8080`) directly; all requests go through the BFF proxy layer, which attaches authentication cookies and handles CORS.

The web frontend's endpoint constants are defined in `justime_agent/src/lib/api/endpoints.ts`. The native shell must consume the same relative paths.

## Authentication

The backend issues two HttpOnly secure cookies on successful login or token refresh:

| Cookie | Purpose |
|--------|---------|
| `access_token` | Short-lived JWT (30 minutes). Set on login, register, and refresh. |
| `refresh_token` | Long-lived JWT (7 days, or 30 days when `rememberMe` is true). Set on login, register, and refresh. |

Both cookies are set with `httponly=True`, `secure=True` (in production), `samesite=none` (in production), and `path=/`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user. Sets both cookies on success. |
| POST | `/api/auth/login` | Login. Sets both cookies; respects `rememberMe`. |
| POST | `/api/auth/refresh` | Refresh access token. Reads `refresh_token` from cookies, returns new pair. |
| POST | `/api/auth/logout` | Clears both cookies. |
| GET | `/api/auth/me` | Returns the current authenticated user. |
| GET | `/api/auth/profile` | Returns the current user's profile. |
| PUT | `/api/auth/profile` | Updates the current user's profile. |

### Native Keychain Guidance

The native shell **must** use the same backend login, refresh, and logout endpoints and **must** preserve HttpOnly cookie semantics. The BFF layer handles cookie forwarding automatically; the native shell does not need to manage cookies directly if it uses `WKWebView` or equivalent cookie-sharing mechanisms.

Native keychain storage may cache only non-cookie app configuration (e.g. user preferences, last-used model) until a separate security design is approved. Tokens must never be extracted from HttpOnly cookies into plaintext storage.

## Chat And SSE

Chat streaming uses Server-Sent Events over a POST request to the BFF stream endpoint.

### Request

- **Method**: `POST`
- **Endpoint**: `/api/chat/stream`
- **Content-Type**: `application/json`
- **Body fields**:
  - `message` (string, required) -- the user message
  - `sessionId` (string, optional) -- existing session to continue; omit to start a new session
  - `runtimeModelId` (string, optional) -- override the default model for this request

### Resume

- **Header**: `Last-Event-ID`
- **Value**: The `id` field of the last successfully received SSE event.
- **Event ID format**: `{sessionId}:{messageId}:{tokenIndex}`
- The backend restores the stream context from Redis and resumes from the token offset. Stream context TTL is 5 minutes.

### SSE Events

The server sends `data:` lines as JSON objects. Each object contains an `event` field indicating its type. Events arrive in this order:

| Event | Description |
|-------|-------------|
| `start` | Stream started. Contains `conversationId` and `messageId`. |
| `token` | A content fragment. Contains `content` (the incremental text) and `messageId`. Sent repeatedly. |
| `metadata` | Session and model information. |
| `usage` | Token usage statistics. Contains `promptTokens`, `completionTokens`, `totalTokens`. |
| `done` | Stream complete. Contains `messageId`. |
| `error` | An error occurred. Contains `message` (human-readable error string). |

### Heartbeats

Lines beginning with `:` are SSE comment heartbeats sent every 15 seconds to keep the connection alive. The native shell **must** ignore these lines. Example: `: heartbeat` and `: timeout`.

### Connection Limits

- Maximum connection duration: 300 seconds (5 minutes).
- The backend sends a `: timeout` comment before closing a connection that exceeds this limit.

### Client-side Retry

The web frontend implements exponential backoff retry (up to 3 attempts). The native shell should implement equivalent retry logic and use the `Last-Event-ID` header for resume on reconnect.

## TaskProcess Workspace

The TaskProcess endpoints manage structured task workflows, evidence, knowledge outputs, and vault configuration. All paths are relative to the BFF origin.

| Family | Method | Path | Description |
|--------|--------|------|-------------|
| List/Create | GET, POST | `/api/task-processes` | List all task processes or create a new one. |
| Detail | GET, PUT, DELETE | `/api/task-processes/{taskId}` | Get, update, or delete a specific task process. |
| Agent | POST | `/api/task-processes/{taskId}/agent` | Interact with the task process agent. |
| Evidence | GET, POST | `/api/task-processes/{taskId}/evidence` | List or add evidence for a task process. |
| Time Log | POST | `/api/task-processes/{taskId}/evidence/time-log` | Add a time log entry to evidence. |
| Knowledge Outputs | GET, POST | `/api/task-processes/{taskId}/knowledge-outputs` | List or create knowledge outputs. |
| Generate Knowledge | POST | `/api/task-processes/{taskId}/knowledge-outputs/generate` | Trigger knowledge output generation. |
| Knowledge Output Detail | GET | `/api/task-processes/knowledge-outputs/{outputId}` | Get a specific knowledge output. |
| Publish Knowledge | POST | `/api/task-processes/knowledge-outputs/{outputId}/publish` | Publish a knowledge output. |
| Rollback Knowledge | POST | `/api/task-processes/knowledge-outputs/{outputId}/rollback` | Rollback a published knowledge output. |
| Vault Config | GET, PUT | `/api/task-processes/vault-config` | Get or update vault configuration. |

The native shell must use the same endpoint paths and HTTP methods. Do not introduce native-only routes.

## Knowledge And Local Files

Knowledge endpoints manage documents, upload, rebuild, and content retrieval.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/knowledge/files` | List knowledge files. |
| GET | `/api/knowledge/files/{filename}` | Get a specific file. |
| POST | `/api/knowledge/upload` | Upload a file. |
| POST | `/api/knowledge/rebuild` | Rebuild the knowledge index. |
| GET | `/api/knowledge/rebuild/status/{taskId}` | Check rebuild status. |
| GET | `/api/knowledge/content?path=...&max_chars=...` | Get file content with optional truncation. |
| GET | `/api/knowledge/raw?path=...` | Get raw file content. |
| POST | `/api/knowledge/chunked/init` | Initialize chunked upload. |
| POST | `/api/knowledge/chunked/chunk` | Upload a chunk. |
| POST | `/api/knowledge/chunked/complete` | Complete chunked upload. |
| GET | `/api/knowledge/chunked/status/{uploadId}` | Check chunked upload status. |
| DELETE | `/api/knowledge/chunked/{uploadId}` | Cancel chunked upload. |

For local file access on macOS, the native shell should use standard file system APIs. Knowledge endpoints are for server-side RAG indexing only.

## Error Handling

The backend returns standard HTTP status codes. SSE `error` events carry a `message` field with a human-readable description.

Common error scenarios the native shell must handle:

| Status | Scenario | Handling |
|--------|----------|----------|
| 401 | Missing or expired access token | Call `/api/auth/refresh` to obtain a new token pair, then retry the original request. |
| 403 | Insufficient permissions | Display an authorization error to the user. |
| 404 | Resource not found (session, message, task) | Surface a "not found" message; do not retry. |
| 400 | Invalid request payload | Log the validation error; surface to user for correction. |
| 429 | Rate limit exceeded | Back off and retry after the server-specified interval. |
| 500 | Server error | Retry with backoff; surface a generic error after exhausting retries. |

For SSE streams, a non-200 HTTP response before the stream starts should be treated as a connection error. Mid-stream errors arrive as `error` events within the SSE stream.

## Non-Goals

This document is a contract for the native shell to follow. The following are explicitly out of scope:

- **No endpoint renames.** All paths must match the existing web frontend constants in `justime_agent/src/lib/api/endpoints.ts`.
- **No native-only backend routes.** The native shell consumes the same API surface as the web frontend. If a new endpoint is needed, it must be added to the shared backend and this document updated.
- **No cookie name changes.** The `access_token` and `refresh_token` cookie names are fixed by the backend and must not be changed for the native shell.
- **No SSE event format changes.** The event types (`start`, `token`, `metadata`, `usage`, `done`, `error`) and the event ID format (`{sessionId}:{messageId}:{tokenIndex}`) are fixed by the backend.
- **No authentication redesign.** The HttpOnly cookie-based JWT flow is the single source of truth. A separate security design is required before any token storage changes are approved.
