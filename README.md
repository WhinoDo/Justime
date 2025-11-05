# Jushi Monorepo

本仓库包含两个主要项目：

- `jushi_agent/` 前端（Next.js）
- `jushi_backend/` 后端（FastAPI）

辅助目录：

- `infrastructure/` 本地基础设施资源（如 MongoDB 配置与数据）

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

## 常见问题

- Windows 端口占用：使用 `netstat -ano | findstr :8080` 查找占用并 `taskkill /f /pid <PID>`
- Pydantic v2：`BaseSettings` 由 `pydantic-settings` 提供，请确保已安装

## 其他

更多特性与变更详情见各项目内的 `README.md` 与说明文件。


