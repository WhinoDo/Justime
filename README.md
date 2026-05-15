# Jushi (聚石)

AI 智能助手平台，集成对话、日程管理、知识库、书籍分析等功能。

## 项目结构

```
jushi/
├── jushi_agent/          # 前端 (Next.js 14)
├── jushi_backend/        # 后端 (FastAPI)
├── mobile/jushi_mobile/  # 移动端 (Expo / React Native)
├── deployment/homelab/   # Docker Compose 部署配置
├── infrastructure/       # 本地基础设施 (MongoDB 配置)
├── scripts/              # 运维脚本
├── docs/                 # 方案与实施文档
└── 文档/                  # 方案归档
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14, React 18, Tailwind CSS, Radix UI |
| 后端 | FastAPI, Python 3.10+, Pydantic v2 |
| 移动端 | Expo 54, React Native 0.81 |
| 数据库 | MongoDB 7, Redis 7 |
| 网关 | Caddy 2 (自动 HTTPS) |
| AI | OpenAI / DeepSeek / DashScope API |

## 核心功能

- **AI 对话**: 多模型支持，智能路由，上下文管理
- **日程管理**: 日历视图，事件创建与编辑
- **知识库**: 文档上传，RAG 检索增强
- **书籍分析**: NotebookLM 集成，书籍内容分析
- **语音服务**: 阿里云 ASR/TTS 集成
- **管理后台**: 用户管理，API Key 管理，模型配置

## 快速开始

### 前端

```bash
cd jushi_agent
npm install
npm run dev
```

### 后端

```bash
cd jushi_backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python start.py
```

### 移动端

```bash
cd mobile/jushi_mobile
npm install
cp .env.local.example .env.local
npm start
```

默认地址:
- 前端: `http://localhost:3000`
- 后端: `http://127.0.0.1:8080`
- API 文档: `http://127.0.0.1:8080/docs`
- 移动端: 通过 Expo Go 扫码访问

## 环境变量

### 前端 (jushi_agent/.env.local)

```env
NEXT_PUBLIC_BACKEND_URL=/backend
NEXT_PUBLIC_APP_NAME=聚石智能助手
MONGODB_URI=mongodb://127.0.0.1:27017/jushi_agent
JWT_SECRET=your-jwt-secret-min-32-chars
```

### 后端 (jushi_backend/.env)

```env
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
ENCRYPTION_SECRET=your-encryption-secret-min-32-chars
MONGODB_URI=mongodb://127.0.0.1:27017/jushi-agent
MONGODB_DB_NAME=jushi-agent
REDIS_URL=redis://127.0.0.1:6379/0
DEEPSEEK_API_KEY=your-api-key
```

生成密钥: `openssl rand -hex 32`

## 部署

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

快速启动 (Docker Compose):

```bash
cd deployment/homelab
cp .env.example .env
# 编辑 .env 填入真实配置
docker compose up -d
```

## API 文档

后端启动后访问:
- Swagger UI: `http://127.0.0.1:8080/docs`
- ReDoc: `http://127.0.0.1:8080/redoc`

## 开发

### 代码规范

- 前端: ESLint + Prettier
- 后端: Python 类型注解 + Pydantic

### 测试

```bash
# 前端
cd jushi_agent && npm test

# 后端
cd jushi_backend && pytest
```

### CI/CD

项目使用 GitHub Actions，每次 PR 和 main 分支推送自动运行:
- 前端: ESLint, TypeScript 检查, Jest 测试
- 后端: 类型检查, Pytest 测试

## 文档索引

| 文档 | 说明 |
|------|------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 部署指南总览 |
| [docs/deployment-overview.md](./docs/deployment-overview.md) | 部署架构说明 |
| [docs/mobile-deployment-guide.md](./docs/mobile-deployment-guide.md) | 移动端打包发布 |
| [docs/ci-cd-setup.md](./docs/ci-cd-setup.md) | CI/CD 配置 |
| [jushi_agent/deployment-guide.md](./jushi_agent/deployment-guide.md) | 手动部署步骤 |

## 常见问题

**Windows 端口占用**
```bash
netstat -ano | findstr :8080
taskkill /f /pid <PID>
```

**Pydantic v2 兼容**
`BaseSettings` 由 `pydantic-settings` 提供，确保已安装。

**移动端无法连接后端**
检查 `EXPO_PUBLIC_API_BASE_URL` 配置，真机调试使用 `npm run start:tunnel`。

## License

MIT
