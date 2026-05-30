# 聚石 (Jushi) → 考研学习助手 转型计划

> 文档目的：为项目从"AI 对话+日程+知识库泛用平台"转型为"考研任务分配与学习计划制定工具"提供完整路线图。
> 
> 生成日期：2026-05-30

---

## 一、项目现状分析

### 1.1 当前技术栈

| 层 | 技术 | 版本 | 备注 |
|----|------|------|------|
| **Web 前端** | Next.js (App Router) + React 18 + Tailwind CSS + Radix UI | Next 14.2 | BFF 代理层转发后端 |
| **后端** | FastAPI + Pydantic v2 + Motor (async MongoDB) | Python 3.10+ | 分层架构 endpoint→business→service |
| **数据库** | MongoDB 7 + Redis 7 | - | MongoDB 主存储，Redis 缓存/SSE |
| **AI Agent** | Smolagents (CodeAgent) + LiteLLM + DuckDuckGo Search | smolagents>=1.0 | 多模型路由，支持工具调用 |
| **AI 模型** | DeepSeek / DashScope / MiniMax | 多 Provider | 管理后台动态配置 |
| **Agent 框架** | OpenClaw (容器内 CLI gateway) | 2026.3.11 | 特殊任务链路，WebSocket 网关 |
| **NotebookLM** | notebooklm-py | 已集成 | 知识库问答/Source 管理/音频生成 |
| **飞书** | lark-oapi | >=1.2.0 | requirements.in 已声明，环境变量已配 |
| **移动端** | Expo 54 + React Native 0.81 + Expo Router | - | 独立实现，Tab 导航 |
| **部署** | Docker Compose + Caddy 2 + GitHub Actions CI/CD | - | 自动化构建/测试/部署 |

### 1.2 已有核心能力

| 能力 | 状态 | 关键文件 |
|------|------|----------|
| AI 对话 (普通 + SSE 流式) | ✅ 完善 | `chat_business.py`, `useSSEChat.ts` |
| 模型智能路由 (auto/fast/balanced/reasoning) | ✅ 完善 | `chat_router.py`, `model_router_service.py` |
| Agent 工具调用 (日历/搜索/知识库) | ✅ 完善 | `agent_service.py`, `calendar_tools.py` |
| NotebookLM 集成 (Source CRUD + 问答) | ✅ 完善 | `notebooklm_service.py` |
| OpenClaw 特殊任务 | ✅ 基础 | `openclaw_service.py` |
| 飞书 SDK | ⚠️ 依赖已声明，环境变量已配，但无明确业务代码 | `requirements.in` 中 `lark-oapi>=1.2.0` |
| 日历事件管理 | ✅ 基础 CRUD | `calendar.py`, `calendar_tools.py` |
| 知识库 RAG | ✅ 完善 | `rag_service.py`, `knowledge_base.py` |
| 认证体系 | ✅ 完善 | JWT 双 Token + Cookie + CSRF |
| 管理后台 (用户/模型配置) | ✅ 完善 | `admin.py` |

### 1.3 当前架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     用户交互层                                    │
├──────────────┬──────────────────┬───────────────────────────────┤
│  Web (Next.js)│  Mobile (Expo)   │  管理后台 (Next.js /admin)    │
└──────┬───────┴────────┬─────────┴───────────────────────────────┘
       │                │
       ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    API 网关 (Caddy 2)                             │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                FastAPI Backend (8080)                             │
├──────────────────────────────────────────────────────────────────┤
│  endpoints → business → services                                 │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│ Chat     │ Agent    │Calendar  │Knowledge │ NotebookLM           │
│ (SSE)    │(Smolagent)│(Tools)  │ (RAG)    │ (notebooklm-py)      │
└──────────┴──────────┴──────────┴──────────┴─────────────────────┘
       │          │                    │              │
       ▼          ▼                    ▼              ▼
┌──────────┐ ┌──────────┐      ┌──────────┐   ┌──────────────┐
│ LLM APIs │ │ OpenClaw │      │ MongoDB  │   │ Google NLM   │
│(多 Provider)│ (Gateway) │    │ + Redis  │   │ (Cloud)      │
└──────────┘ └──────────┘      └──────────┘   └──────────────┘
```

---

## 二、转型目标

### 2.1 核心定位

**考研智能学习助手** — 一个 AI Agent 驱动的工具集合平台，整合：
1. **飞书日程** — 日程安排、任务分配、提醒推送
2. **Google NotebookLM** — 知识整理、文档分析、学习笔记生成
3. **Hermes-like Agent** — 统筹调度上述工具，自动化学习计划制定

### 2.2 核心用例

| 用例 | 描述 | 涉及工具 |
|------|------|----------|
| 制定考研学习计划 | 根据考试科目、时间节点自动分解任务 | Agent + 飞书日程 |
| 每日任务分配 | 根据学习进度动态调整日程 | Agent + 飞书日程 |
| 知识点整理 | 上传考研资料，自动生成知识总结 | NotebookLM |
| 复习检测 | 基于知识库的问答测试 | NotebookLM + Agent |
| 进度追踪 | 汇总学习完成情况，生成周报 | Agent + 飞书 + MongoDB |
| 音频复习 | 生成考研知识点播客 | NotebookLM Audio |
| 智能提醒 | 基于遗忘曲线的复习提醒 | Agent + 飞书日程 |

### 2.3 目标架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                        用户交互层                                      │
├───────────────────┬──────────────────────────────────────────────────┤
│   Web Dashboard   │         飞书 Bot / 消息卡片                       │
│  (Next.js 精简)   │     (Lark Event + Message API)                   │
└────────┬──────────┴──────────────────┬───────────────────────────────┘
         │                             │
         ▼                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │            Hermes Agent Orchestrator                          │     │
│  │   (Smolagents CodeAgent + 自定义 Tool Registry)              │     │
│  │                                                               │     │
│  │   Tools:                                                      │     │
│  │   ├── FeishuCalendarTool (创建/查询/更新日程)                 │     │
│  │   ├── FeishuMessageTool (发送消息/卡片)                       │     │
│  │   ├── NotebookLMTool (问答/Source/摘要)                       │     │
│  │   ├── StudyPlanTool (学习计划生成/分解)                       │     │
│  │   ├── ProgressTrackingTool (进度记录/查询)                    │     │
│  │   ├── SpacedRepetitionTool (间隔重复调度)                     │     │
│  │   └── WebSearchTool (DuckDuckGo)                              │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
├──────────┬──────────────┬──────────────┬─────────────────────────────┤
│ Feishu   │ NotebookLM   │  Study       │  Persistence                │
│ Service  │ Service      │  Service     │  (MongoDB + Redis)           │
│(lark-oapi)│(notebooklm-py)│(计划/进度) │                              │
└──────────┴──────────────┴──────────────┴─────────────────────────────┘
       │            │                              │
       ▼            ▼                              ▼
┌──────────┐ ┌──────────────┐              ┌──────────────┐
│ 飞书 Open │ │ Google NLM   │              │  MongoDB 7   │
│ Platform  │ │ (Cloud API)  │              │  + Redis 7   │
└──────────┘ └──────────────┘              └──────────────┘
```

---

## 三、详细转型计划

### Phase 0：项目瘦身与清理 (预计 1-2 天)

**目标：** 移除不再需要的模块，降低维护负担。

| # | 任务 | 说明 |
|---|------|------|
| 0.1 | 移除移动端 `mobile/jushi_mobile/` | 考研场景主要通过 Web + 飞书 Bot 交互，短期无需移动端 |
| 0.2 | 移除 Capacitor 相关配置 | `jushi_agent/android/`, `capacitor.config.ts` |
| 0.3 | 精简前端页面 | 保留：`/chat`, `/calendar`, `/knowledge`, `/admin`；移除：`/book-analysis`（功能合并到 NotebookLM Tool） |
| 0.4 | 移除 speech 服务 | `speech.py` + 阿里云 ASR/TTS 配置（考研场景暂不需要语音） |
| 0.5 | 清理 `node_modules 2/` 冗余目录 | git status 显示的未追踪文件 |
| 0.6 | 更新 `.gitignore` | 确保 `node_modules*`, `.env*` 等不被误提交 |

### Phase 1：飞书 Client 深度集成 (预计 3-5 天)

**目标：** 利用 `lark-oapi` 实现完整的飞书日程 + 消息能力。

#### 1.1 飞书服务层

```python
# 新建文件：jushi_backend/app/services/feishu_service.py
# 职责：封装飞书 Open API 的 Calendar/Event/Message 操作
```

| # | 任务 | 技术要点 |
|---|------|----------|
| 1.1.1 | 创建 `FeishuService` 类 | 单例模式，封装 `lark_oapi.Client` 初始化 |
| 1.1.2 | 实现日历 CRUD | `POST /calendar/v4/calendars/{id}/events`, `PATCH`, `DELETE` |
| 1.1.3 | 实现事件查询 | `GET /calendar/v4/calendars/{id}/events`，支持时间范围过滤 |
| 1.1.4 | 实现消息发送 | `POST /im/v1/messages`，支持文本/卡片消息 |
| 1.1.5 | 实现 Webhook 事件接收 | 接收飞书事件回调（日程变更、消息事件） |
| 1.1.6 | Token 管理 | `tenant_access_token` 自动刷新，Redis 缓存 |

#### 1.2 飞书配置增强

```python
# 在 config.py 中增加
FEISHU_APP_ID: str = ""
FEISHU_APP_SECRET: str = ""
FEISHU_ENCRYPT_KEY: str = ""       # 事件订阅加密
FEISHU_VERIFICATION_TOKEN: str = "" # 事件订阅验证
FEISHU_CALENDAR_ID: str = ""       # 默认日历 ID
FEISHU_BOT_OPEN_ID: str = ""       # Bot OpenID
```

#### 1.3 飞书 Agent Tools

```python
# 新建文件：jushi_backend/app/tools/feishu_tools.py
# 为 Smolagents 注册的飞书工具函数
```

| 工具名 | 功能 | Agent 调用场景 |
|--------|------|---------------|
| `create_feishu_event` | 创建飞书日程事件 | "帮我安排明天上午9点复习数学" |
| `query_feishu_events` | 查询日程 | "我这周还有哪些学习任务" |
| `update_feishu_event` | 更新日程状态 | "标记今天的英语任务为已完成" |
| `delete_feishu_event` | 删除日程 | "取消明天的模拟考试" |
| `send_feishu_message` | 发送消息/提醒 | "给我发一条复习提醒" |
| `send_feishu_card` | 发送交互卡片 | "发送学习进度周报" |

### Phase 2：NotebookLM 能力增强 (预计 2-3 天)

**目标：** 在已有 `notebooklm_service.py` 基础上，增加考研专用能力。

| # | 任务 | 说明 |
|---|------|------|
| 2.1 | 封装 NotebookLM Agent Tool | 将 `notebooklm_service` 方法包装为 Smolagents `@tool` |
| 2.2 | 按科目管理 Notebook | 一个科目对应一个 Notebook（数学/英语/政治/专业课） |
| 2.3 | 知识点提取与结构化 | 利用 NotebookLM `ask()` 提取重点，存入 MongoDB |
| 2.4 | 学习摘要生成 | 调用 `get_notebook_summary()` 生成科目学习概要 |
| 2.5 | 播客生成 | 利用 `generate_audio()` 生成通勤听的复习播客 |
| 2.6 | 考研真题录入 | 支持上传历年真题 PDF 作为 Source |

```python
# 新建文件：jushi_backend/app/tools/notebooklm_tools.py
```

| 工具名 | 功能 |
|--------|------|
| `query_knowledge` | 向指定科目的 Notebook 提问 |
| `upload_study_material` | 上传学习资料到对应科目 |
| `generate_study_summary` | 生成指定科目的学习摘要 |
| `generate_review_podcast` | 生成复习播客 |
| `list_study_sources` | 查看已上传的学习资料 |

### Phase 3：Hermes Agent 编排层 (预计 4-5 天)

**目标：** 构建 Agent 编排器，统筹飞书 + NotebookLM + 本地知识库。

#### 3.1 设计理念

参考 Hermes 框架的核心思想：
- **意图识别** — 理解用户自然语言中的学习意图
- **任务分解** — 将复杂学习目标分解为可执行步骤
- **工具编排** — 根据子任务自动选择和调用合适的工具
- **结果聚合** — 将多个工具的输出整合为统一响应

#### 3.2 实现方案

```python
# 重构文件：jushi_backend/app/services/agent_service.py
# 新增文件：jushi_backend/app/business/study_agent_business.py
```

| # | 任务 | 说明 |
|---|------|------|
| 3.1 | 定义 `StudyAgentOrchestrator` | 继承/扩展 `AgentService`，注册所有学习相关工具 |
| 3.2 | 实现意图分类 | 利用 LLM 快速模型分类：计划制定/进度查询/知识问答/日程管理 |
| 3.3 | 实现任务分解 Pipeline | 输入"帮我制定考研数学复习计划" → 分解为多个 Subtask |
| 3.4 | 工具链路编排 | 先查当前进度 → 生成计划 → 写入飞书日程 → 返回确认 |
| 3.5 | 上下文记忆 | 利用 Redis 保存对话上下文 + 用户学习偏好 |
| 3.6 | 错误恢复与重试 | 某工具失败时的降级策略 |

#### 3.3 Agent System Prompt (考研专用)

```python
STUDY_AGENT_SYSTEM_PROMPT = """你是「聚时」考研学习助手，帮助用户高效备考。

## 核心能力
1. **学习计划制定** — 根据目标院校、考试科目、剩余时间制定个性化计划
2. **任务分配与提醒** — 将计划写入飞书日程，到期自动提醒
3. **知识库问答** — 从上传的学习资料中检索答案
4. **进度追踪** — 记录每日学习完成情况，动态调整计划
5. **复习调度** — 基于遗忘曲线安排复习节点

## 工具使用规则
- 涉及日程安排 → 调用飞书日历工具
- 涉及知识点查询 → 调用 NotebookLM 工具
- 涉及计划制定 → 先查进度，再生成计划，最后写入日程
- 涉及进度查询 → 查询 MongoDB 学习记录

## 回复风格
- 简洁、有条理
- 给出可执行的建议，而非泛泛而谈
- 主动提醒关键时间节点
"""
```

### Phase 4：考研学习数据模型 (预计 2 天)

**目标：** 定义考研场景的专用数据结构。

```python
# 新建文件：jushi_backend/app/models/study.py
```

| 集合 | 用途 | 关键字段 |
|------|------|----------|
| `study_profiles` | 用户考研配置 | `target_school`, `target_major`, `exam_date`, `subjects[]` |
| `study_plans` | 学习计划 | `plan_name`, `start_date`, `end_date`, `phases[]`, `daily_hours` |
| `study_tasks` | 任务项 | `subject`, `task_type`, `scheduled_date`, `feishu_event_id`, `status` |
| `study_progress` | 每日进度 | `date`, `subject`, `planned_hours`, `actual_hours`, `completion_rate` |
| `review_schedule` | 复习调度 | `knowledge_point`, `last_reviewed`, `next_review`, `ease_factor` |
| `study_materials` | 学习资料索引 | `subject`, `filename`, `notebooklm_source_id`, `uploaded_at` |

### Phase 5：前端适配 (预计 3-4 天)

**目标：** 将 Web 前端从泛用对话平台转为考研学习 Dashboard。

| # | 任务 | 说明 |
|---|------|------|
| 5.1 | 新建 `/study` 页面 | 考研学习主面板：进度概览 + 今日任务 + 快捷操作 |
| 5.2 | 改造 `/chat` 页面 | 保留对话能力，增加学习场景快捷指令面板 |
| 5.3 | 新建 `/plan` 页面 | 学习计划可视化（甘特图/时间线） |
| 5.4 | 改造 `/calendar` 页面 | 对接飞书日历数据源，展示学习日程 |
| 5.5 | 新建 `/materials` 页面 | 学习资料管理（上传 → NotebookLM） |
| 5.6 | 新建 `/progress` 页面 | 学习进度统计图表（recharts） |
| 5.7 | 保留 `/admin` | 模型配置 + 飞书配置管理 |

### Phase 6：飞书 Bot 入口 (预计 2-3 天)

**目标：** 支持通过飞书 Bot 直接交互。

| # | 任务 | 说明 |
|---|------|------|
| 6.1 | 飞书事件订阅端点 | `POST /api/v1/feishu/webhook` 接收消息事件 |
| 6.2 | 消息路由到 Agent | 飞书消息 → Agent 处理 → 回复飞书消息 |
| 6.3 | 交互卡片 | 学习完成确认卡片、计划确认卡片 |
| 6.4 | 定时提醒 | 利用飞书日历到期提醒 + 主动推送 |

### Phase 7：OpenClaw/Hermes 高级能力 (预计 2-3 天)

**目标：** 利用 OpenClaw 容器做复杂任务代理。

| # | 任务 | 说明 |
|---|------|------|
| 7.1 | 真题解析任务 | 上传真题 → OpenClaw 解析 → 结构化存储 |
| 7.2 | 学习报告生成 | 周度/月度学习报告（跨工具数据聚合） |
| 7.3 | 智能规划 | 考前冲刺计划自动生成（结合进度数据） |

---

## 四、技术实现优先级

```
Phase 0 (瘦身)  ──→  Phase 1 (飞书)  ──→  Phase 2 (NotebookLM增强)
                                              │
                                              ▼
                          Phase 3 (Agent编排)  ←──  Phase 4 (数据模型)
                                              │
                                              ▼
                          Phase 5 (前端)  ──→  Phase 6 (飞书Bot)
                                              │
                                              ▼
                                      Phase 7 (高级能力)
```

**关键路径：** Phase 0 → Phase 4 → Phase 1 → Phase 3 → Phase 5

---

## 五、需新增/修改的关键文件清单

### 后端新增文件

```
jushi_backend/app/
├── services/
│   └── feishu_service.py          # 飞书 Open API 封装
├── tools/
│   ├── feishu_tools.py            # 飞书 Smolagents 工具
│   └── notebooklm_tools.py       # NotebookLM Smolagents 工具
├── business/
│   └── study_agent_business.py   # 学习 Agent 编排
├── models/
│   └── study.py                   # 考研数据模型
└── api/v1/endpoints/
    ├── study.py                   # 学习计划端点
    └── feishu_webhook.py          # 飞书事件回调端点
```

### 后端修改文件

```
jushi_backend/app/
├── core/config.py                 # 增加飞书配置项
├── services/agent_service.py      # 增强 Agent，注册新工具
├── services/notebooklm_service.py # 增加科目分组逻辑
├── api/v1/api.py                  # 注册新路由
└── main.py                        # 飞书 webhook 验证
```

### 前端新增/修改文件

```
jushi_agent/src/
├── app/
│   ├── study/page.tsx             # 学习主面板
│   ├── plan/page.tsx              # 学习计划页
│   ├── materials/page.tsx         # 学习资料页
│   └── progress/page.tsx          # 进度统计页
├── components/
│   ├── study/                     # 学习相关组件
│   │   ├── DailyTasks.tsx
│   │   ├── ProgressOverview.tsx
│   │   ├── QuickActions.tsx
│   │   └── StudyTimeline.tsx
│   └── chat/
│       └── StudyPrompts.tsx       # 学习场景快捷指令
├── hooks/
│   ├── useStudyPlan.ts            # 学习计划 Hook
│   └── useProgress.ts            # 进度追踪 Hook
└── types/
    └── study.ts                   # 学习相关类型
```

### 配置/部署修改

```
deployment/homelab/
├── docker-compose.yml             # 移除 openclaw (可选保留)，更新环境变量
└── .env.example                   # 增加飞书完整配置项

.github/workflows/
├── ci.yml                         # 移除 mobile-tests job
└── deploy.yml                     # 移除移动端构建
```

---

## 六、依赖变更

### 后端 requirements.in 修改

```diff
# 保留
+ lark-oapi>=1.2.0              # 已有，继续使用
+ smolagents[litellm]>=1.0.0    # 已有，Agent 核心

# 新增
+ apscheduler>=3.10.0           # 定时任务调度（复习提醒）
+ croniter>=1.0.0               # Cron 表达式解析

# 移除（可选）
- aliyun-python-sdk-core        # 如果不再需要语音/OSS
- oss2                          # 如果不再需要 OSS 存储
```

### 前端 package.json 修改

```diff
# 新增
+ "@hello-pangea/dnd"           # 任务拖拽排序
+ "recharts"                    # 已有，进度图表

# 移除
- "@capacitor/cli"
- "next-pwa"                    # 可选移除 PWA
- "@uiw/react-md-editor"       # 如不再需要 Markdown 编辑
```

---

## 七、可能需要优化的点

### 7.1 架构优化

| 问题 | 建议 |
|------|------|
| `agent_service.py` 过于通用 | 拆分为 `base_agent_service.py` + `study_agent_service.py`，各自注册不同工具集 |
| OpenClaw 容器启动慢 (需安装依赖) | 考虑构建自定义 Docker image 预装依赖，或用 Smolagents 替代 OpenClaw 的所有场景 |
| 飞书 Token 管理 | 利用 Redis 缓存 `tenant_access_token`（2h 过期），避免每次请求都获取 |
| NotebookLM Client 单例 | 当前实现已支持 keepalive，但需增加重连逻辑和健康检查 |
| 前端 BFF 层过重 | Next.js API Routes 仅做代理，考虑是否可以让前端直连后端（简化部署） |

### 7.2 性能优化

| 问题 | 建议 |
|------|------|
| Agent 执行超时 | 考研场景的计划生成可能涉及多步工具调用，建议：① 增大 `max_steps` 到 15-20；② 实现 SSE 流式返回中间步骤 |
| NotebookLM 冷启动 | 首次调用需要 Cookie 初始化，建议后端启动时预热 Client |
| MongoDB 查询效率 | 为 `study_tasks` 和 `study_progress` 添加复合索引 `(user_id, date)` |
| 飞书 API 限流 | 飞书有 QPS 限制（50 QPS/app），需要实现请求队列 + 指数退避 |

### 7.3 用户体验优化

| 问题 | 建议 |
|------|------|
| 学习计划不可视化 | 增加甘特图/时间线视图，让计划一目了然 |
| 缺少番茄钟 | 考虑集成 Pomodoro Timer，配合飞书提醒 |
| 缺少错题本 | 利用 NotebookLM Source 管理错题，定期复习 |
| 没有数据导出 | 支持导出学习报告为 PDF/Markdown |
| 多设备同步 | 飞书已天然支持多端，Web + 飞书 Bot 足够覆盖 |

### 7.4 安全与合规

| 问题 | 建议 |
|------|------|
| 飞书 Webhook 验证 | 必须实现 `Encrypt Key` + `Verification Token` 验证 |
| NotebookLM 数据安全 | 学习资料上传到 Google 云端，需告知用户数据存储位置 |
| 个人信息保护 | 考研目标院校等属于个人敏感信息，加密存储 |

### 7.5 可移除的冗余模块

| 模块 | 理由 |
|------|------|
| `mobile/jushi_mobile/` | 飞书 Bot + Web 已覆盖移动场景 |
| `speech.py` + 阿里云语音 | NotebookLM Audio 已替代 |
| `jushi_agent/android/` + Capacitor | 不再需要原生壳 |
| `book_analysis.py` (旧实现) | 合并到 NotebookLM 统一流程 |
| `documents.py` (工作文档) | 功能与考研场景不相关 |

---

## 八、实施时间估算

| Phase | 任务 | 预计工时 | 前置依赖 |
|-------|------|----------|----------|
| 0 | 项目瘦身 | 1-2 天 | 无 |
| 1 | 飞书集成 | 3-5 天 | Phase 0 |
| 2 | NotebookLM 增强 | 2-3 天 | Phase 0 |
| 3 | Agent 编排 | 4-5 天 | Phase 1 + 2 + 4 |
| 4 | 数据模型 | 2 天 | Phase 0 |
| 5 | 前端适配 | 3-4 天 | Phase 3 |
| 6 | 飞书 Bot | 2-3 天 | Phase 1 + 3 |
| 7 | 高级能力 | 2-3 天 | Phase 3 |

**总计：约 19-27 天（单人开发）**

---

## 九、验收标准

### MVP (最小可行产品) — Phase 0-4 完成后

- [ ] 用户可通过 Web 输入考研目标，AI 生成分阶段学习计划
- [ ] 学习计划自动同步到飞书日历
- [ ] 可上传考研资料到 NotebookLM，并进行知识问答
- [ ] 日程状态变更自动记录学习进度

### V1.0 — 全部 Phase 完成后

- [ ] 完整的飞书 Bot 交互（无需打开 Web 即可管理学习）
- [ ] 基于遗忘曲线的智能复习提醒
- [ ] 周度学习报告自动生成
- [ ] 学习进度可视化 Dashboard
- [ ] 考前冲刺计划自动调整

---

## 十、开发注意事项

1. **飞书 API 需要企业应用审批** — 需提前在飞书开发者后台创建应用，申请 `calendar:calendar`, `im:message` 等权限
2. **NotebookLM Cookie 过期** — `notebooklm-py` 依赖 Google Cookie 认证，需定期刷新（已有 keepalive 机制，但需监控）
3. **数据迁移** — 现有 `calendar_events` 集合可保留，新增 `study_tasks` 与之关联
4. **分支策略** — 建议在 `feature/study-agent` 分支开发，完成一个 Phase 合并一次
5. **环境变量** — 每个 Phase 可能引入新的环境变量，及时更新 `.env.example` 和 `docker-compose.yml`

---

## 附录 A：关键第三方库参考

| 库 | 用途 | 文档 |
|----|------|------|
| `lark-oapi` | 飞书 Open API Python SDK | https://open.feishu.cn/document/server-docs/getting-started/api-overview |
| `notebooklm-py` | NotebookLM Python Client | https://github.com/nichochar/notebooklm-py |
| `smolagents` | HuggingFace Agent Framework | https://huggingface.co/docs/smolagents |
| `litellm` | 多模型统一调用层 | https://docs.litellm.ai/ |
| `apscheduler` | Python 定时任务 | https://apscheduler.readthedocs.io/ |

## 附录 B：飞书 API 关键端点

| API | 用途 |
|-----|------|
| `POST /open-apis/calendar/v4/calendars/:id/events` | 创建日程 |
| `GET /open-apis/calendar/v4/calendars/:id/events` | 查询日程列表 |
| `PATCH /open-apis/calendar/v4/calendars/:id/events/:event_id` | 更新日程 |
| `DELETE /open-apis/calendar/v4/calendars/:id/events/:event_id` | 删除日程 |
| `POST /open-apis/im/v1/messages` | 发送消息 |
| `POST /open-apis/bot/v2/hook/:hook_id` | Webhook Bot |
| `POST /open-apis/auth/v3/tenant_access_token/internal` | 获取 Token |

## 附录 C：NotebookLM-py 核心 API

```python
# 初始化
client = await NotebookLMClient.from_storage(path=..., keepalive=300)

# Notebook 管理
nb = await client.notebooks.create("考研-数学")
summary = await client.notebooks.get_summary(nb.id)

# Source 管理
source = await client.sources.add_file(nb.id, Path("线代.pdf"))
sources = await client.sources.list(nb.id)
await client.sources.delete(nb.id, source.id)

# 问答
result = await client.chat.ask(nb.id, "特征值的求法有哪些?")
# result.answer, result.references

# 音频生成
status = await client.artifacts.generate_audio(nb.id, instructions="生成数学知识点播客")
final = await client.artifacts.wait_for_completion(nb.id, status.task_id, timeout=600)
```
