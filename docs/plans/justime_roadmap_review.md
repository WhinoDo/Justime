# Justime Roadmap 深度审查与完善方案

> 基于对当前仓库的代码级审查，结合 GPT 生成的方向文档，给出具体的修正意见、补全缺失细节和可执行的落地方案。

---

## 〇、前置警示：这是第二次方向变更

> [!CAUTION]
> **你的仓库中已经存在一份 2026-05-30 的转型计划 [TRANSFORMATION_PLAN.md](file:///Users/zhuyuxuan/Desktop/Code/Justime/docs/design/TRANSFORMATION_PLAN.md)，当时的方向是「考研智能学习助手」。** 仅过了 17 天，你又要将方向改为「AI 个人任务进程操作系统」。
>
> 这意味着 **study 模块（考研学习计划/任务/进度/复习/资料/飞书日历同步）是上次转型刚建立的功能**，现在又面临被重构的命运。
>
> 这不是说新方向不对——实际上新方向（通用任务进程管理）比「考研学习助手」更有前景、更可泛化。但你需要做出一个决断：**这次确定了就不再摇摆。**

**我对你两次方向变更的判断：**

| 维度 | 考研学习助手（上次） | AI 任务进程 OS（这次） | 评价 |
|------|------------------|---------------------|------|
| 用户面 | 极窄（仅考研学生） | 宽（所有知识工作者） | 这次更好 |
| 技术复用 | 高（直接用已有基础） | 高（study 模块可泛化） | 持平 |
| 差异化 | 低（飞书+AI+考研=红海） | 高（任务进程可视化+知识沉淀=蓝海） | 这次更好 |
| 执行难度 | 中 | 高（桌面端+Agent+可视化） | 上次更简单 |
| 个人热情 | ？ | 高（从你的描述来看） | 这次更好 |

**结论：新方向是正确的，但你需要承诺：至少在 6 个月内不再改方向。**

---

## 一、对 GPT Roadmap 的总体评价

GPT 的文档在**产品定位（§1-3）**和**概念设计（§6-9）**方面做得不错，方向判断基本准确。但存在以下 **7 个关键缺陷**，需要逐一修正：

| # | 缺陷 | 严重程度 | 说明 |
|---|------|---------|------|
| 1 | **目录名写错** | 🔴 严重 | 旧文档误用 `jushi_agent` / `jushi_backend`；legacy root `jushi_agent/` 已删除且不可构建或运行，唯一正式 Web 前端为 `justime_agent/`，正式后端为 `justime_backend/` |
| 2 | **忽略了已存在的 study 模块** | 🔴 严重 | 仓库已有 `study.py` 模型（考研学习计划/任务/进度/复习/资料）、`study_agent_service.py`、`study_report_service.py`、`study_agent_business.py`、前端 `study/` 和 `progress/` 页面——这些是 Task Process 的天然基础，GPT 完全没提 |
| 3 | **忽略了已存在的 Agent 模块** | 🟡 中等 | 仓库已有 `agent.py` 模型、`agent_service.py`（36KB）、`agent_business.py`、`openclaw_service.py`，Agent 框架已有雏形 |
| 4 | **Tauri + Next.js 兼容性未深入** | 🟡 中等 | Next.js 14 的 App Router 依赖 Node.js 服务端运行时（RSC、API Routes），Tauri v2 的前端用 WebView 加载静态资源——二者存在架构冲突，文档未给出具体解决方案 |
| 5 | **后端运行方案过于笼统** | 🟡 中等 | 桌面端如何管理 FastAPI + MongoDB + Redis 的运行，是整个项目的最大技术难点，文档只列了三个方向但无法执行 |
| 6 | **缺少数据迁移策略** | 🟡 中等 | 从当前 study/calendar/chat 模型迁移到新的 TaskProcess 模型，需要迁移脚本和兼容期，未提及 |
| 7 | **时间估算过于乐观** | 🟠 低 | Phase 1 仅给 2-3 周，但涉及 3 个新模型 + 全新 Agent 管线 + 新 UI，个人开发至少需翻倍 |

---

## 二、逐项细节完善

### 2.1 修正：利用已有 Study 模块作为 Task Process 的起点

GPT 方案提出从零新建 `TaskProcess` / `Evidence` / `KnowledgeOutput` 三个模型。但你的仓库已经有非常接近的基础：

**已有的 Study 模型映射关系：**

| 已有模型 | → 新概念 | 迁移策略 |
|---------|---------|---------|
| [StudyProfileBase](file:///Users/zhuyuxuan/Desktop/Code/Justime/justime_backend/app/models/study.py#L23-L28) (目标院校/专业/考试日期) | TaskProcess.goal + context | 泛化字段：去掉考研专有的 `targetSchool`/`targetMajor`，改为通用 `goal: str` + `metadata: dict` |
| [StudyPlanBase](file:///Users/zhuyuxuan/Desktop/Code/Justime/justime_backend/app/models/study.py#L50-L55) (计划名/阶段/时长) | TaskProcess.milestones + timeline | 直接复用 `phases` 字段，改名为 `milestones` |
| [StudyTaskBase](file:///Users/zhuyuxuan/Desktop/Code/Justime/justime_backend/app/models/study.py#L77-L84) (科目/类型/日期/时长) | TaskProcess 的子任务 | 泛化 `subject` → `category`，保留 `taskType` |
| [StudyProgressBase](file:///Users/zhuyuxuan/Desktop/Code/Justime/justime_backend/app/models/study.py#L111-L117) (日期/时长/完成率) | Evidence (type='progress') | 这就是 Evidence 的雏形 |
| [ReviewScheduleBase](file:///Users/zhuyuxuan/Desktop/Code/Justime/justime_backend/app/models/study.py#L130-L136) (知识点/复习计划/SM-2) | Knowledge Output 的复习维度 | SM-2 间隔重复算法可直接复用 |

> [!IMPORTANT]
> **建议：不要从零重建模型，而是将 `study.py` 重构为 `task_process.py`，保持字段向后兼容，用 `category` 字段区分任务类型（学习/开发/写作/研究等）。**

**改造后的核心模型建议（完善 GPT 版本的不足）：**

```python
# task_process.py — 改进版

class TaskProcess(BaseModel):
    id: str
    title: str = Field(..., max_length=200)
    description: str = Field("", max_length=5000)
    goal: str = Field(..., max_length=2000)
    
    # 类型系统：取代硬编码的考研科目
    category: str = Field(..., description="任务类别: learning/development/writing/research/...")
    tags: List[str] = Field(default_factory=list, max_length=20)
    
    # 状态机
    status: Literal['draft', 'planned', 'active', 'paused', 'blocked', 'completed', 'archived']
    phase: Literal['before', 'during', 'after']
    priority: Literal['low', 'medium', 'high', 'critical']
    
    # 进度（AI 评估 + 手动调整）
    progress: float = Field(0.0, ge=0.0, le=1.0, description="0-1 进度，AI 可自动更新")
    progress_source: Literal['manual', 'ai', 'evidence'] = 'manual'
    
    # 时间维度（从 StudyPlan 继承）
    estimated_hours: Optional[float] = None
    actual_hours: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    
    # 上下文（GPT 版本缺少的重要字段）
    parent_task_id: Optional[str] = None  # 支持任务嵌套
    related_chat_session_ids: List[str] = Field(default_factory=list)  # 关联的对话
    related_calendar_event_ids: List[str] = Field(default_factory=list)  # 关联的日历事件
    
    # AI 元数据
    ai_plan: Optional[dict] = None  # AI 拆解的计划结构
    ai_last_assessment: Optional[dict] = None  # AI 最近的进度评估
    
    # 标准字段
    user_id: str
    created_at: datetime
    updated_at: datetime

class Evidence(BaseModel):
    """改进 GPT 版本：增加结构化元数据"""
    id: str
    task_id: str
    type: Literal['note', 'file', 'chat', 'code_commit', 'link', 'time_log', 
                   'quiz_result', 'review', 'milestone_complete', 'manual']
    title: str = Field("", max_length=200)
    content: str = Field(..., max_length=50000)
    source: str = Field("", description="来源标识: chat_session_id / file_path / git_hash / url")
    
    # GPT 版本缺失的字段
    milestone_id: Optional[str] = None  # 关联到哪个里程碑
    ai_extracted: bool = False  # 是否由 AI 自动提取
    sentiment: Optional[Literal['positive', 'neutral', 'negative', 'blocked']] = None
    
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    user_id: str
    created_at: datetime

class KnowledgeOutput(BaseModel):
    """改进 GPT 版本：增加与 Obsidian/Vault 的集成字段"""
    id: str
    task_id: str
    title: str = Field(..., max_length=200)
    
    # 路径管理
    vault_relative_path: str  # 相对于 Vault 根目录的路径
    absolute_path: Optional[str] = None  # 生成后的实际路径
    
    format: Literal['summary', 'tutorial', 'faq', 'cheatsheet', 'debug_log', 
                     'mindmap', 'glossary', 'timeline', 'comparison']
    markdown: str
    
    # GPT 版本缺失的重要字段
    source_evidence_ids: List[str] = Field(default_factory=list)  # 溯源
    obsidian_tags: List[str] = Field(default_factory=list)  # Obsidian 标签
    obsidian_links: List[str] = Field(default_factory=list)  # [[双链]]
    word_count: int = 0
    
    # 版本管理
    version: int = 1
    previous_version_id: Optional[str] = None
    
    user_id: str
    created_at: datetime
    updated_at: datetime
```

### 2.2 修正：Tauri + Next.js 的真实架构方案

GPT 文档只说了"用 Tauri 封装 Next.js"，但这在技术上不是直接可行的。需要解决的核心问题：

> [!WARNING]
> **Next.js 14 App Router 依赖 Node.js 运行时**：Server Components (RSC)、API Routes (`src/app/api/`)、中间件 (middleware.ts) 都需要 Node.js 进程。Tauri 的 WebView 只能加载静态 HTML/JS/CSS，不能直接运行 Next.js 的服务端。

**实际可行的方案（三选一）：**

#### 方案 A：Tauri + Next.js Static Export（推荐 MVP）

```
架构: Tauri WebView → 加载 Next.js `output: 'export'` 静态产物
后端: FastAPI 通过 Tauri sidecar 或用户自行启动
```

**需要做的改造：**
1. `next.config.js` 添加 `output: 'export'`
2. 将所有 `src/app/api/` BFF 代理层改为直接调用后端（桌面端不需要 BFF 代理层，因为没有跨域问题）
3. 将依赖 SSR 的页面改为 `'use client'` + CSR
4. 环境变量切换：`NEXT_PUBLIC_RUNTIME=desktop` 时跳过 BFF 层

**优点：** 最轻量，Tauri 产物小
**缺点：** 前端需要重构部分路由逻辑

#### 方案 B：Electron + Next.js（最快 MVP）

```
架构: Electron main process → 启动 Next.js dev server → BrowserWindow 加载 localhost:3000
后端: FastAPI 作为 Electron 子进程
```

**优点：** 几乎不需要改前端代码，Next.js 全特性可用
**缺点：** 产物大（~200MB+），资源占用高

#### 方案 C：Tauri v2 + 内嵌 Next.js 自定义 Server（高级方案）

```
架构: Tauri → 启动 Node.js sidecar 运行 Next.js → WebView 加载 localhost:3000
后端: FastAPI 也通过 sidecar 管理
```

**优点：** Next.js 全特性 + Tauri 轻量壳
**缺点：** 架构复杂，需要管理两个 sidecar 进程

> [!TIP]
> **我的推荐路径：先用方案 B (Electron) 在 2-3 天内跑通 DMG 原型，验证核心交互。确认产品方向后，再花 1-2 周迁移到方案 A (Tauri + Static Export)。**

### 2.3 补全：后端运行方案的具体执行细节

GPT 文档最大的空白在于：桌面端怎么跑 FastAPI + MongoDB + Redis？

**推荐分层方案：**

```
┌────────────────────────────────────────────────┐
│ Phase 1 MVP: 云端后端                           │
│ Desktop App → 连接你的云服务器后端                │
│ 用户只需配置 Backend URL                         │
│ 后端继续运行在你的 Docker Compose 环境            │
├────────────────────────────────────────────────┤
│ Phase 2: 混合架构                                │
│ 核心 CRUD → SQLite (本地，替代 MongoDB)           │
│ AI 能力 → 云端 API (DeepSeek/OpenAI)             │
│ 缓存 → 内存 (替代 Redis)                        │
│ 本地 FastAPI 用 PyInstaller 打包为单文件          │
├────────────────────────────────────────────────┤
│ Phase 3: 完全本地                                │
│ 本地 LLM (Ollama)                               │
│ 本地向量数据库 (ChromaDB)                        │
│ SQLite + 本地文件系统                            │
│ 零云依赖                                        │
└────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Phase 1 的关键决策：桌面端 MVP 阶段不需要解决本地后端问题。** 你的 Docker Compose 后端已经在跑了，桌面端只是一个更好的前端壳。不要同时解决"新产品方向 + 新技术栈"两个大问题。

### 2.4 补全：Agent 架构的具体实现方案

GPT 列出了 6 个 Agent（Planner / Research / Monitor / Coach / Summarizer / Knowledge），但没有说明怎么实现。你的仓库已有 [agent_service.py](file:///Users/zhuyuxuan/Desktop/Code/Justime/justime_backend/app/services/agent_service.py)（36KB）和 [study_agent_service.py](file:///Users/zhuyuxuan/Desktop/Code/Justime/justime_backend/app/services/study_agent_service.py)，说明 Agent 框架已有基础。

**建议的 Agent 实现架构：**

```python
# 不需要6个独立Agent，用一个带工具的 Agent + 不同 system prompt 即可

class TaskAgent:
    """统一的任务 Agent，通过 mode 切换行为"""
    
    def __init__(self, llm_service, rag_service):
        self.llm = llm_service
        self.rag = rag_service
        self.tools = {
            "search_web": self._search_web,
            "search_knowledge": self._search_knowledge,
            "create_milestone": self._create_milestone,
            "add_evidence": self._add_evidence,
            "generate_markdown": self._generate_markdown,
            "assess_progress": self._assess_progress,
        }
    
    async def run(self, task: TaskProcess, mode: str, user_input: str):
        """
        mode:
          - 'plan': 拆解任务 (Before 阶段)
          - 'research': 搜集资料 (Before 阶段)
          - 'monitor': 评估进度 (During 阶段)
          - 'coach': 给建议 (During 阶段)
          - 'summarize': 生成总结 (After 阶段)
          - 'knowledge': 生成 Markdown (After 阶段)
        """
        system_prompt = self._build_prompt(task, mode)
        # 复用已有的 chat_business 管线
        ...
```

> [!TIP]
> **不要过度拆分 Agent。** 当前阶段用一个 Agent + 工具调用 + 不同的 system prompt 即可。等到真正需要并发执行或异构模型时再拆分。

### 2.5 补全：数据迁移策略

```
阶段 1: 兼容期
- 新建 task_processes 集合，与 study_* 集合并存
- study 页面继续可用，但标记为 deprecated
- 新建任务走 task_processes

阶段 2: 迁移期  
- 编写迁移脚本: study_plans → task_processes, study_progress → evidence
- 用户首次打开新版时自动触发迁移
- 保留 study_* 集合作为备份

阶段 3: 清理期
- 确认迁移完成后，移除 study 相关代码
- 归档 study_* 集合
```

### 2.6 补全：Markdown Vault 与 Obsidian 的互操作

GPT 提到了 Markdown Vault 目录结构，但没有考虑与 Obsidian 的兼容性。既然你的目标是个人知识库，Obsidian 兼容是关键差异化优势。

**需要确保：**

1. **YAML frontmatter** — 每个生成的 .md 文件必须有标准 frontmatter：
   ```yaml
   ---
   title: Python 虚拟环境
   tags: [python, virtualenv, 学习笔记]
   source: justime-task-xxxx
   created: 2026-06-16
   updated: 2026-06-16
   status: completed
   ---
   ```

2. **[[双链]]** — AI 生成 Markdown 时应自动生成 Obsidian 风格的内部链接

3. **不要自定义格式** — 严格用标准 Markdown，不搞私有语法

4. **配置 Vault 路径** — 用户在设置中指定 Obsidian Vault 路径，Justime 直接写入

### 2.7 修正：时间估算

| Phase | GPT 估算 | 建议估算（个人开发） | 说明 |
|-------|---------|-------------------|------|
| Phase 0: 定位 | 1 周 | 3-5 天 | 这个估算合理 |
| Phase 1: Task Process MVP | 2-3 周 | **4-6 周** | 涉及模型重构 + 新 Agent 管线 + 三阶段 UI |
| Phase 2: 知识库沉淀 | 2 周 | **3-4 周** | Markdown 生成 + Vault 管理 + RAG 更新 |
| Phase 3: macOS 桌面 MVP | 2-4 周 | **1-2 周** | 如果先用 Electron，壳子搭建很快 |
| Phase 4: 智能监测 | 4-6 周 | **6-8 周** | 文件监听 + Git 集成 + 自动评估 |
| Phase 5: AGI Workspace | 长期 | 长期 | 方向正确 |

---

## 三、GPT 文档缺失的重要章节

### 3.1 离线能力设计（GPT 完全未提）

作为 macOS 桌面应用，离线能力至关重要：

| 能力 | 在线状态 | 离线状态 |
|------|---------|---------|
| 任务 CRUD | ✅ 云同步 | ✅ SQLite 本地存储 |
| AI 对话 | ✅ 云端 LLM | ⚠️ 本地 Ollama（可选）|
| Evidence 记录 | ✅ 实时同步 | ✅ 本地缓存，联网后同步 |
| Markdown 生成 | ✅ AI 生成 | ⚠️ 模板生成（简化版）|
| 知识库搜索 | ✅ RAG | ✅ 本地全文搜索 |
| 日历 | ✅ 同步 | ✅ 本地 IndexedDB（前端已有） |

### 3.2 隐私与数据安全（GPT 未深入）

个人 AI 工作台的数据非常私密：

- 所有任务数据默认存本地，用户选择是否云同步
- AI 对话内容默认不保存到云端第三方
- Markdown Vault 始终在本地文件系统
- 未来支持本地模型（Ollama），实现完全隐私

### 3.3 现有功能的融合策略（GPT 说"保留但服务于任务"太笼统）

具体的融合方式：

| 现有功能 | 融合方式 |
|---------|---------|
| AI 对话 (ChatInterface) | 每次对话绑定一个 Task，对话内容自动成为 Evidence |
| 日历 (Calendar) | 创建任务时自动生成日历事件，日历事件完成时更新任务进度 |
| 知识库 (Knowledge) | 变成任务的"After"阶段输出，知识库条目带 `task_id` 溯源 |
| RAG 检索 | "Before"阶段搜索已有知识；"After"阶段更新索引 |
| 书籍分析 | 变成一种任务类型 `category: 'reading'`，分析结果是 Evidence |
| Dashboard | 改造为 Process Cockpit，任务状态可视化 |
| 任务计时 (task_timing) | 直接作为 Evidence 的 `type: 'time_log'` |

### 3.4 可视化组件具体设计（GPT 只列了名字）

**任务时间线（核心可视化）：**
```
Before                 During                          After
┌─────────┐    ┌────────────────────────────┐    ┌──────────┐
│ 🎯 目标  │───▶│ ✅ 里程碑1  ⚠️ 阻塞1       │───▶│ 📝 总结   │
│ 📋 计划  │    │ ✅ 里程碑2  ⏳ 里程碑3      │    │ 📚 知识库  │
│ 📚 资料  │    │ 📊 进度: ████████░░ 75%    │    │ 🔄 复盘   │
└─────────┘    └────────────────────────────┘    └──────────┘
```

**技术选型：** 前端已有 `recharts` 和 `framer-motion`，可直接复用，不需要引入新的可视化库。

---

## 四、修正后的推荐执行路线

### Sprint 0: 基础准备（1 周）

- [ ] 更新 README、AGENTS.md、产品定位文档
- [ ] 设计新的 `TaskProcess` / `Evidence` / `KnowledgeOutput` Pydantic 模型
- [ ] 设计 MongoDB 集合和索引
- [ ] 定义前后端 API 契约（OpenAPI schema）
- [ ] **决策：桌面端先用 Electron 还是 Tauri**

### Sprint 1: 后端 Task Process 核心（2-3 周）

- [ ] 新建 `task_process.py` 模型（基于 study.py 演化）
- [ ] 新建 `evidence.py`、`knowledge_output.py` 模型
- [ ] 实现 Task Process CRUD API
- [ ] 实现 Evidence CRUD API
- [ ] 实现 TaskAgent（统一 Agent，支持 plan/research/monitor/coach/summarize/knowledge 模式）
- [ ] 集成现有 `llm_service` 和 `rag_service`
- [ ] 编写 API 测试

### Sprint 2: 前端 Task Process UI（2-3 周）

- [ ] 新建 `src/app/tasks/` 路由（任务列表 + 详情页）
- [ ] 实现三阶段 UI：Before / During / After
- [ ] 实现 Evidence 记录组件
- [ ] 将现有 ChatInterface 改造为任务上下文助手（右侧面板）
- [ ] 实现任务进度可视化（时间线 + 进度条）
- [ ] 改造 Dashboard 为 Process Cockpit

### Sprint 3: Markdown Vault + 知识沉淀（2 周）

- [ ] 实现 KnowledgeOutput 生成 API（AI 生成 Markdown）
- [ ] 实现 Vault 目录配置和文件写入
- [ ] 实现 Obsidian 兼容的 frontmatter 和双链
- [ ] 知识库页面改造（展示任务生成的知识卡片）
- [ ] RAG 索引自动更新

### Sprint 4: macOS Desktop Shell（1-2 周）

- [ ] 初始化 Electron（或 Tauri）工程
- [ ] 配置 DMG 打包
- [ ] 实现桌面端环境变量切换
- [ ] 菜单栏入口 + 本地通知
- [ ] 打包第一个测试版 DMG

### Sprint 5: 端到端 Demo 联调（1 周）

- [ ] 完整跑通"学习 Python 虚拟环境"Demo
- [ ] 从创建任务 → AI 拆解 → 记录学习 → AI 评估 → 生成 Markdown → 写入 Vault
- [ ] 录制 Demo 视频
- [ ] Bug 修复和体验打磨

---

## 五、技术风险与缓解措施

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Next.js SSR 与桌面端不兼容 | 高 | 高 | 提前将桌面端页面改为 `'use client'`，准备 static export |
| Agent 质量不稳定 | 中 | 高 | 用结构化 prompt + 输出验证，不依赖自由生成 |
| Markdown 生成格式混乱 | 中 | 中 | 用模板 + 后处理，确保 frontmatter/格式一致 |
| 性能问题（大量 Evidence） | 低 | 中 | MongoDB 索引优化，分页加载 |
| Apple 签名/公证流程复杂 | 中 | 低 | MVP 阶段允许用户手动"打开"未签名应用 |

---

## 六、与 GPT 文档的对照总结

| 维度 | GPT 文档 | 本文档改进 |
|------|---------|-----------|
| 目录命名 | ❌ 写错为 jushi_* | ✅ 修正为 justime_* |
| 已有代码利用 | ❌ 完全忽略 study/agent 模块 | ✅ 基于已有模块演化 |
| 数据模型 | ⚠️ 基础版 | ✅ 增加嵌套任务、溯源、版本管理、Obsidian 兼容 |
| 桌面端方案 | ⚠️ 只说"用 Tauri" | ✅ 给出 3 种方案的详细对比和推荐路径 |
| 后端运行 | ⚠️ 三选一但没细节 | ✅ 分层演进方案，MVP 不改后端 |
| Agent 实现 | ⚠️ 6 个 Agent 概念 | ✅ 统一 Agent + 模式切换，复用已有代码 |
| 数据迁移 | ❌ 未提及 | ✅ 三阶段迁移策略 |
| 离线能力 | ❌ 未提及 | ✅ 在线/离线功能矩阵 |
| 时间估算 | ⚠️ 过于乐观 | ✅ 基于个人开发的现实估算 |
| 可视化细节 | ⚠️ 只列名字 | ✅ 具体组件设计 + 技术选型 |
