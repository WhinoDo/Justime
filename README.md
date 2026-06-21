# Justime (矩时)

[![Task Process OS](https://img.shields.io/badge/Concept-Task%20Process%20OS-blueviolet)](https://github.com)
[![AI Powered](https://img.shields.io/badge/AI-DeepSeek%20%7C%20OpenAI-brightgreen)](https://github.com)
[![Platform](https://img.shields.io/badge/Platform-macOS%20Desktop-blue)](https://github.com)
[![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20MongoDB-orange)](https://github.com)

> 面向个人知识工作的 AI 任务进程操作系统
>
> *AI Task Process OS for Personal Knowledge Work*

**Justime (矩时)** 是一个 AI 驱动的个人任务进程管理器。它以任务为中心，持续追踪任务的 Before / During / After 三阶段状态，借助 AI Agent 协助任务推进，并在任务完成后将过程成果自动转化为结构化 Markdown 知识库——最终形成从「任务创建」到「知识沉淀」的完整闭环。

---

## 📂 项目结构

```
justime/
├── justime_agent/          # Web 前端 (Next.js 14 App Router, React 18, Tailwind)
├── justime_backend/        # 核心后端 (FastAPI, Python 3.10+, Motor, Redis)
├── deployment/homelab/     # Homelab 一键部署配置 (Docker Compose)
├── infrastructure/         # 基础设施配置 (MongoDB, Redis 优化配置)
├── scripts/                # 自动化运维工具箱 (健康检查、备份、定时优化)
└── docs/                   # 统一的项目文档库 (产品愿景、架构设计、开发计划)
```

---

## 🛠️ 技术栈

Justime 采用现代前后端分离架构，面向 macOS 桌面端优化：

| 层级 | 选用技术 / 框架 | 作用说明 |
| :--- | :--- | :--- |
| **Web 前端** | Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI | 响应式 BFF 平台，提供 Process Cockpit 与任务详情三阶段视图 |
| **Python 后端** | FastAPI, Pydantic v2, Motor (Async MongoDB), Redis 7 | 异步高并发核心 API，Task Process 状态机、Agent 编排、SSE 流式输出 |
| **数据库** | MongoDB 7, Redis 7 | 任务进程持久化、Evidence 存储、缓存与流式会话续传 |
| **网关与运维** | Caddy 2 (自动 HTTPS 证书), Docker Compose | 生产环境自动化反向代理与容器编排 |
| **AI 引擎** | DeepSeek, OpenAI, DashScope | 多模型智能路由 (Auto / Fast / Balanced / Reasoning) |
| **桌面端** | Tauri / Electron (规划中) | macOS DMG 打包，本地文件访问与 Markdown Vault 管理 |

---

## 💡 核心能力

Justime 以「任务进程」为一等公民，所有能力围绕任务的完整生命周期构建：

*   🎯 **任务进程管理 (Task Process Management)**
    *   **三阶段生命周期**：每个任务经历 Before（目标拆解、资料准备、计划生成）→ During（执行记录、Evidence 采集、进度监测、阻塞识别）→ After（复盘总结、Markdown 输出、知识归档）。
    *   **Evidence 驱动进度**：进度不靠手动拖拽，而是基于笔记、文件、对话、代码提交、学习时长等多维证据自动评估。
    *   **Process Cockpit**：首页任务驾驶舱，展示活跃任务状态、进度、阻塞点和 AI 建议。

*   🤖 **AI Agent 协作 (AI Agent Orchestration)**
    *   **Planner Agent**：将模糊目标拆解为阶段、里程碑和资料清单。
    *   **Research Agent**：自动搜集参考资料，生成摘要与链接。
    *   **Monitor Agent**：根据 Evidence 判断进度与阻塞点。
    *   **Coach Agent**：给出下一步行动建议。
    *   **Summarizer Agent**：阶段总结与任务复盘。
    *   **Knowledge Agent**：生成结构化 Markdown 并归档到知识库。

*   📚 **Markdown 知识沉淀 (Knowledge Vault)**
    *   **自动生成**：任务完成后 AI 自动生成 Summary、Tutorial、FAQ、Cheatsheet 等多种格式的 Markdown 文档。
    *   **Obsidian 兼容**：输出目录结构与 Obsidian Vault 完全兼容，支持双链、标签和 Wikilink。
    *   **本地优先**：所有知识文档存储在本地 `JustimeVault/` 目录，数据完全归用户所有。

*   💬 **智能对话 (AI Chat)**
    *   **任务绑定**：对话不再是孤立聊天，而是绑定到具体 Task Process，自动携带任务上下文。
    *   **智能路由**：自动分析请求复杂度，在快速模型与深度推理模型之间智能切换。
    *   **流式输出**：基于 SSE + Redis 的打字机效果，支持断点续传。

*   📅 **日程管理 (Calendar)**
    *   **任务关联**：日程事件可直接关联 Task Process，自动追踪任务时间投入。
    *   **多维视图**：支持日程创建、编辑、归档与智能提示。

*   🔍 **RAG 知识检索 (Knowledge Search)**
    *   **向量检索**：集成高性能 Embedding，支持对任务产出知识和上传文档的语义化检索。
    *   **多格式解析**：支持 PDF（包括扫描版）、Markdown、TXT 等文档的解析与索引。

*   🖥️ **macOS 桌面端 (Desktop App)** `Coming Soon`
    *   Tauri / Electron 封装，生成可安装的 `Justime.dmg`。
    *   本地文件目录选择、菜单栏入口、系统通知。
    *   支持离线任务管理与知识库浏览。

---

## 🚀 快速开始

开发环境下启动各端服务的标准指令：

### 1. 核心后端 (`justime_backend/`)
```bash
cd justime_backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python start.py
```
*   后端运行地址: `http://127.0.0.1:8080`
*   Swagger 交互式 API 文档: `http://127.0.0.1:8080/docs`

### 2. Web 前端 BFF (`justime_agent/`)
```bash
cd justime_agent
npm install
npm run dev
```
*   前端运行地址: `http://localhost:3000`

---

## 🔒 生产环境一键部署

项目推荐使用 **Docker Compose** 进行 Homelab 及云服务器部署。

```bash
cd deployment/homelab
cp .env.example .env
# 编辑 .env 文件，填入你的 JWT_SECRET 和 AI API 密钥
docker compose up -d
```
> 详细手动部署指南、容器编排、自动网关与 HTTPS 证书配置，请参见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

---

## 🛠️ 测试与工程质量

我们在各端配置了严格的代码质量检查和自动测试流：

```bash
# 运行前端 Next.js 单元测试 (Jest)
cd justime_agent && npm test

# 运行后端 FastAPI 单元测试 (Pytest)
cd justime_backend && pytest tests/ -v --tb=short
```

---

## 🧭 文档指引

*   🗺️ **[docs/README.md](./docs/README.md) - 项目文档导航索引**：在此可以一键查找所有的架构设计方案（Design）、当前活跃的迭代计划（Plans）、CI/CD 部署与定时任务配置指南（Guides）以及历史实施归档（Archive）。
*   📐 **[docs/plans/product-vision.md](./docs/plans/product-vision.md) - 产品愿景文档**：Justime 的完整产品定位、核心概念定义、用户场景与差异化分析。
*   🗓️ **[docs/plans/Justime_AI_Task_Process_OS_Roadmap.md](./docs/plans/Justime_AI_Task_Process_OS_Roadmap.md) - 产品路线图**：从 Phase 0 到 Phase 5 的完整开发计划。
*   🚀 **[DEPLOYMENT.md](./DEPLOYMENT.md) - 综合部署指南**：涵盖 Docker 容器部署、手动环境搭建、安全加固及监控告警。
*   🤖 **[AGENTS.md](./AGENTS.md) - AI Agent 协作开发指南**：分配到本项目的 AI 开发者（Agent）**必须首先阅读**的约束规范、目录流向与分层标准。

---

## 📄 开源协议

[MIT License](./LICENSE)
