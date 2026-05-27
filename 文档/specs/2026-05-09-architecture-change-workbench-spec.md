# Architecture Change Workbench Spec

## 1. Goal

在 `justime-agent` 根目录下单独拉出一个独立前端项目，用于实现“架构节点驱动的需求采集工作台”。用户可以围绕某个主节点填写改动需求、关联受影响节点，并生成一段结构化、可被 AI 继续优化和消费的变更说明。

## 2. Background

当前在做功能设计或需求拆解时，需求通常分散在聊天记录、文档或脑海里，缺少一个“从架构节点切入，再转成 AI 可读描述”的统一入口。对于 `justime-agent` 这种前后端混合 monorepo，需求经常同时影响业务能力和代码落点，纯文本记录容易遗漏依赖关系，也不利于后续转成 spec、implementation plan 或开发 prompt。

这个页面的第一目标不是做一个复杂的架构建模平台，而是做一个高效率的“节点驱动需求工作台”，把架构认知、变更采集和 AI 输出串成一条顺手的工作流。

根据最新要求，这个能力不应塞进现有 `justime_agent` 前端，而应作为 `justime-agent` 根目录下的独立项目实现。这样可以避免把探索型工作台和现有业务前端强耦合，也更便于单独演进界面、路由和依赖。

## 3. In Scope

- 在 `justime-agent` 根目录下新增一个独立前端项目
- 该独立项目包含一个工作台页面，用于展示预置的架构节点
- 节点采用混合模式：同时表示业务能力和代码映射
- 用户可以选择一个主节点
- 用户可以添加 0 到多个关联节点
- 用户可以围绕主节点填写需求核心字段
- 页面可以生成底部结构化输出区
- 结构化输出支持三类后续 AI 动作：
  - 补全需求
  - 转成 Spec 草稿
  - 转成开发 Prompt
- 支持复制结构化输出

## 4. Out of Scope

- 不把该能力直接实现进现有 `justime_agent` 前端路由体系
- 不做自由拖拽式架构图编辑器
- 不做自动扫描整个仓库并自动生成架构图
- 不做多人协作和权限控制
- 不做复杂版本历史
- 不做真正的后端持久化存储能力作为第一版前置条件
- 不做完整项目管理系统式的任务流转

## 5. Primary Users

- 需要围绕某个系统模块提出改动需求的人
- 需要把业务想法快速转成 AI 可读输入的人
- 需要在前后端联动改动中保持需求边界清晰的人

## 6. User-Visible Behavior

用户进入页面后，可以看到一组架构节点。每个节点展示：

- 节点名称
- 业务能力摘要
- 主要代码映射
- 依赖或风险标签

用户先选择一个主节点，再填写改动标题、目标、用户可见变化、约束、验收标准等字段。随后可以继续选择关联节点，并为每个关联节点补充“为什么受影响”的说明。

点击“生成结构化说明”后，页面在底部输出一个稳定结构的变更说明。用户可以继续点击：

- 补全需求
- 转成 Spec 草稿
- 转成开发 Prompt

这些动作会基于当前结构化说明继续优化内容，而不是从零重新生成。

## 7. Information Architecture

独立项目中的主页面采用三段式布局：

### Left: Node Navigation

- 展示架构节点列表或分组节点树
- 用于选择主节点
- 提供节点搜索和快速切换

### Center: Change Editing Workbench

- 展示当前主节点详情
- 展示节点业务含义、代码映射、依赖和风险
- 提供需求输入表单
- 提供关联节点选择器

### Bottom: Structured Output Area

- 展示 AI 可读结构化需求说明
- 支持 Brief View 与 Structured View
- 提供复制、补全需求、转 Spec 草稿、转开发 Prompt 等动作

## 8. Interaction Model

采用：

- `底部输出区`
- `单主节点 + 关联节点`

的交互方式。

设计原则：

- 始终只有一个主节点，保证页面主线清晰
- 关联节点只表达影响扩散，不与主节点争夺中心
- 输出区位于底部，给中间编辑区域更多横向空间

## 9. Node Model

第一版节点是预置数据，不要求自动从代码仓库实时推导。

每个节点同时包含两类信息：

- 业务能力信息
- 代码映射信息

建议字段：

- `id`
- `name`
- `type`
- `summary`
- `frontendPaths`
- `backendPaths`
- `dependencies`
- `riskTags`

## 10. Change Draft Model

页面中的需求草稿至少包含：

- `title`
- `goal`
- `userVisibleChange`
- `constraints`
- `acceptanceCriteria`
- `openQuestions`
- `primaryNodeId`
- `relatedNodes`

关联节点建议包含：

- `nodeId`
- `reason`
- `impactType`

## 11. Structured Output Format

底部结构化输出建议固定成稳定结构，而不是一大段自由 prose。

### Required Fields

- `Change Title`
- `Goal`
- `Primary Node`
- `Related Nodes`
- `User-Visible Change`
- `Technical Impact`
- `Constraints / Out of Scope`
- `Acceptance Criteria`
- `Open Questions`

### Example Shape

```md
# Structured Change Brief

## Change Title
Distinguish login failure types

## Goal
Help users distinguish credential errors from service errors during login.

## Primary Node
User Authentication

## Related Nodes
- Profile
- Chat Assistant

## User-Visible Change
- Wrong password shows credential-specific feedback
- Service failure shows retry-later feedback

## Technical Impact
- Frontend login form error handling
- Backend auth response schema
- Shared auth state handling

## Constraints / Out of Scope
- No registration flow changes
- No token persistence redesign

## Acceptance Criteria
- Credential and service failures display different messages
- Existing successful login flow remains unchanged

## Open Questions
- Does mobile reuse the same auth error structure?
```

## 12. AI Action Design

页面中的 AI 动作不应是一个模糊的“AI 优化”按钮，而应拆成明确结果导向：

### 补全需求

作用：

- 补充缺失字段
- 明确验收标准
- 提醒潜在影响面

### 转成 Spec 草稿

作用：

- 把当前结构化说明扩展成正式 spec 草稿
- 便于接入现有 `spec-first` 工作流

### 转成开发 Prompt

作用：

- 生成一段更适合交给 AI 开发助手执行的 prompt

## 13. Technical Surfaces

预计会涉及：

- 在 `justime-agent` 根目录下新增独立项目目录
- 建议目录名：`architecture_workbench/`
- 独立项目内包含页面、组件、样式和本地节点数据
- 如需调用模型优化，可在独立项目内新增 API route 或先提供前端占位能力

第一版尽量保持前端闭环，模型调用可以先通过独立项目自己的前端能力或预留接口实现，而不是依赖现有 `justime_agent` 页面体系。

## 14. Verification

第一版至少需要：

- `cd /Users/zhuyx/code/justime-agent/architecture_workbench && npm run lint`
- 如独立项目补充了测试能力，增加页面级或组件级测试
- 手动验证主流程：
  - 选择主节点
  - 添加关联节点
  - 生成结构化说明
  - 切换输出视图
  - 点击 AI 动作按钮

## 15. Risks / Open Questions

- 独立项目是否直接复用 `justime_agent` 的技术栈和 UI 组件，还是只复用设计语言，需要在 implementation plan 里定清楚
- 第一版节点数据是静态配置还是页面内置 mock 数据，需要在实现时定一个简单方案
- AI 优化动作是否直接接模型接口，还是先用本地 mock/占位逻辑，需要按当前项目 API 能力判断
- 如果一个需求涉及大量关联节点，当前“单主节点 + 关联节点”模型是否仍足够，需要后续观察

## 16. Acceptance Criteria

- 用户可以选择一个主节点
- 用户可以添加关联节点并说明受影响原因
- 用户可以填写核心需求字段
- 页面可以生成稳定结构的 AI 可读需求说明
- 页面底部存在结构化输出区
- 页面至少提供“补全需求 / 转成 Spec 草稿 / 转成开发 Prompt”三个动作入口
- 第一版不依赖复杂拖拽图编辑器即可完成完整工作流
