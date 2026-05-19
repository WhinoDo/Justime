# Jushi Agent 开发指南

> 本文档是面向 AI Agent 的项目操作手册。任何被分配到此仓库任务的 Agent 都应首先阅读本文档，了解项目全貌后再动手编码。

## 项目概述

**聚石 (Jushi)** 是一个 AI 智能助手平台，集对话、日程管理、知识库、书籍分析等功能于一体。项目采用前后端分离 + 移动端的三端架构。

| 端 | 目录 | 技术栈 | 端口 |
|----|------|--------|------|
| Web 前端 | `jushi_agent/` | Next.js 14, React 18, Tailwind CSS, Radix UI | 3000 |
| 后端 | `jushi_backend/` | FastAPI, Python 3.10+, Pydantic v2, Motor (async MongoDB) | 8080 |
| 移动端 | `mobile/jushi_mobile/` | Expo 54, React Native 0.81, Expo Router | Expo Dev |

**数据层**: MongoDB 7 (主数据库 `jushi-agent`) + Redis 7 (缓存/会话/SSE 断点续传)

**网关**: Caddy 2 (反向代理 + 自动 HTTPS)

**AI 集成**: OpenAI / DeepSeek / DashScope (多模型智能路由)

## 目录结构

```
jushi-agent/
├── jushi_agent/              # Web 前端 (Next.js App Router)
│   ├── src/
│   │   ├── app/              # 页面路由 (App Router)
│   │   │   ├── api/          # Next.js API Routes (BFF 代理层)
│   │   │   ├── admin/        # 管理后台页面
│   │   │   ├── auth/         # 认证页面 (登录/注册/重置密码)
│   │   │   ├── chat/         # AI 对话页面
│   │   │   ├── calendar/     # 日程管理页面
│   │   │   ├── knowledge/    # 知识库页面
│   │   │   ├── book-analysis/# 书籍分析页面
│   │   │   └── dashboard/    # 仪表盘
│   │   ├── components/       # UI 组件
│   │   │   ├── chat/         # 对话相关组件 (ChatInterface, MessageBubble, TypewriterMessage 等)
│   │   │   ├── calendar/     # 日历组件
│   │   │   ├── auth/         # 认证组件
│   │   │   └── admin/        # 管理组件
│   │   ├── hooks/            # React Hooks (useSSEChat, useAuth 等)
│   │   ├── lib/              # 工具库
│   │   │   ├── ai/           # AI 工具 (chat-generator, emotion-analyzer, task-planner)
│   │   │   ├── api/          # API 代理 (endpoints, proxy, config)
│   │   │   ├── auth/         # 认证工具
│   │   │   ├── database/     # IndexedDB 离线存储
│   │   │   └── task/         # 任务分解
│   │   └── types/            # TypeScript 类型定义
│   ├── public/               # 静态资源 (PWA icons, sw.js)
│   ├── capacitor.config.ts   # Capacitor 混合应用配置
│   ├── android/              # Android 原生壳 (Capacitor)
│   └── jest.config.js        # 测试配置
│
├── jushi_backend/            # Python 后端 (FastAPI)
│   ├── app/
│   │   ├── api/v1/endpoints/ # API 端点
│   │   │   ├── auth.py       # 认证 (登录/注册/Token 刷新)
│   │   │   ├── chat.py       # AI 对话 (普通 + SSE 流式)
│   │   │   ├── admin.py      # 后台管理 (用户/模型配置)
│   │   │   ├── calendar.py   # 日历 CRUD
│   │   │   ├── knowledge.py  # 知识库管理
│   │   │   ├── speech.py     # 语音服务 (阿里云 ASR/TTS)
│   │   │   ├── book_analysis.py # 书籍分析
│   │   │   ├── documents.py  # 工作文档
│   │   │   ├── agent.py      # AI Agent 端点
│   │   │   └── health.py     # 健康检查
│   │   ├── business/         # 业务逻辑层
│   │   │   ├── chat_business.py    # 对话业务编排
│   │   │   ├── chat_executor.py    # LLM 调用执行器
│   │   │   ├── chat_router.py      # 模型智能路由
│   │   │   ├── chat_assembler.py   # 上下文组装
│   │   │   ├── chat_persistence.py # 消息持久化
│   │   │   ├── chat_prompt_builder.py # Prompt 构建
│   │   │   ├── chat_response_builder.py # 响应构建
│   │   │   ├── chat_retry_service.py    # 重试服务
│   │   │   └── chat_routing_service.py  # 路由服务
│   │   ├── services/         # 基础服务层
│   │   │   ├── llm_service.py       # LLM API 调用 (支持流式)
│   │   │   ├── sse_stream_service.py # SSE 流式上下文 (断点续传)
│   │   │   ├── rag_service.py       # RAG 检索增强 (LlamaIndex)
│   │   │   ├── model_router_service.py # 模型路由
│   │   │   ├── security_service.py  # 安全服务 (加密/CSRF)
│   │   │   ├── encryption_service.py # 加密服务
│   │   │   └── ...
│   │   ├── models/           # Pydantic 数据模型
│   │   ├── core/             # 核心模块 (config, middleware, redis, rate_limiter)
│   │   ├── database.py       # MongoDB 连接管理
│   │   └── main.py           # FastAPI 应用入口
│   ├── tests/                # Pytest 测试
│   └── requirements.txt      # Python 依赖
│
├── mobile/jushi_mobile/      # 移动端 (Expo)
│   ├── app/                  # Expo Router 页面
│   │   ├── (tabs)/           # 底部导航 Tab
│   │   └── settings/         # 设置页面
│   ├── components/
│   │   ├── chat/             # 对话组件 (ChatInputBox, ChatMessageList, ThinkingBubble)
│   │   └── schedule/         # 日程组件
│   ├── hooks/
│   │   ├── useChatScreenLogic.ts # 对话屏幕逻辑
│   │   └── useSSEChat.ts     # SSE 流式对话 Hook
│   ├── context/              # React Context (AuthContext)
│   └── constants/            # 常量 (api-endpoints, theme)
│
├── deployment/homelab/       # Docker Compose 部署
│   ├── docker-compose.yml
│   ├── backend/Dockerfile
│   ├── frontend/Dockerfile
│   ├── gateway/Caddyfile
│   └── scripts/              # 运维脚本
│
├── infrastructure/           # 基础设施
│   └── mongodb/              # MongoDB 部署配置
│
├── docs/                     # 设计文档与方案
├── .github/workflows/        # CI/CD (ci.yml, deploy.yml)
└── AGENTS.md                 # 本文档
```

## 核心架构

### 数据流: AI 对话

```
用户输入 → ChatInterface.tsx
         → Next.js API Route (src/app/api/chat/route.ts 或 stream/route.ts)
         → FastAPI /api/v1/chat/send 或 /api/v1/chat/stream
         → ChatBusiness (编排层)
           → ChatRouter (模型路由: auto/fast/balanced/reasoning)
           → ChatAssembler (上下文组装 + RAG 检索)
           → ChatExecutor (调用 LLM API)
           → ChatPersistence (保存消息到 MongoDB)
         → SSE 流式返回 / JSON 一次性返回
```

### 模型路由机制

`ChatRouter` 根据用户请求的 `routeMode` 选择模型调用策略:

| 模式 | 行为 |
|------|------|
| `auto` | 自动判断任务复杂度，选择快速/推理模型 |
| `fast` | 直接使用快速模型 (如 DeepSeek Chat) |
| `balanced` | 平衡模式 |
| `reasoning` | 使用推理模型 (如 DeepSeek Reasoner) |

路由优先级: `runtimeModelId` (UI下拉) > `routeMode` > 默认配置

### SSE 流式输出

- 后端: `SSEStreamService` + Redis 保存流上下文，支持 `Last-Event-ID` 断点续传
- 前端 Web: `useSSEChat` Hook + `TypewriterMessage` 组件 (打字机效果)
- 前端移动: `useSSEChat.ts` + 网络切换自动重连
- SSE 事件类型: `start` → `token`(多次) → `metadata` → `usage` → `done` / `error`

### 认证体系

- JWT (HS256) 双 Token: Access Token + Refresh Token
- Cookie-based: HttpOnly Secure Cookie (`token`, `refresh_token`)
- 前端 BFF 层 (Next.js API Routes) 负责转发，自动附带 Cookie
- 管理员角色: `admin` / `super_admin`

## 开发环境启动

### 前提条件

- Node.js 20+, npm
- Python 3.10+
- MongoDB 7 (本地或 Docker)
- Redis 7 (SSE 功能需要)

### 启动后端

```bash
cd jushi_backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
# 复制并配置 .env (参考 .env.example)
cp .env.example .env
python start.py
# 后端运行在 http://127.0.0.1:8080
# API 文档: http://127.0.0.1:8080/docs
```

### 启动前端

```bash
cd jushi_agent
npm install
# 复制并配置 .env.local (参考 .env.example)
cp .env.example .env.local
npm run dev
# 前端运行在 http://localhost:3000
```

### 启动移动端

```bash
cd mobile/jushi_mobile
npm install
cp .env.local.example .env.local
npm start    # Expo Dev Server
```

### Docker Compose 一键启动

```bash
cd deployment/homelab
cp .env.example .env   # 编辑配置
docker compose up -d
```

## 后端 API 路由一览

所有后端 API 前缀为 `/api/v1`。

| 路由前缀 | 模块 | 说明 |
|----------|------|------|
| `/auth/*` | 认证 | 登录/注册/Token 刷新/密码重置 |
| `/chat/send` | 对话 | 普通对话 (JSON 一次性返回) |
| `/chat/stream` | 对话 | SSE 流式对话 (打字机效果) |
| `/chat/sessions` | 对话 | 会话管理 |
| `/admin/*` | 管理 | 用户管理/模型配置/统计 |
| `/calendar/*` | 日历 | 事件 CRUD |
| `/knowledge/*` | 知识库 | 文档管理/RAG (可选依赖) |
| `/book-analysis/*` | 书籍 | NotebookLM 集成 |
| `/speech/*` | 语音 | 阿里云 ASR/TTS |
| `/documents/*` | 文档 | 工作文档 |
| `/agent/*` | Agent | OpenClaw 集成 |
| `/health` | 健康检查 | 服务状态 |

## 前端 API 代理层

前端 `src/app/api/` 是 BFF 代理层，**不是业务逻辑**。它负责:
- 转发请求到后端 `/api/v1/*`
- 自动附带认证 Cookie
- 处理 CORS

前端页面组件直接调用 `src/lib/api/endpoints.ts` 中定义的端点，由代理层转发。

## 数据库 (MongoDB)

数据库名: `jushi-agent`

主要集合:

| 集合 | 说明 |
|------|------|
| `users` | 用户信息 |
| `chat_sessions` | 对话会话 |
| `chat_messages` | 对话消息 |
| `conversations` | 会话 (旧) |
| `calendar_events` | 日历事件 |
| `llm_usage_events` | LLM 用量记录 |
| `llm_token_usage_daily` | Token 日用量 |
| `system_llm_configs` | LLM 模型配置 |
| `book_analysis_projects` | 书籍分析项目 |
| `task_timing_events` | 任务计时 |
| `task_timing_profiles` | 任务计时配置 |
| `work_documents` | 工作文档 |

## 编码规范

### 后端 (Python / FastAPI)

- **分层**: `endpoints` → `business` → `services`，严格单向依赖
- `endpoints/`: 只做参数校验和 HTTP 响应，不写业务逻辑
- `business/`: 业务编排层，协调多个 service
- `services/`: 基础服务，可被多个 business 调用
- **数据模型**: 使用 Pydantic v2 `BaseModel`，字段验证用 `@field_validator`
- **异步**: 全部使用 `async/await`，数据库操作用 Motor (async MongoDB driver)
- **命名**: 文件名 `snake_case`，类名 `PascalCase`，函数名 `snake_case`
- **日志**: 使用 `logging.getLogger(__name__)`，不要 `print()`

### 前端 (TypeScript / React / Next.js)

- **App Router**: 页面放在 `src/app/` 对应路由下
- **组件**: 函数式组件 + Hooks，放在 `src/components/` 按功能分目录
- **API 代理**: 所有后端请求通过 `src/app/api/` 代理，不要直接从前端调用后端
- **状态管理**: React Hooks (useState/useContext)，对话状态用 `useSSEChat`
- **样式**: Tailwind CSS + shadcn/ui 组件 (`src/components/ui/`)
- **类型**: 所有 API 请求/响应必须有 TypeScript 类型定义 (`src/types/`)
- **命名**: 文件名 `PascalCase`(组件) 或 `camelCase`(工具)，组件导出用命名导出

### 移动端 (Expo / React Native)

- **路由**: Expo Router (file-based)，页面在 `app/` 目录
- **组件**: 与 Web 端独立，不共享代码
- **网络**: SSE 对话复用 `useSSEChat` Hook，支持断线重连
- **导航**: 底部 Tab + Stack 导航

## 测试

### 前端测试

```bash
cd jushi_agent
npm test                  # 运行所有测试
npm run test:watch        # 监听模式
npm run test:coverage     # 覆盖率
```

测试框架: Jest + React Testing Library
测试文件: 与源文件同目录 `__tests__/` 或 `*.test.ts`

### 后端测试

```bash
cd jushi_backend
pip install pytest pytest-asyncio pytest-cov httpx
pytest tests/ -v --tb=short
```

测试框架: Pytest + pytest-asyncio
需要环境变量: `JWT_SECRET`, `MONGODB_URI` 等 (测试用值即可)

## 常见开发任务速查

### 新增后端 API 端点

1. 在 `jushi_backend/app/models/` 添加 Pydantic 请求/响应模型
2. 在 `jushi_backend/app/services/` 添加服务方法 (如有新逻辑)
3. 在 `jushi_backend/app/business/` 添加业务编排 (如需跨服务协调)
4. 在 `jushi_backend/app/api/v1/endpoints/` 添加路由处理函数
5. 在 `jushi_backend/app/api/v1/api.py` 注册路由
6. 编写测试

### 新增前端页面

1. 在 `jushi_agent/src/app/` 创建路由目录和 `page.tsx`
2. 在 `jushi_agent/src/components/` 创建组件
3. 如需后端数据: 在 `src/app/api/` 添加代理路由，在 `src/lib/api/endpoints.ts` 添加端点定义
4. 在 `src/types/` 添加类型定义

### 新增对话功能 (涉及 SSE)

1. 后端: 在 `chat_business.py` 添加新事件类型
2. 后端: 在 `sse_stream_service.py` 注册新事件
3. 前端 Web: 在 `useSSEChat.ts` 添加事件回调
4. 前端 Web: 在 `ChatInterface.tsx` 或 `TypewriterMessage.tsx` 处理新事件展示
5. 前端移动: 同步更新 `mobile/jushi_mobile/hooks/useSSEChat.ts`

### 修改数据模型 (MongoDB)

- 此项目无 ORM Migration，MongoDB 是 Schema-less
- 在 `jushi_backend/app/models/` 修改 Pydantic 模型即可
- 在 `jushi_backend/app/database/indexes.py` 添加新索引 (如需)
- 向后兼容: 新字段必须有默认值

## 关键文件索引

| 用途 | 文件路径 |
|------|----------|
| 后端入口 | `jushi_backend/app/main.py` |
| 后端配置 | `jushi_backend/app/core/config.py` |
| 路由注册 | `jushi_backend/app/api/v1/api.py` |
| 对话核心 | `jushi_backend/app/business/chat_business.py` |
| SSE 流服务 | `jushi_backend/app/services/sse_stream_service.py` |
| LLM 调用 | `jushi_backend/app/services/llm_service.py` |
| 模型路由 | `jushi_backend/app/services/model_router_service.py` |
| RAG 服务 | `jushi_backend/app/services/rag_service.py` |
| 对话模型 | `jushi_backend/app/models/chat.py` |
| 前端入口页 | `jushi_agent/src/app/page.tsx` |
| 对话页面 | `jushi_agent/src/app/chat/page.tsx` |
| 对话组件 | `jushi_agent/src/components/chat/ChatInterface.tsx` |
| SSE Hook | `jushi_agent/src/hooks/useSSEChat.ts` |
| 打字机组件 | `jushi_agent/src/components/chat/TypewriterMessage.tsx` |
| API 端点 | `jushi_agent/src/lib/api/endpoints.ts` |
| API 代理 | `jushi_agent/src/lib/api/proxy.ts` |
| 认证 Hook | `jushi_agent/src/hooks/useAuth.ts` |
| 移动端对话 | `mobile/jushi_mobile/hooks/useSSEChat.ts` |
| Docker 部署 | `deployment/homelab/docker-compose.yml` |
| CI 配置 | `.github/workflows/ci.yml` |

## 安全注意事项

- **永远不要**将 `.env` 文件提交到 Git (已在 `.gitignore` 中)
- JWT Secret 至少 32 字符，用 `openssl rand -hex 32` 生成
- 后端 API Key 等敏感信息通过环境变量注入，不硬编码
- `chat.py` 中的 `sessionId`、`taskId` 等字段有正则校验防注入
- CSRF 保护: 后端 `security_service.py` 实现
- 速率限制: 后端 `rate_limiter.py` 实现 (Redis)
- 前端 Cookie: HttpOnly + Secure + SameSite

## CI/CD

- **CI** (`.github/workflows/ci.yml`): 推送到 main/master 时触发
  - Code Quality: lint + typecheck (前端 + 移动端)
  - Frontend Tests: Jest + 覆盖率 + build 检查
  - Mobile Tests: typecheck
  - Backend Tests: Pytest + MongoDB service
  - Security Scan: Trivy
- **Deploy** (`.github/workflows/deploy.yml`): 推送到 main 或打 tag 时触发
  - 构建 Docker 镜像并推送到 DockerHub
  - SSH 部署到 staging/production

## 已知问题与注意事项

1. `jushi_backend/.venv/` 和 `infrastructure/data/db/` 被误提交到 Git，不要修改这些目录
2. `knowledge` 模块 (LlamaIndex) 启动时可能因依赖缺失而跳过，这是预期行为
3. 前端 `src/app/api/` 是代理层，业务逻辑应放在组件或 `lib/` 中
4. 移动端和 Web 端的 `useSSEChat` 是独立实现，修改时需同步更新两端
5. 后端无数据库 Migration 工具，新增集合/索引需手动在 `database/indexes.py` 中添加
