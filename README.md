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
├── apps/macos-native/      # 主 macOS 原生壳 (SwiftUI/AppKit + WKWebView)
├── apps/desktop/           # Electron 31 生产 fallback
├── mobile/jushi_mobile/    # 活跃移动客户端 (Expo)
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
| **macOS 原生壳** | SwiftUI/AppKit, WKWebView, SwiftPM | 主桌面技术路线，复用现有 Next.js Web 界面并逐步接入原生能力 |
| **桌面 fallback** | Electron 31（macOS） | 原生应用通过全部发布门禁前保留的受支持生产 fallback |

---

## 💡 核心能力

Justime 以「任务进程」为一等公民，所有能力围绕任务的完整生命周期构建：

*   💬 **智能 AI 对话工具 (AI Chat Studio)**
    *   **智能路由**：自动分析请求复杂度，在快速模型（如 DeepSeek-Chat）与深度推理模型（如 DeepSeek-Reasoner）之间智能切换。
    *   **打字机流式输出**：基于 `SSEStreamService` 与 Redis 的 SSE 技术，支持 `Last-Event-ID` 移动端断点续传。
*   📅 **日程与时间规划器 (Calendar & Timing Suite)**
    *   **多维日程视图**：支持日程的创建、编辑、归档与智能提示。
    *   **日程视频解析**：独创日程关联的流媒体视频分析链路。
    *   **任务计时分析**：追踪各项生产力任务的起止与时间分布。
*   📚 **高精度 RAG 知识库 (通过云服务厂商 API)**
    *   **多格式解析**：支持 PDF（包括扫描版）、Markdown、TXT 等文档上传与云端解析。
    *   **云端向量检索**：通过云服务厂商 API 实现 Embedding 与检索，支持精细化的相关性文档片段高亮引用与居中悬浮预览。
*   📝 **工作文档协作空间 (Work Documents Workspace)**
    *   支持结构化个人工作文档创建、管理和 AI 辅助编写，保证灵感即时落地。
*   🔍 **NotebookLM 式书籍深度研讨 (Book Analysis Workspace)**
    *   多维度分析大部头书籍，提取核心脉络并进行交互式智能问答。
*   📊 **全动态管理控制台 (Admin Control Panel)**
    *   全玻璃质感 UI 仪表盘，可视化 Token 日用量，动态配置 LLM 模型、限流策略及用户权限。

---

## 🚀 快速开始

开发环境下启动各端服务的标准指令：

### 1. 核心后端 (`justime_backend/`)
```bash
cd justime_backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.lock
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

### 3. macOS 原生壳 (`apps/macos-native/`)

需要 macOS 13+、Swift 5.9+（Xcode 15+）：

```bash
cd apps/macos-native
bash scripts/setup-sparkle.sh
swift build
swift test
```

Sparkle 二进制依赖位于 gitignored 的 `Frameworks/`，fresh checkout 需要联网运行一次 setup 脚本。运行原生壳前先启动 Web 前端；默认加载 `http://localhost:3000`：

```bash
cd apps/macos-native
swift run
```

> `swift build`、`swift test` 和无凭据 smoke gate 已有通过证据，但生产签名、公证、Gatekeeper 与 Sparkle 更新仍需要外部凭据和发布决策。当前状态以 [macOS Native Release Gates](./docs/runbooks/macos-native-release-gates.md) 为准。

### 4. Electron fallback (`apps/desktop/`)

原生应用通过全部发布门禁前，Electron 壳继续作为受支持的生产 fallback：

```bash
cd apps/desktop
npm install
npm run dev
```

桌面端默认加载 `http://localhost:3000`。可通过 `JUSTIME_DESKTOP_URL` 环境变量或应用菜单 `Justime > Configure App URL` 设置远程地址。

构建 unsigned DMG：

```bash
cd apps/desktop
npm run pack       # 构建 unsigned 目录包（仅用于 smoke test）
npm run dist:dmg   # 构建完整 unsigned DMG
```

> Electron 构建同样不能替代原生应用的签名、公证与更新门禁证据；不要从本地 unsigned 构建推断公开发布状态。

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
*   🖥️ **[docs/architecture/2026-06-26-macos-native-migration.md](./docs/architecture/2026-06-26-macos-native-migration.md) - macOS 原生迁移 ADR**：SwiftUI/AppKit + WKWebView 主路线、Electron fallback 与分阶段迁移门禁。
*   ✅ **[docs/runbooks/macos-native-release-gates.md](./docs/runbooks/macos-native-release-gates.md) - macOS 原生发布门禁**：无凭据构建/测试证据及仍需外部输入的签名、公证和 Sparkle 条件。
*   🚀 **[DEPLOYMENT.md](./DEPLOYMENT.md) - 综合部署指南**：涵盖 Docker 容器部署、手动环境搭建、安全加固及监控告警。
*   🤖 **[AGENTS.md](./AGENTS.md) - AI Agent 协作开发指南**：分配到本项目的 AI 开发者（Agent）**必须首先阅读**的约束规范、目录流向与分层标准。

---

## 📄 开源协议

[MIT License](./LICENSE)
