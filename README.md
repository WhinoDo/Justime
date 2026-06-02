# Justime (矩时)

[![Tech Stack](https://img.shields.io/badge/Stack-Fullstack-blueviolet)](https://github.com)
[![AI Powered](https://img.shields.io/badge/AI-DeepSeek%20%7C%20OpenAI-brightgreen)](https://github.com)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile-orange)](https://github.com)

**Justime (矩时)** 是一个高颜值的 **AI 驱动聚合工具平台**。它以 AI 智能路由和模块化工具箱为核心，深度集成智能对话、日程时间管理、高精度 RAG 知识库、书籍分析研讨、工作文档协同等全方位生产力工具，致力于为个人及团队打造一站式的智能数字工作空间。

---

## 📂 项目结构

```
justime/
├── justime_agent/          # Web 前端 (Next.js 14 App Router, React 18, Tailwind)
├── justime_backend/        # 核心后端 (FastAPI, Python 3.10+, Motor, Redis)
├── mobile/justime_mobile/  # 移动端 (Expo 54, React Native 0.81, Expo Router)
├── deployment/homelab/     # Homelab 一键部署配置 (Docker Compose)
├── infrastructure/         # 基础设施配置 (MongoDB, Redis 优化配置)
├── scripts/                # 自动化运维工具箱 (健康检查、备份、定时优化)
└── docs/                   # 统一的项目文档库 (架构设计、开发计划、实施指南)
```

---

## 🛠️ 技术栈

Justime 采用现代前后端分离的多端微服务架构：

| 层级 | 选用技术 / 框架 | 作用说明 |
| :--- | :--- | :--- |
| **Web 前端** | Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI | 极致流畅、高颜值、支持玻璃质感的响应式 BFF 平台 |
| **Python 后端** | FastAPI, Pydantic v2, Motor (Async MongoDB), Redis 7 | 异步高并发核心 API 服务，提供 SSE 断点续传与任务队列 |
| **移动端** | Expo 54, React Native 0.81, Expo Router | 跨平台移动客户端，支持多模型聊天、日程同步及离线 IndexedDB |
| **数据库** | MongoDB 7, Redis 7 (数据存储与缓存/会话) | 提供高吞吐量数据持久化和高效的流式会话续传 |
| **网关与运维** | Caddy 2 (自动 HTTPS 证书), Docker Compose | 生产环境自动化反向代理与容器编排 |
| **AI 引擎** | DeepSeek, OpenAI, DashScope, 阿里云 ASR/TTS | 多模型智能路由 (Auto / Fast / Balanced / Reasoning) |

---

## 💡 核心聚合工具箱

作为一站式聚合工具平台，Justime 提供了丰富的高效子系统：

*   💬 **智能 AI 对话工具 (AI Chat Studio)**
    *   **智能路由**：自动分析请求复杂度，在快速模型（如 DeepSeek-Chat）与深度推理模型（如 DeepSeek-Reasoner）之间智能切换。
    *   **打字机流式输出**：基于 `SSEStreamService` 与 Redis 的 SSE 技术，支持 `Last-Event-ID` 移动端断点续传。
*   📅 **日程与时间规划器 (Calendar & Timing Suite)**
    *   **多维日程视图**：支持日程的创建、编辑、归档与智能提示。
    *   **日程视频解析**：独创日程关联的流媒体视频分析链路。
    *   **任务计时分析**：追踪各项生产力任务的起止与时间分布。
*   📚 **高精度 RAG 知识库 (RAG Knowledge Engine)**
    *   **多格式解析**：支持PDF（包括扫描版）、Markdown、TXT等文档上传与解析。
    *   **高性能 Embedding**：集成向量检索，支持精细化的相关性文档片段高亮引用与居中悬浮预览。
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

### 3. 移动客户端 (`mobile/justime_mobile/`)
```bash
cd mobile/justime_mobile
npm install
cp .env.local.example .env.local  # 配置你的局域网/内网穿透 API 地址
npm start
```
*   使用 Expo Go App 扫描终端二维码即可真机调试。

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

为了保持仓库整洁，我们将开发、设计和运维文档进行了统一分层，详细请阅读：

*   🗺️ **[docs/README.md](./docs/README.md) - 项目文档导航索引**：在此可以一键查找所有的架构设计方案（Design）、当前活跃的迭代计划（Plans）、CI/CD 部署与定时任务配置指南（Guides）以及历史实施归档（Archive）。
*   🚀 **[DEPLOYMENT.md](./DEPLOYMENT.md) - 综合部署指南**：涵盖 Docker 容器部署、手动环境搭建、安全加固及监控告警。
*   🤖 **[AGENTS.md](./AGENTS.md) - AI Agent 协作开发指南**：分配到本项目的 AI 开发者（Agent）**必须首先阅读**的约束规范、目录流向与分层标准。
*   📝 **[CLAUDE.md](./CLAUDE.md) - Claude Code 全局路由指南**：Claude 开发专用操作指引。

---

## 📄 开源协议

[MIT License](./LICENSE)
