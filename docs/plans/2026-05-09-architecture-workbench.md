# Architecture Change Workbench

> 合并自原 `文档/specs/`、`文档/plans/` 下的 3 个相关文档。

---

## Part 1: 产品规格 (Spec)

### 1. Goal

在 `justime-agent` 根目录下单独拉出一个独立前端项目，用于实现"架构节点驱动的需求采集工作台"。用户可以围绕某个主节点填写改动需求、关联受影响节点，并生成一段结构化、可被 AI 继续优化和消费的变更说明。

### 2. Background

当前在做功能设计或需求拆解时，需求通常分散在聊天记录、文档或脑海里，缺少一个"从架构节点切入，再转成 AI 可读描述"的统一入口。对于 `justime-agent` 这种前后端混合 monorepo，需求经常同时影响业务能力和代码落点，纯文本记录容易遗漏依赖关系，也不利于后续转成 spec、implementation plan 或开发 prompt。

这个页面的第一目标不是做一个复杂的架构建模平台，而是做一个高效率的"节点驱动需求工作台"，把架构认知、变更采集和 AI 输出串成一条顺手的工作流。

### 3. In Scope

- 在 `justime-agent` 根目录下新增一个独立前端项目
- 该独立项目包含一个工作台页面，用于展示预置的架构节点
- 节点采用混合模式：同时表示业务能力和代码映射
- 用户可以选择一个主节点
- 用户可以添加 0 到多个关联节点
- 用户可以围绕主节点填写需求核心字段
- 页面可以生成底部结构化输出区
- 结构化输出支持三类后续 AI 动作：补全需求、转成 Spec 草稿、转成开发 Prompt
- 支持复制结构化输出

### 4. Out of Scope

- 不把该能力直接实现进现有 `justime_agent` 前端路由体系
- 不做自由拖拽式架构图编辑器
- 不做自动扫描整个仓库并自动生成架构图
- 不做多人协作和权限控制
- 不做复杂版本历史
- 不做真正的后端持久化存储能力作为第一版前置条件
- 不做完整项目管理系统式的任务流转

### 5. User-Visible Behavior

用户进入页面后，可以看到一组架构节点。每个节点展示：节点名称、业务能力摘要、主要代码映射、依赖或风险标签。

用户先选择一个主节点，再填写改动标题、目标、用户可见变化、约束、验收标准等字段。随后可以继续选择关联节点，并为每个关联节点补充"为什么受影响"的说明。

点击"生成结构化说明"后，页面在底部输出一个稳定结构的变更说明。用户可以继续点击：补全需求、转成 Spec 草稿、转成开发 Prompt。

### 6. Information Architecture

独立项目中的主页面采用三段式布局：

- **Left: Node Navigation** — 展示架构节点列表或分组节点树，用于选择主节点，提供节点搜索和快速切换
- **Center: Change Editing Workbench** — 展示当前主节点详情、业务含义、代码映射、依赖和风险，提供需求输入表单和关联节点选择器
- **Bottom: Structured Output Area** — 展示 AI 可读结构化需求说明，支持 Brief View 与 Structured View，提供复制、补全需求、转 Spec 草稿、转开发 Prompt 等动作

### 7. Node Model

第一版节点是预置数据，不要求自动从代码仓库实时推导。每个节点同时包含业务能力信息和代码映射信息。

建议字段：`id`, `name`, `type`, `summary`, `frontendPaths`, `backendPaths`, `dependencies`, `riskTags`

### 8. Change Draft Model

页面中的需求草稿至少包含：`title`, `goal`, `userVisibleChange`, `constraints`, `acceptanceCriteria`, `openQuestions`, `primaryNodeId`, `relatedNodes`

关联节点建议包含：`nodeId`, `reason`, `impactType`

### 9. Structured Output Format

底部结构化输出固定成稳定结构：Change Title, Goal, Primary Node, Related Nodes, User-Visible Change, Technical Impact, Constraints / Out of Scope, Acceptance Criteria, Open Questions

### 10. Acceptance Criteria

- 用户可以选择一个主节点
- 用户可以添加关联节点并说明受影响原因
- 用户可以填写核心需求字段
- 页面可以生成稳定结构的 AI 可读需求说明
- 页面底部存在结构化输出区
- 页面至少提供"补全需求 / 转成 Spec 草稿 / 转成开发 Prompt"三个动作入口
- 第一版不依赖复杂拖拽图编辑器即可完成完整工作流

---

## Part 2: Implementation Plan

> 原文件: `2026-05-09-architecture-change-workbench-implementation-plan.md`

**Tech Stack:** Next.js 14, React 18, plain JavaScript, Tailwind CSS, Node built-in test runner

### Task 1: Create the standalone project scaffold
- [ ] Add a minimal Next.js app shell with App Router and Tailwind
- [ ] Make the page a client-side workbench host
- [ ] Keep the project isolated from the existing `justime_agent` app

### Task 2: Add the workbench data model and UI components
- [ ] Define static architecture nodes with business and code mapping metadata
- [ ] Build the left navigation, center edit workbench, and bottom output area
- [ ] Generate a stable structured brief from the selected node and drafted fields

### Task 3: Add AI-action transformations and verification
- [ ] Add a local API route that accepts a structured brief and a mode: `complete`, `spec`, or `prompt`
- [ ] Return deterministic text transformations that mimic model-ready outputs
- [ ] Add a narrow node-based verification test for structured brief generation
- [ ] Document how to run the standalone app

### Task 4: Run verification
- [ ] Run the narrow verification script or test target
- [ ] If dependencies are available, run the project lint command
- [ ] Report anything that could not be verified locally

---

## Part 3: Node Tree & Mindmap Enhancement Plan

> 原文件: `2026-05-09-architecture-node-tree-mindmap-plan.md`

**Goal:** 升级架构工作台，支持分组树导航和关系图可视化。

### Task 1: Extend node metadata for grouping and search
- [ ] Add curated `group` and `aliases` metadata for high-signal nodes
- [ ] Preserve optional override fields when the extractor merges generated nodes
- [ ] Re-run the extractor so runtime node data includes the new metadata

### Task 2: Add pure helpers for grouped tree and relationship graph
- [ ] Write failing tests for node grouping, search filtering, and relationship graph derivation
- [ ] Implement grouped tree sections, searchable node matching, primary node graph rings, related-node highlighting
- [ ] Re-run the test target until green

### Task 3: Replace flat node list with grouped expandable navigation
- [ ] Convert the left sidebar into grouped expandable sections
- [ ] Keep search working against node names, summaries, and aliases
- [ ] Keep primary-node selection stable when changing sections or search terms

### Task 4: Add a lightweight mindmap-style relationship graph
- [ ] Render a centered primary node with first-ring dependency nodes and second-ring candidates
- [ ] Let users click a node card to switch the primary node
- [ ] Let users use a dedicated `+` action to add related nodes
- [ ] Visually highlight already-related nodes

### Task 5: Verify and document
- [ ] Run `node --test tests/brief-builder.test.mjs tests/node-graph.test.mjs`
- [ ] Run `npm run lint` if local dependencies are available
- [ ] Verify grouped expand/collapse, graph selection, and related-node highlighting
