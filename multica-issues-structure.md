# Jushi (聚时) — Multica Issue 编排方案

> 基于 `parent_issue_id` 依赖链 + `agent_reviewer` 自动 QA 的流水线式项目推进方案。
> 所有子 Issue 分配给 **执行工程师 GLM-5.0**，Daemon 调度器按依赖顺序自动执行。

---

## 依赖拓扑总览

```
Phase-1 (P0 安全基线)          ← 无依赖，最先执行
  ├── 1.1 ~ 1.6 (子 Issue)
  │
Phase-2 (架构与代码治理)        ← parent: Phase-1
  ├── 2.1 ~ 2.6 (子 Issue)
  │
Phase-3 (性能与稳定性)          ← parent: Phase-2
  ├── 3.1 ~ 3.5 (子 Issue)
  │
Phase-4 (功能补全)             ← parent: Phase-3
  ├── 4.1 ~ 4.6 (子 Issue)
  │
Phase-5 (测试与质量保障)        ← parent: Phase-4
  ├── 5.1 ~ 5.5 (子 Issue)
  │
Phase-6 (移动端与部署收尾)      ← parent: Phase-5
  ├── 6.1 ~ 6.4 (子 Issue)
```

---

## Phase-1: [基础设施] P0 安全基线加固

| 字段 | 值 |
|------|-----|
| **title** | `[基础设施] P0 安全基线加固` |
| **description** | 修复所有 P0 级安全漏洞与运行时错误，为后续开发建立安全可信的基线。此阶段是所有后续阶段的前置条件，必须全部完成后方可进入 Phase-2。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `security-auditor` |
| **labels** | `phase-1`, `security`, `P0`, `blocking` |
| **parent_issue_id** | `null` (根节点) |

### 子 Issue 列表

---

#### 1.1 — 修复客户端 userId 授权绕过漏洞

| 字段 | 值 |
|------|-----|
| **title** | `[安全-P0] 修复客户端 userId 授权绕过漏洞` |
| **description** | 日历与文档 API 路由信任客户端传入的 userId，允许跨用户访问。需在所有涉及 userId 的 BFF 路由与后端 endpoint 中，从 JWT token 提取真实用户身份，忽略客户端传入的 userId 参数。涉及文件：`jushi_agent/src/app/api/calendar/events/*/route.ts`、`jushi_agent/src/app/api/knowledge/*/route.ts`、`jushi_backend/app/api/v1/endpoints/calendar.py`、`jushi_backend/app/api/v1/endpoints/knowledge.py`。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `security-auditor` |
| **labels** | `security`, `P0` |
| **parent_issue_id** | `Phase-1` |

---

#### 1.2 — 关闭生产环境 DEBUG 模式

| 字段 | 值 |
|------|-----|
| **title** | `[安全-P0] 关闭生产环境 DEBUG 模式` |
| **description** | 后端 `app/core/config.py` 中 DEBUG 默认为 True。需：1) 将默认值改为 False；2) 仅通过环境变量 DEBUG=true 显式开启；3) 添加启动时警告日志，当生产环境检测到 DEBUG=True 时输出 CRITICAL 告警。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `security-auditor` |
| **labels** | `security`, `P0` |
| **parent_issue_id** | `Phase-1` |

---

#### 1.3 — 添加 CSRF 防护

| 字段 | 值 |
|------|-----|
| **title** | `[安全-P0] 添加 CSRF 防护到认证端点` |
| **description** | 所有认证端点（login、register、logout、refresh）缺少 CSRF 防护。需：1) 后端实现 CSRF token 生成与验证中间件；2) 登录响应中设置 CSRF cookie（SameSite=Strict）；3) 所有状态变更请求验证 CSRF token；4) 前端在请求头中携带 CSRF token。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `security-auditor` |
| **labels** | `security`, `P0` |
| **parent_issue_id** | `Phase-1` |

---

#### 1.4 — 前端 Token 校验增强

| 字段 | 值 |
|------|-----|
| **title** | `[安全-P0] 前端 Token 校验增强 — 验证有效性而非仅检查存在性` |
| **description** | 当前前端 `AuthGuard` 和 `AuthService` 仅检查 token 是否存在，不验证其有效性。需：1) 在前端添加 `/auth/me` 调用验证 token 有效性；2) 当返回 401 时自动触发 refresh 流程；3) refresh 失败则重定向到登录页；4) 添加 token 过期前的主动刷新机制。涉及文件：`jushi_agent/src/components/auth/AuthGuard.tsx`、`jushi_agent/src/lib/auth/AuthService.ts`。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `security-auditor` |
| **labels** | `security`, `P0` |
| **parent_issue_id** | `Phase-1` |

---

#### 1.5 — 修复 HTTP 状态码拼写错误

| 字段 | 值 |
|------|-----|
| **title** | `[Bug-P0] 修复 validators.py 中 HTTP_400_REQUEST 拼写错误` |
| **description** | `jushi_backend/app/core/validators.py` 中使用了 `status.HTTP_400_REQUEST`，正确应为 `status.HTTP_400_BAD_REQUEST`。此拼写错误会导致运行时 AttributeError。需全局搜索确认无其他类似错误。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `bug`, `P0` |
| **parent_issue_id** | `Phase-1` |

---

#### 1.6 — 统一错误处理规范

| 字段 | 值 |
|------|-----|
| **title** | `[规范-P0] 统一错误处理 — 消除 HTTP 200 + success:false 反模式` |
| **description** | 部分端点返回 HTTP 200 + `{success: false, error: ...}`，另一部分使用 HTTPException。需：1) 定义统一错误响应模型 `ErrorResponse`；2) 所有业务错误使用 HTTPException + 正确状态码；3) 添加全局异常处理器确保格式一致；4) 更新前端错误处理逻辑适配新格式。涉及文件：`jushi_backend/app/core/exceptions.py`、所有 endpoints 文件。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `规范`, `P0` |
| **parent_issue_id** | `Phase-1` |

---

## Phase-2: [架构] 代码结构与架构治理

| 字段 | 值 |
|------|-----|
| **title** | `[架构] 代码结构与架构治理` |
| **description** | 在安全基线稳固后，解决架构层面的技术债务：拆分单体模块、统一 API 路径、清理遗留代码、收紧 CORS 策略。此阶段为性能优化与功能开发扫清结构性障碍。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `architecture-designer` |
| **labels** | `phase-2`, `architecture`, `P1` |
| **parent_issue_id** | `Phase-1` |

### 子 Issue 列表

---

#### 2.1 — 拆分 Chat 业务单体

| 字段 | 值 |
|------|-----|
| **title** | `[架构-P1] 拆分 Chat 业务单体 (1485行 → 4 模块)` |
| **description** | `jushi_backend/app/business/chat.py` 是 1485 行的单体文件。拆分为：1) `chat_router.py` — 请求路由与参数校验；2) `chat_executor.py` — LLM 调用与流式响应；3) `chat_persistence.py` — 消息/会话持久化；4) `chat_assembler.py` — 响应组装与任务分解集成。保持所有现有功能不变，仅做结构重组。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `architecture-designer` |
| **labels** | `architecture`, `P1` |
| **parent_issue_id** | `Phase-2` |

---

#### 2.2 — 统一前端 API 调用架构

| 字段 | 值 |
|------|-----|
| **title** | `[架构-P1] 统一前端 API 调用架构 — 消除直连 MongoDB 路径` |
| **description** | 当前前端部分 API 路由（`api/database/*`、`api/documents`）直接查询 MongoDB，其余代理到后端。需：1) 将所有直接 MongoDB 访问迁移为后端 API 代理；2) 删除 `jushi_agent/src/lib/database/` 目录；3) 统一使用 `api/proxy.ts` 的代理模式；4) 更新所有前端 hooks 中的 API 调用路径。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `architecture-designer` |
| **labels** | `architecture`, `P1` |
| **parent_issue_id** | `Phase-2` |

---

#### 2.3 — 收紧 CORS 策略

| 字段 | 值 |
|------|-----|
| **title** | `[安全-P1] 收紧 CORS 策略 — 限制允许的 Methods 与 Headers` |
| **description** | 后端 CORS 配置允许所有方法和头部。需：1) 明确列出允许的 Origins（从环境变量读取）；2) 限制 Methods 为实际使用的 GET/POST/PUT/PATCH/DELETE；3) 限制 Headers 为 Content-Type/Authorization/X-CSRF-Token；4) 生产环境禁止 `allow_origins=["*"]`。涉及文件：`jushi_backend/app/core/middleware.py`。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `security-auditor` |
| **labels** | `security`, `P1` |
| **parent_issue_id** | `Phase-2` |

---

#### 2.4 — 清理遗留代码与未使用依赖

| 字段 | 值 |
|------|-----|
| **title** | `[治理-P2] 清理遗留代码与未使用依赖` |
| **description** | 1) 移除前端 package.json 中未使用的依赖（Prisma, NextAuth, Supabase, bcryptjs, jsonwebtoken）；2) 清理飞书集成残留代码（`database/dashboard`, `chat/history` 中的 TS 错误代码）；3) 删除 `.next_stale_*` 构建产物；4) 移除移动端硬编码的本地路径和 ngrok 地址；5) 更新过时的 README 文档。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `cleanup`, `P2` |
| **parent_issue_id** | `Phase-2` |

---

#### 2.5 — 集成 Rate Limiter 中间件

| 字段 | 值 |
|------|-----|
| **title** | `[功能-P1] 将 Rate Limiter 接入 FastAPI 中间件链` |
| **description** | `jushi_backend/app/core/rate_limiter.py` 已实现但未集成。需：1) 在 `app/core/middleware.py` 中注册 rate limiter 中间件；2) 按端点配置不同限速策略（auth 端点严格、chat 端点适中、健康检查豁免）；3) 将存储后端从内存迁移到 Redis（为 Phase-3 的 Redis 集成做准备）。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `feature`, `P1` |
| **parent_issue_id** | `Phase-2` |

---

#### 2.6 — API Keys 不再解密发送到前端

| 字段 | 值 |
|------|-----|
| **title** | `[安全-P1] API Keys 不再解密发送到前端 — 仅返回掩码值` |
| **description** | 当前 Admin API Keys 端点将解密后的 API Key 发送到前端。需：1) 后端列表接口返回掩码值（如 `sk-****abcd`）；2) 仅在创建时返回一次完整值；3) 前端显示掩码值；4) 确认所有日志中不记录明文 Key。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `security-auditor` |
| **labels** | `security`, `P1` |
| **parent_issue_id** | `Phase-2` |

---

## Phase-3: [性能] 性能与稳定性提升

| 字段 | 值 |
|------|-----|
| **title** | `[性能] 性能与稳定性提升` |
| **description** | 在架构治理完成后，解决性能瓶颈：Redis 集成、文件流式上传、异步索引重建、MongoDB 连接优化。此阶段确保系统可承受生产负载。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `phase-3`, `performance`, `P1` |
| **parent_issue_id** | `Phase-2` |

### 子 Issue 列表

---

#### 3.1 — Redis 缓存层集成

| 字段 | 值 |
|------|-----|
| **title** | `[性能-P1] Redis 缓存层集成 — 热数据缓存与会话管理` |
| **description** | Docker Compose 已包含 Redis 但后端未使用。需：1) 添加 Redis 连接管理（`app/core/redis.py`）；2) 将 Rate Limiter 存储迁移到 Redis；3) 缓存 LLM 模型配置与预设列表（TTL 5min）；4) 缓存用户 Profile 数据（TTL 10min）；5) 添加 Redis 健康检查到 `/health` 端点。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `performance`, `P1` |
| **parent_issue_id** | `Phase-3` |

---

#### 3.2 — 知识库文件流式上传

| 字段 | 值 |
|------|-----|
| **title** | `[性能-P1] 知识库文件流式上传 — 替代全量内存读取` |
| **description** | 当前知识库上传将整个文件读入内存（50MB 上限），大文件可能导致 OOM。需：1) 后端使用 `StreamingResponse`/`UploadFile` 流式接收；2) 磁盘缓冲写入代替内存缓冲；3) 添加上传进度回调；4) 前端添加上传进度条组件。涉及文件：`jushi_backend/app/api/v1/endpoints/knowledge.py`、`jushi_backend/app/services/knowledge_service.py`。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `performance`, `P1` |
| **parent_issue_id** | `Phase-3` |

---

#### 3.3 — 知识库索引异步重建

| 字段 | 值 |
|------|-----|
| **title** | `[性能-P1] 知识库索引异步重建 — 不再阻塞 API` |
| **description** | 当前索引重建是同步操作，会阻塞 API 响应。需：1) 使用 FastAPI `BackgroundTasks` 或 Celery 异步执行索引重建；2) 添加重建任务状态查询端点；3) 前端添加重建进度显示；4) 防止并发重建冲突。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `performance`, `P1` |
| **parent_issue_id** | `Phase-3` |

---

#### 3.4 — MongoDB 连接配置优化

| 字段 | 值 |
|------|-----|
| **title** | `[配置-P1] MongoDB 连接配置优化 — 移除 directConnection 并添加连接池` |
| **description** | 生产配置中使用 `directConnection=True`，不适合副本集部署。需：1) 移除 `directConnection` 参数，通过环境变量控制；2) 配置连接池参数（maxPoolSize、minPoolSize、maxIdleTimeMS）；3) 添加连接超时与重试策略；4) 副本集 Read Preference 配置。涉及文件：`jushi_backend/app/database/database.py`。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `configuration`, `P1` |
| **parent_issue_id** | `Phase-3` |

---

#### 3.5 — 请求日志脱敏

| 字段 | 值 |
|------|-----|
| **title** | `[安全-P1] 请求日志脱敏 — 防止敏感数据泄露到日志` |
| **description** | 当前请求日志可能包含密码、token、API Key 等敏感信息。需：1) 实现日志脱敏过滤器（自动替换 password、token、api_key 等字段为 `***`）；2) 注册为 Python logging Filter；3) 对 request body 和 response body 进行脱敏处理；4) 确保异常堆栈中不包含明文敏感数据。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `security-auditor` |
| **labels** | `security`, `P1` |
| **parent_issue_id** | `Phase-3` |

---

## Phase-4: [功能] 功能补全与体验优化

| 字段 | 值 |
|------|-----|
| **title** | `[功能] 功能补全与体验优化` |
| **description** | 在安全与性能基础稳固后，补全缺失功能、修复遗留 TODO、提升用户体验。此阶段让产品从"可用"走向"好用"。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `phase-4`, `feature`, `P1-P2` |
| **parent_issue_id** | `Phase-3` |

### 子 Issue 列表

---

#### 4.1 — 实现忘记密码功能

| 字段 | 值 |
|------|-----|
| **title** | `[功能] 实现忘记密码功能` |
| **description** | 前端 `LoginForm.tsx:205` 标记了 TODO。需：1) 后端添加 `/auth/forgot-password` 端点（生成重置 token + 发送邮件）；2) 后端添加 `/auth/reset-password` 端点（验证 token + 更新密码）；3) 前端创建忘记密码页面与重置密码页面；4) 添加重置 token 过期机制（15min TTL）。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `feature` |
| **parent_issue_id** | `Phase-4` |

---

#### 4.2 — ChatInterface 用户身份从 Auth 系统获取

| 字段 | 值 |
|------|-----|
| **title** | `[功能] ChatInterface 用户身份从 Auth 系统获取 — 替代硬编码 'current-user'` |
| **description** | `ChatInterface.tsx:287` 中 userId 硬编码为 `'current-user'`。需：1) 从 AuthContext 获取真实用户 ID；2) 确保所有 chat API 调用使用真实 userId；3) 修复消息持久化中的 userId 归属。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `feature`, `P1` |
| **parent_issue_id** | `Phase-4` |

---

#### 4.3 — 前端 TypeScript 严格模式与类型完善

| 字段 | 值 |
|------|-----|
| **title** | `[质量-P2] 启用 TypeScript 严格模式并完善类型定义` |
| **description** | 1) 在 `tsconfig.json` 中启用 `strict: true`；2) 修复所有由此产生的类型错误；3) 为 API 响应添加完整的类型定义（替换 `any` 类型）；4) 为 Zod schema 或 Pydantic model 添加前端对应的 TypeScript 类型自动生成。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `quality`, `P2` |
| **parent_issue_id** | `Phase-4` |

---

#### 4.4 — 前端 API 路径常量化

| 字段 | 值 |
|------|-----|
| **title** | `[重构-P2] 前端 API 路径常量化 — 消除硬编码` |
| **description** | 前端 hooks 中存在大量硬编码 API 路径字符串。需：1) 创建 `lib/api/routes.ts` 统一管理所有 API 路径常量；2) 支持路径参数插值（如 `/calendar/events/${id}` → `routes.calendar.event(id)`）；3) 替换所有 hooks 中的硬编码路径；4) 添加路径变更时的编译期检查。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `refactor`, `P2` |
| **parent_issue_id** | `Phase-4` |

---

#### 4.5 — 大组件懒加载

| 字段 | 值 |
|------|-----|
| **title** | `[性能-P2] 大组件懒加载 — 减少首屏加载体积` |
| **description** | 当前所有组件同步导入。需：1) 使用 `next/dynamic` 对 BigCalendar、DocumentEditor、ChatInterface 等大组件进行懒加载；2) 添加 `Suspense` fallback 骨架屏；3) 分析 bundle 大小确认优化效果；4) 对管理后台页面（admin/*）使用独立 chunk。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `performance`, `P2` |
| **parent_issue_id** | `Phase-4` |

---

#### 4.6 — PWA 支持

| 字段 | 值 |
|------|-----|
| **title** | `[功能-P2] 添加 PWA 支持 — Service Worker + 离线缓存` |
| **description** | 1) 添加 `next-pwa` 配置；2) 创建 `manifest.json`（应用名称、图标、主题色）；3) 配置 Service Worker 缓存策略（静态资源 Cache First、API 请求 Network First）；4) 添加安装提示组件；5) 离线页面 fallback。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `feature`, `P2` |
| **parent_issue_id** | `Phase-4` |

---

## Phase-5: [质量] 测试与质量保障体系

| 字段 | 值 |
|------|-----|
| **title** | `[质量] 测试与质量保障体系` |
| **description** | 功能基本完备后，建立全面的测试覆盖。当前测试覆盖率仅 40/100，需为核心业务逻辑添加单元测试、集成测试，确保回归安全。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `phase-5`, `testing`, `quality` |
| **parent_issue_id** | `Phase-4` |

### 子 Issue 列表

---

#### 5.1 — 后端认证与授权测试套件

| 字段 | 值 |
|------|-----|
| **title** | `[测试] 后端认证与授权完整测试套件` |
| **description** | 为所有 auth endpoints 添加集成测试：1) 注册成功/重复邮箱/无效输入；2) 登录成功/错误密码/未注册用户；3) Token 刷新成功/过期 token；4) Profile 更新权限控制；5) 未认证请求 401 响应；6) CSRF token 验证测试（关联 Phase-1.3）。使用 pytest + httpx.AsyncClient。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `testing` |
| **parent_issue_id** | `Phase-5` |

---

#### 5.2 — 后端日历与知识库 API 测试套件

| 字段 | 值 |
|------|-----|
| **title** | `[测试] 后端日历与知识库 API 测试套件` |
| **description** | 1) Calendar CRUD 完整测试（创建/读取/更新/删除/日期范围过滤）；2) 日历事件权限隔离（用户 A 不可访问用户 B 的事件）；3) 知识库文件上传/列表/删除测试；4) 知识库索引重建状态测试；5) YouTube Summary Job 生命周期测试。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `testing` |
| **parent_issue_id** | `Phase-5` |

---

#### 5.3 — 前端核心组件与 Hook 测试

| 字段 | 值 |
|------|-----|
| **title** | `[测试] 前端核心组件与 Hook 测试` |
| **description** | 1) `useAuth` hook — 登录/登出/token 刷新状态流转；2) `AuthGuard` — 受保护路由重定向逻辑；3) `CalendarEvent` 组件 — 事件 CRUD 交互；4) `ChatInterface` — 消息发送与流式响应；5) `TaskDecomposer` — 任务分解输出格式验证。使用 Jest + React Testing Library。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `testing` |
| **parent_issue_id** | `Phase-5` |

---

#### 5.4 — Admin API 端到端测试

| 字段 | 值 |
|------|-----|
| **title** | `[测试] Admin API 端到端测试 — 用户管理/模型配置/统计` |
| **description** | 1) 用户管理 — 列表/状态更新/角色更新/删除；2) 模型配置 — CRUD/连接测试；3) API Key 管理 — 创建/掩码显示/更新/删除；4) 系统统计 — 数据准确性验证；5) 权限控制 — 非 admin 用户访问 admin 端点返回 403。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `testing` |
| **parent_issue_id** | `Phase-5` |

---

#### 5.5 — CI/CD 测试流水线配置

| 字段 | 值 |
|------|-----|
| **title** | `[DevOps] CI/CD 测试流水线配置 — 自动化测试门禁` |
| **description** | 1) 创建 GitHub Actions workflow（或对应 CI 配置）；2) 后端：lint (ruff) + 类型检查 (mypy) + pytest；3) 前端：lint (eslint) + 类型检查 (tsc) + jest；4) PR 合并前必须通过所有检查；5) 测试覆盖率报告上传（Codecov 或类似）；6) 添加 deploy 阶段触发条件。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `devops`, `testing` |
| **parent_issue_id** | `Phase-5` |

---

## Phase-6: [收尾] 移动端与部署收尾

| 字段 | 值 |
|------|-----|
| **title** | `[收尾] 移动端与部署收尾` |
| **description** | 项目收尾阶段：完善移动端体验、优化部署配置、产出部署文档。这是最终交付前的打磨阶段。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `phase-6`, `mobile`, `deployment` |
| **parent_issue_id** | `Phase-5` |

### 子 Issue 列表

---

#### 6.1 — 移动端环境配置标准化

| 字段 | 值 |
|------|-----|
| **title** | `[移动端] 移动端环境配置标准化 — 消除硬编码与 ngrok 依赖` |
| **description** | 1) 将所有 API 地址抽取为环境变量（`EXPO_PUBLIC_API_URL`）；2) 创建 `.env.local.example` 模板；3) 移除所有 ngrok 硬编码地址；4) 添加环境切换逻辑（dev/staging/prod）；5) 配置 app.json 中的 scheme 和 host 用于深度链接。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `mobile`, `P1` |
| **parent_issue_id** | `Phase-6` |

---

#### 6.2 — 移动端功能补全

| 字段 | 值 |
|------|-----|
| **title** | `[移动端] 移动端功能补全 — 知识库/日历管理/个人资料编辑` |
| **description** | 当前移动端仅有 Chat、Schedule 查看、Profile 查看和 Model Config。需补全：1) 知识库文档上传与管理页面；2) 日历事件 CRUD（创建/编辑/删除）；3) 个人资料编辑功能；4) Chat 历史会话列表与切换；5) 适配暗色模式。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `mobile`, `feature` |
| **parent_issue_id** | `Phase-6` |

---

#### 6.3 — Docker 部署配置优化

| 字段 | 值 |
|------|-----|
| **title** | `[部署] Docker 部署配置优化 — 健康检查/资源限制/日志管理` |
| **description** | 1) 为所有服务添加 `deploy.resources.limits`（CPU/内存限制）；2) 配置日志驱动与轮转策略（避免日志撑满磁盘）；3) 添加 `depends_on` 健康条件（确保 MongoDB 就绪后启动后端）；4) 优化 Caddyfile 配置（gzip、缓存头、安全头）；5) 创建一键部署脚本（`deploy.sh`）。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `deployment` |
| **parent_issue_id** | `Phase-6` |

---

#### 6.4 — 项目文档更新与交付

| 字段 | 值 |
|------|-----|
| **title** | `[文档] 项目文档更新与交付` |
| **description** | 1) 更新根目录 README（项目介绍、架构图、快速启动指南）；2) 更新后端 README（移除飞书相关描述，更新 API 列表）；3) 创建 `DEPLOYMENT.md` 部署手册（Docker Compose 部署、环境变量说明、备份恢复）；4) 创建 `CONTRIBUTING.md` 开发指南（代码规范、PR 流程、测试要求）；5) 归档 `文档/` 目录中的历史文档。 |
| **assignee** | `GLM-5.0` |
| **agent_reviewer** | `code-reviewer` |
| **labels** | `documentation` |
| **parent_issue_id** | `Phase-6` |

---

## 调度逻辑说明

```
Daemon 调度器行为：

1. 扫描所有 Issue，构建 parent_issue_id 依赖图
2. 找到无 parent 的根节点 → Phase-1 → 立即调度
3. Phase-1 下所有子 Issue (1.1~1.6) 可并行执行（它们共享同一 parent）
4. 当 Phase-1 的所有子 Issue 状态变为 Completed：
   → Phase-1 自动标记为 Completed
   → Phase-2 被解锁，其子 Issue (2.1~2.6) 开始调度
5. 依次类推，Phase-3 等待 Phase-2，Phase-4 等待 Phase-3...

agent_reviewer 自动 QA：

- 每个子 Issue 完成后，agent_reviewer 自动审查：
  - security-auditor → 检查安全合规性
  - architecture-designer → 检查架构合理性
  - code-reviewer → 检查代码质量
- 审查通过 → 标记 Completed
- 审查不通过 → 标记 In Progress + 添加审查意见，GLM-5.0 继续修改
```

---

## 统计

| Phase | 子 Issue 数 | 关键词 | 预估优先级 |
|-------|-----------|--------|----------|
| Phase-1 | 6 | 安全、Bug修复 | P0 - 阻塞级 |
| Phase-2 | 6 | 架构、治理 | P1 - 高优 |
| Phase-3 | 5 | 性能、稳定性 | P1 - 高优 |
| Phase-4 | 6 | 功能、体验 | P1-P2 |
| Phase-5 | 5 | 测试、DevOps | P1-P2 |
| Phase-6 | 4 | 移动端、部署 | P2 |
| **合计** | **32** | | |
·