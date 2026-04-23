# Jushi Monorepo

本仓库包含两个主要项目：

- `jushi_agent/` 前端（Next.js）
- `jushi_backend/` 后端（FastAPI）

辅助目录：

- `infrastructure/` 本地基础设施资源（如 MongoDB 配置与数据）
- `scripts/` 运行与运维脚本（已按用途分层）
- `文档/` 方案与实施归档（已按状态分层）

## 快速开始

前端启动：

```bash
cd jushi_agent
npm install
npm run dev
```

后端启动：

```bash
cd jushi_backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python start.py
```

默认地址：

- 前端：`http://localhost:3000`
- 后端：`http://127.0.0.1:8080`

## 目录说明

- `jushi_agent/`：前端源码与页面、组件、API 路由等
- `jushi_backend/`：后端分层架构（api/business/services/models/core）
- `infrastructure/`：本地 MongoDB 配置与数据（如需移动请同步更新脚本路径）
- `scripts/dev/`：本地联调与隧道相关脚本
- `scripts/release/`：打包与发布相关脚本
- `scripts/tools/`：工具类脚本
- `文档/当前方案/`：当前仍在执行或对外同步的方案
- `文档/实施归档/2026Q1/`：历史实施方案归档

## 常见问题

- Windows 端口占用：使用 `netstat -ano | findstr :8080` 查找占用并 `taskkill /f /pid <PID>`
- Pydantic v2：`BaseSettings` 由 `pydantic-settings` 提供，请确保已安装

## 其他

更多特性与变更详情见各项目内的 `README.md` 与说明文件。

