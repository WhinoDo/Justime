# Remaining TaskProcess Refactor Items

> 基于 `docs/plans/Justime_AI_Task_Process_OS_Roadmap.md` 与当前代码状态整理。
> 目的：明确哪些内容还未修改，哪些内容只改了一半，便于后续继续推进。

## 1. 后端仍未完成
- `database/indexes.py` 中为 `task_processes`、`evidence`、`knowledge_outputs` 显式补 MongoDB 索引。
- `services/task_agent_service.py` 尚未达到规划中的完整统一 Agent 形态，`plan / research / monitor / coach / summarize / knowledge` 全模式和工具链未全部打通。
- `services/markdown_export_service.py` 尚未完成完整 Vault 安全策略：
  - 路径冲突检测
  - 覆盖策略配置
  - 更完整的本地路径安全校验
- `KnowledgeOutput` 的 YAML Frontmatter 标准化输出仍不完整。
- `KnowledgeOutput` 的 `[[Wikilinks]]` 双链自动生成逻辑仍未完成。
- 新知识生成后的 RAG 索引增量更新仍未实现。
- 日历事件完成情况自动沉淀为 `milestone_complete` 类型 Evidence 仍未接通。
- Git / 文件 / 链接等多类型 Evidence 采集仍未补齐，目前主要是 `note / time_log / chat`。
- `ReviewSchedule -> KnowledgeOutput` 的复习维度和 SM-2 机制仍未实现。
- `BookAnalysis -> category='reading'` 的任务化收口仍未完成。
- `task_timing` 旧能力与 `Evidence(type='time_log')` 的彻底收口仍未完成。
- `rollback_knowledge_output` 的后端接口测试仍未补。

## 2. 前端任务系统仍未完成
- 任务详情页还不是规划中的完整 Before / During / After 工作台。
- `Before` 面板缺少：
  - 网络资料收集区
  - 前置准备清单
  - 更强的 milestone 编辑能力
- `During` 面板缺少真正的 Evidence Timeline / 证据树展示。
- `During` 面板缺少拖入文件、关联 Git、关联链接等输入入口。
- `During` 面板缺少 AI Blocker 诊断区和下一步建议区。
- `After` 面板现在只是轻量摘要，距离“Knowledge Cards 预览 + Markdown 预览组件”还有差距。
- `/tasks` 主列表仍缺完整过滤 / 排序 / 搜索 UI。
- Dashboard 虽已接入任务驾驶舱入口，但还没完成规划中的完整 `Process Cockpit`。
- 任务热力图与时间投入的 Recharts 可视化还没做。
- 跨任务的 AI 建议流还没做。
- `Framer Motion` 的三阶段平滑切换还没做。

## 3. Chat / Task / Calendar 融合仍未完成
- Chat 已能绑定 Task，但“每场对话必须绑定 TaskProcess”这一约束还没彻底收紧。
- Chat 自动沉淀为 Evidence 已接通，但还没有更细的结构化提取策略。
- 日历里程碑一键同步到飞书 / 系统日历仍未完成。
- Calendar 与 TaskProcess 的双向联动仍不完整。
- 任务里程碑完成自动回写任务阶段 / 进度的链路仍未完全打通。

## 4. `/study` 兼容收口仍未彻底完成
- `/study` 已改为读取 `task_processes`，但旧 `study` 模块代码仍大量存在。
- `study` 相关旧页面 / 旧 hooks / 旧 API 还没有进入真正清理期。
- `Phase 3: 移除 study 相关模型及废弃代码` 还没开始。
- `study_reports`、`study_tools`、`study_agent_business` 等旧链路还没决定保留边界或迁移边界。

## 5. Vault / Obsidian 深度互操作仍未完成
- 用户自定义 Vault 路径的完整设置入口前端还没做。
- Vault 发布前的路径预览与结果预览还没做。
- Frontmatter 模板自定义还没做。
- 分类到本地目录的映射配置 UI 还没做。
- 发布后的文件变更追踪、重复文件冲突策略还没做。

## 6. 离线与本地化仍未开始
- IndexedDB / 本地缓存降级方案未实现。
- Evidence 离线暂存与网络恢复重试未实现。
- Markdown 导出离线模板降级未实现。
- 本地全文检索降级未实现。
- SQLite 本地后端方案未开始。
- Ollama / ChromaDB 本地纯净版未开始。

## 7. macOS 桌面端仍未开始
- `apps/desktop/` 工程目录还未创建。
- Electron MVP 封装未开始。
- `electron-builder` 与 DMG 打包脚本未开始。
- 桌面端环境变量切换未开始。
- 本地文件权限获取流程未开始。
- macOS 系统通知与状态栏菜单未开始。

## 8. 端到端联调仍未完成
- “学习 Python 虚拟环境” 端到端 Demo 还没跑通验收。
- 多模型路由与 SSE 断流重连的真实联调还没完成。
- 首个稳定版 `Justime.dmg` 还没开始打包。

## 9. 测试层仍欠缺
- 后端 TaskProcess / Evidence / KnowledgeOutput 的完整接口测试覆盖还不够。
- Vault 发布冲突 / 覆盖 / 路径变更的后端测试还没补。
- `rollback` 的前后端联调用例还没补。
- `/study` URL filter 恢复行为还没单独补前端测试。
- Process Cockpit / Dashboard 级别的页面行为测试还没补。

## 10. 已修改但未完全收口的部分
- `KnowledgeOutput`：已支持编辑、发布、版本历史、回滚，但还缺：
  - 版本对比
  - 指定版本预览
  - 回滚后的差异提示
- `/study`：已做学习任务专用筛选，但仍未完成旧模块清退。
- 任务详情页：已拆出独立 KnowledgeOutput 面板，但 Before / During 的专业工作台还不完整。
- Chat 绑定任务：已打通基础链路，但还没有彻底约束和统一所有入口。

## 11. 建议的后续执行顺序
1. 先补后端索引、Vault 策略、KnowledgeOutput 测试闭环。
2. 再完善任务详情页的 Before / During 专业工作台。
3. 然后清退旧 `study` 模块与兼容层。
4. 最后推进桌面端封装、离线能力和 DMG 打包。
