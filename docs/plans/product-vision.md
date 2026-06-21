# Justime 产品愿景文档

> **版本**: v1.0 | **日期**: 2026-06-16 | **状态**: 已确认

---

## 1. 产品定位

### 一句话定位

**Justime 是一个运行在 macOS 上的 AI 个人任务进程管理器，用于持续追踪个人任务的前、中、后状态，并将任务过程转化为结构化 Markdown 知识库。**

### 我们是什么

Justime 是面向个人知识工作的 **AI 任务进程操作系统 (AI Task Process OS)**。

它将每个任务视为一个「进程」，拥有完整的生命周期：**Before（准备）→ During（执行）→ After（沉淀）**。AI Agent 在每个阶段主动介入——帮你拆解目标、监测进度、识别阻塞、给出建议，并在任务完成后自动生成结构化 Markdown 知识文档，写入本地知识库。

最终，Justime 帮你实现一个闭环：

```
创建任务 → AI 拆解 → 执行记录 → 进度监测 → 复盘总结 → 知识沉淀
```

### 我们不是什么

| 我们不是 | 原因 |
|---|---|
| 普通 Todo List | 我们不是勾勾选选的清单，而是持续追踪任务状态的「进程管理器」 |
| 团队协作平台 | 我们聚焦个人知识工作者，不做团队任务分配和权限管理 |
| 单纯日历工具 | 日程是任务的附属维度，不是产品核心 |
| 聊天机器人 | AI 对话绑定到具体任务上下文，不是漫无目的的聊天 |
| 通用笔记工具 | 知识文档是任务的「产出物」，而非手动创建的笔记 |
| Notion 替代品 | 我们不做通用 Workspace，只做任务进程管理这一件事 |

---

## 2. 核心用户画像

### 目标用户：个人知识工作者

Justime 为那些「总在推进某个任务、总在学习某个东西、总有一些想法需要落地」的个人用户而建。

#### 画像 A：独立开发者 / 学生开发者

- 同时推进学习计划和 Side Project
- 经常中断又重新拾起，容易丢失进度和上下文
- 学习新技术时希望有系统性的路径引导
- 希望学完之后能留下可复用的知识文档

#### 画像 B：在校学生 / 考研备考者

- 需要持续追踪多科目的学习进度
- 容易卡在某个知识点上但不自知
- 希望 AI 能帮忙分析薄弱环节并给出建议
- 学习成果零散，缺乏系统性的知识整理

#### 画像 C：独立研究者 / 内容创作者

- 研究一个新领域时需要大量搜集和整理资料
- 调研过程中容易信息过载、迷失方向
- 希望研究成果能自动沉淀为可检索的知识库
- 写作时需要快速查阅之前整理的素材

#### 共同特征

- 使用 macOS 作为主要工作设备
- 有长期、复杂任务（不是 5 分钟能完成的小事）
- 重视知识积累，但缺乏系统性方法
- 对 AI 辅助工具持开放态度
- 偏好本地优先、数据自主可控的工具

---

## 3. 核心价值主张

Justime 提供三个层次的核心价值：

### 第一层：任务进程可见性 (Task Process Visibility)

> 让每个任务的状态、进度和阻塞点一目了然。

传统工具中，任务只有「未完成」和「已完成」两种状态。Justime 引入 **Before / During / After** 三阶段模型和 **Evidence 驱动的进度评估**，让你随时知道：

- 当前任务走到了哪一步
- 哪些部分是已经搞定的（有证据支撑）
- 哪些地方卡住了（Blocker 识别）
- 下一步应该做什么

### 第二层：AI 辅助推进 (AI-Assisted Progression)

> 不只是被动回答问题，而是主动参与任务推进。

六个专职 Agent 各司其职：

| Agent | 职责 | 介入时机 |
|---|---|---|
| Planner | 将模糊目标拆解为可执行步骤 | Before 阶段 |
| Research | 搜集参考资料、生成摘要 | Before → During |
| Monitor | 根据 Evidence 评估进度和阻塞 | During 阶段 |
| Coach | 给出下一步行动建议 | During 阶段 |
| Summarizer | 阶段总结与任务复盘 | During → After |
| Knowledge | 生成 Markdown 并归档知识库 | After 阶段 |

### 第三层：知识结晶 (Knowledge Crystallization)

> 任务不是做完就消失的，它应该沉淀为可复用的知识资产。

每完成一个任务，Justime 自动输出结构化 Markdown 文档——Summary、Tutorial、FAQ、Cheatsheet、Debug Log 等多种格式，写入本地 `JustimeVault/` 目录，与 Obsidian 完全兼容。

久而久之，你的知识库就像一棵不断生长的树，每个任务都为它增加新的枝叶。

---

## 4. 核心用户场景

### 场景 A：学习 Python（学习型任务）

**用户故事**：小明想系统学习 Python 的文件读写、异常处理、虚拟环境和包管理。

**Justime 如何帮助**：

**Before 阶段**
1. 小明创建任务：「学习 Python 基础」，描述学习目标
2. Planner Agent 自动拆解为 4 个里程碑：文件读写 → 异常处理 → 虚拟环境 → 包管理
3. Research Agent 搜集每个主题的优质参考资料
4. 生成学习计划和预估时间

**During 阶段**
5. 小明学习过程中在 Justime 中记录笔记、提问题、粘贴代码
6. 每条记录自动成为 Evidence，标记关联的里程碑
7. Monitor Agent 定期评估进度：「文件读写已掌握 (3 条 Evidence)，虚拟环境卡住了 (0 条 Evidence，已 3 天未推进)」
8. Coach Agent 发现卡点，主动推送：「建议从 venv 的最简用法开始，附上 3 分钟快速上手指南」

**After 阶段**
9. 学习完成后，Summarizer Agent 生成学习复盘
10. Knowledge Agent 自动输出 4 篇 Markdown 知识文档 + 1 篇总结

**最终产物**：
```
JustimeVault/
└── Python/
    ├── 文件读写.md          # Tutorial 格式
    ├── 异常处理.md          # Tutorial + FAQ
    ├── 虚拟环境.md          # Cheatsheet
    ├── 包管理.md            # Tutorial
    └── Python学习总结.md    # Summary
```

---

### 场景 B：开发一个 Side Project（开发型任务）

**用户故事**：小红要开发一个 CLI 工具，用于批量重命名本地照片。

**Justime 如何帮助**：

**Before 阶段**
1. 创建任务：「开发照片批量重命名 CLI」
2. Planner Agent 拆解为：需求分析 → 技术选型 → 核心逻辑 → CLI 封装 → 测试 → 发布
3. Research Agent 对比 Python Click vs Typer vs argparse

**During 阶段**
4. 小红在开发过程中遇到 EXIF 读取问题，在任务对话中提问
5. AI 基于任务上下文给出精准回答（不需要重复解释项目背景）
6. 代码提交记录自动作为 Evidence 汇入
7. Monitor Agent 识别「测试覆盖不足」为 Blocker

**After 阶段**
8. 项目发布后，自动生成技术总结和架构文档
9. 遇到的 EXIF 问题被整理为 Debug Log 归入知识库

**最终产物**：
```
JustimeVault/
└── Projects/
    └── photo-renamer/
        ├── 架构设计.md
        ├── EXIF读取踩坑记录.md    # Debug Log
        ├── Click框架使用指南.md   # Cheatsheet
        └── 项目复盘.md           # Summary
```

---

### 场景 C：研究一个新领域（研究型任务）

**用户故事**：小张想深入了解 RAG (Retrieval-Augmented Generation) 技术，为论文选题做准备。

**Justime 如何帮助**：

**Before 阶段**
1. 创建任务：「RAG 技术调研」
2. Planner Agent 拆解为：基础概念 → 核心论文 → 技术实现 → 应用场景 → 前沿方向
3. Research Agent 搜集关键论文、博客、开源项目

**During 阶段**
4. 小张阅读论文时将笔记和摘要录入 Justime
5. 每篇论文的阅读记录成为 Evidence
6. 在任务对话中与 AI 讨论论文中的技术细节
7. Monitor Agent 跟踪：「已覆盖 3/5 个子主题，前沿方向尚未开始」

**After 阶段**
8. 调研完成后，生成完整的领域综述 Markdown
9. 论文笔记、技术对比表、开源项目清单全部归档

**最终产物**：
```
JustimeVault/
└── Research/
    └── RAG/
        ├── RAG基础概念.md
        ├── 核心论文笔记.md
        ├── 技术实现对比.md       # 含对比表格
        ├── 开源项目清单.md
        └── RAG领域调研报告.md    # 综合 Summary
```

---

## 5. 产品差异化

### 竞品对比

| 维度 | Todoist | Notion | Obsidian | ChatGPT | **Justime** |
|---|---|---|---|---|---|
| **核心定位** | 任务清单 | 通用 Workspace | 本地笔记 | AI 对话 | **任务进程管理器** |
| **任务模型** | 状态二元（完成/未完成） | 自由结构 | 无内置 | 无 | **三阶段生命周期** |
| **进度追踪** | 手动勾选 | 手动更新 | 无 | 无 | **Evidence 驱动自动评估** |
| **AI 参与度** | 弱 | AI 写作辅助 | 插件支持 | 纯对话 | **6 个专职 Agent 全程介入** |
| **知识沉淀** | 无 | 手动组织 | 手动写作 | 对话消散 | **任务完成后自动生成** |
| **Markdown 输出** | 无 | 有限 | 原生 | 手动复制 | **自动生成多格式 Markdown** |
| **上下文连续性** | 无 | 弱 | 手动维护 | 有限（会话制） | **任务级持久上下文** |
| **本地优先** | 云端 | 云端 | ✅ | 云端 | **✅ 本地知识库** |

### Justime 的独特性

1. **任务是一等公民**：不是列表里的一行文字，而是一个有状态、有证据、有 AI Agent 参与的「进程」
2. **Evidence 驱动**：进度不靠感觉，靠可追溯的证据
3. **AI 不只聊天**：AI 理解你的任务上下文，主动推进而非被动回答
4. **知识自动生长**：不需要你刻意整理笔记，任务完成后知识自然沉淀
5. **闭环体验**：从任务创建到知识归档，不需要在多个工具间跳转

---

## 6. 核心概念定义

### TaskProcess（任务进程）

一个被持续追踪的长期任务实例，拥有完整的 Before / During / After 生命周期。

```typescript
interface TaskProcess {
  id: string;
  title: string;
  description: string;
  goal: string;
  status: 'planned' | 'active' | 'paused' | 'blocked' | 'completed' | 'archived';
  phase: 'before' | 'during' | 'after';
  priority: 'low' | 'medium' | 'high';
  progress: number;            // 0-100, Evidence 驱动计算
  context: TaskContext;         // 上下文信息
  milestones: Milestone[];      // 里程碑列表
  evidence: Evidence[];         // 进度证据
  blockers: Blocker[];          // 阻塞点
  aiSuggestions: AISuggestion[];
  knowledgeOutputs: KnowledgeOutput[];
  createdAt: string;
  updatedAt: string;
}
```

### Phase（阶段）

任务进程的三个核心阶段：

| Phase | 含义 | 核心活动 |
|---|---|---|
| **Before** | 准备阶段 | 目标拆解、资料搜集、计划生成、里程碑建立 |
| **During** | 执行阶段 | 过程记录、Evidence 采集、进度监测、阻塞识别、AI 辅助 |
| **After** | 沉淀阶段 | 复盘总结、Markdown 输出、知识归档、经验提炼 |

### Evidence（证据）

用于证明任务进展的多维数据点。进度评估基于 Evidence 而非主观判断。

```typescript
interface Evidence {
  id: string;
  taskId: string;
  type: 'note' | 'file' | 'chat' | 'code' | 'link' | 'time' | 'manual';
  content: string;
  source: string;               // 证据来源
  confidence: number;           // 置信度 0-1
  milestoneId?: string;         // 关联里程碑
  createdAt: string;
}
```

### Blocker（阻塞点）

AI 识别出的任务推进障碍。可以是知识盲区、工具问题、资源不足等。

### KnowledgeOutput（知识输出）

任务完成后由 AI 自动生成的结构化 Markdown 文档。

```typescript
interface KnowledgeOutput {
  id: string;
  taskId: string;
  title: string;
  path: string;                 // 在 Vault 中的路径
  format: 'summary' | 'tutorial' | 'faq' | 'cheatsheet' | 'debug-log' | 'mindmap';
  markdown: string;             // 完整 Markdown 内容
  tags: string[];               // 分类标签
  createdAt: string;
}
```

### Markdown Vault（本地知识库）

用户本地的 Markdown 文件目录，遵循 Obsidian-compatible 结构：

```
JustimeVault/
├── 00-Inbox/           # 临时收集箱
├── 01-Tasks/           # 任务过程记录
├── 02-Knowledge/       # 知识文档（按主题分类）
├── 03-Projects/        # 项目文档
├── 04-Resources/       # 参考资料
└── 99-Archive/         # 历史归档
```

### Process Cockpit（任务驾驶舱）

Justime 的首页视图，一览所有活跃任务的状态全景：

- 今日活跃任务及其当前阶段
- AI 评估的进度与阻塞预警
- 最近生成的知识文档
- 下一步行动建议
- 任务投入热力图

---

## 7. 技术愿景

### 本地优先 (Local-First)

- 知识文档存储在用户本地文件系统，不依赖云端
- 即使断网也能浏览和管理已有任务与知识库
- 用户完全拥有自己的数据，可随时迁移

### AI 原生 (AI-Native)

- AI 不是功能的附加品，而是产品核心引擎
- 六个 Agent 覆盖任务全生命周期
- 多模型智能路由，平衡成本与质量
- 上下文窗口与任务绑定，消除重复沟通

### macOS 桌面端 (macOS Desktop)

- 通过 Tauri / Electron 封装为原生 macOS 应用
- 提供 DMG 安装包，开箱即用
- 系统级集成：菜单栏入口、本地通知、文件目录选择
- 桌面端可连接本地后端或云端后端

### 渐进式跨平台 (Progressive Cross-Platform)

- **Phase 1**: Web 应用 (当前) — 全功能开发与验证
- **Phase 2**: macOS Desktop — 核心体验优化
- **Phase 3**: iOS / iPadOS — 移动端轻量任务管理
- **Phase 4**: 跨平台同步 — 多设备知识库同步

### 技术架构原则

| 原则 | 含义 |
|---|---|
| **Task-Centric** | 所有功能围绕 TaskProcess 构建，Task 是路由中心 |
| **Evidence-Driven** | 进度评估基于可追溯证据，而非主观估计 |
| **Agent-Orchestrated** | AI 能力通过 Agent 编排而非单次 API 调用实现 |
| **Markdown-Native** | 知识输出以 Markdown 为唯一格式，确保最大兼容性 |
| **Local-First** | 核心数据优先存储在本地，云端为可选增强 |

---

## 8. 度量标准

### 核心指标：如何知道我们成功了

| 指标 | 定义 | 目标 |
|---|---|---|
| **任务完成率** | 进入 During 阶段的任务最终 Complete 的比例 | > 60% |
| **知识文档生成量** | 每个已完成任务平均生成的 KnowledgeOutput 数量 | ≥ 3 篇/任务 |
| **Evidence 密度** | 每个任务在 During 阶段平均产生的 Evidence 数量 | ≥ 5 条/任务 |
| **AI 建议采纳率** | 用户对 AI Suggestion 点击「采纳」的比例 | > 40% |
| **任务恢复时间** | 暂停任务重新激活后，用户恢复上下文所需时间 | < 2 分钟 |
| **Vault 活跃度** | 用户每周在 Vault 中新增/引用的 Markdown 文档数 | 持续增长 |
| **周活跃任务数** | 用户每周至少有 1 条 Evidence 的活跃任务数量 | ≥ 2 个 |

### 用户体验指标

| 指标 | 定义 | 目标 |
|---|---|---|
| **首次任务完成时间** | 新用户从注册到完成第一个完整任务的时间 | < 1 小时 (Demo 任务) |
| **Process Cockpit 访问频率** | 用户每天打开 Cockpit 的次数 | ≥ 2 次/天 |
| **任务上下文满意度** | 恢复暂停任务时，用户对上下文完整性的评分 | > 4/5 |

### 北极星指标

> **每周由任务自动生成并写入 Vault 的 Markdown 文档数量**

这个指标直接衡量了 Justime 的核心价值闭环是否跑通：用户创建任务 → AI 辅助推进 → 自动生成知识文档。如果这个数字在增长，说明用户真的在用 Justime 完成任务并沉淀知识。

---

## 附录：项目演进历史

| 时期 | 定位 | 状态 |
|---|---|---|
| 2025 初期 | AI 驱动聚合工具平台 (AI Chat + Calendar + Knowledge) | 已过渡 |
| 2026-05 | 考研学习助手 (垂直场景尝试) | 已放弃 |
| **2026-06 至今** | **AI 个人任务进程操作系统 (Task Process OS)** | **✅ 当前方向** |

> 项目没有推倒重做。现有的 AI 对话、多模型路由、日程管理、RAG 检索、知识库等能力全部保留，但不再作为平铺功能，而是统一服务于「任务进程」这个核心概念。
