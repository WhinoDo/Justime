# Justime 项目文档导航

欢迎使用 **Justime** 项目文档库。为了保持文档整洁、清晰和易于维护，本项目所有方案、设计和指南均统一管理在 `docs/` 目录下。

---

## 📂 目录结构与索引

```
docs/
├── README.md                    # 本文档（导航索引）
│
├── architecture/                # 架构决策记录 (ADR)
│   ├── legacy-module-inventory.md # 遗留模块盘点与兼容/废弃决策矩阵
│   ├── 2026-06-26-macos-native-migration.md # macOS 原生迁移 ADR
│   ├── macos-native-api-contract.md # macOS 原生 API 契约
│   └── markdown-vault-transport.md # Markdown Vault 本地/远程传输与安全契约
│
├── design/                      # 核心架构与功能设计方案
│   ├── TRANSFORMATION_PLAN.md   # Postgraduate Study Assistant 转型计划与路线图
│   ├── chat-business-refactor.md# chat_business.py 超大型业务流程重构/拆分方案
│   └── sse-resume-design.md     # SSE 流式断点续传与重连机制设计
│
├── plans/                       # 阶段性优化与开发实施计划
│   ├── 2026-05-15-test-coverage.md # 后端、前端测试覆盖率提升计划（包含测试编写用例）
│   ├── 2026-05-09-architecture-workbench.md # 架构节点驱动需求工作台 spec 与实现计划
│   └── 2026-04-17-optimization-plan.md      # 项目优化整改清单与落地改造方案（P0/P1/P2）
│
├── guides/                      # 开发、部署与运维操作指南
│   ├── ci-cd-setup.md           # CI/CD 自动化构建与部署流水线配置
│   └── cron-jobs.md             # 定时任务说明（健康检查、备份、自动优化等）
│
├── changelog/                   # 历史变更记录与 Review 日志
│   └── 2026-04-code-review.md   # 2026年4月代码 Review 记录与整改追踪
│
└── archive/                     # 历史归档文档（已完成或阶段性结束的文档）
    ├── 2026Q1/                  # 2026年第一季度实施方案归档（31个历史微小修复/功能方案）
    └── 2026Q2/                  # 2026年第二季度优化及架构分析报告归档（技术债务、分析报告等）
```

---

## 🧭 查找与维护建议

- **想了解系统当前最新战略方向与架构决策**：优先查看 `docs/design/`。
- **想了解架构决策记录（ADR）与遗留模块盘点**：查看 `docs/architecture/`。
- **想跟进当前正在推进或已排期的开发/优化任务**：查看 `docs/plans/`。
- **想追溯历史改造背景与某具体Bug的解决手段**：查看 `docs/archive/`。
- **添加新文档规范**：请根据上述分类将新文档放入对应目录，并在本项目 `docs/README.md` 中补充索引链接。
