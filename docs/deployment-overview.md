# 聚时项目部署总览

本文档提供聚时项目各组件的部署指南索引和整体架构说明。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户终端                              │
├─────────────┬─────────────┬─────────────────────────────────┤
│  Web 浏览器  │  iOS App    │  Android App                    │
└──────┬──────┴──────┬──────┴──────────┬──────────────────────┘
       │             │                  │
       ▼             ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     Nginx / Caddy 网关                       │
│                    (反向代理 + HTTPS)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   Next.js 前端   │ │  FastAPI   │ │   静态资源      │
│  (jushi_agent)  │ │   后端      │ │   (可选 CDN)    │
└────────┬────────┘ └──────┬──────┘ └─────────────────┘
         │                 │
         └────────┬────────┘
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层                                  │
├─────────────────┬─────────────────┬─────────────────────────┤
│    MongoDB      │      Redis      │   文件存储 (OSS/本地)    │
│   (主数据库)    │   (缓存/会话)   │                          │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## 部署方式

### 1. Docker Compose（推荐）

适合单服务器部署，包含所有服务。

**文档**: [Homelab 部署](../deployment/homelab/)

**快速启动**:

```bash
cd deployment/homelab
cp .env.example .env
# 编辑 .env 配置环境变量
docker compose up -d
```

**包含服务**:
- Caddy 网关 (HTTPS 自动证书)
- Next.js 前端
- FastAPI 后端
- MongoDB 7.0
- Redis 7.0
- OpenClaw (可选)

### 2. 手动部署

适合对部署有特殊要求的场景。

**文档**: [部署指南](../jushi_agent/deployment-guide.md)

**组件**:
- Nginx 反向代理
- systemd 服务管理
- Let's Encrypt HTTPS

### 3. 云平台部署

#### 前端 (Vercel / Netlify)

```bash
cd jushi_agent
vercel --prod
```

#### 后端 (云服务器 / Kubernetes)

参考手动部署指南，或使用 Docker 镜像。

### 4. 移动端部署

**文档**: [移动端部署指南](./mobile-deployment-guide.md)

**方式**:
- EAS Build (云构建，推荐)
- 本地构建 (Xcode / Android Studio)

## 部署文档索引

| 组件 | 文档 | 说明 |
|------|------|------|
| 整体架构 | 本文档 | 系统架构和部署方式概览 |
| 手动部署 | [deployment-guide.md](../jushi_agent/deployment-guide.md) | 服务器手动部署步骤 |
| Docker 部署 | [deployment/homelab/](../deployment/homelab/) | Docker Compose 一键部署 |
| 移动端部署 | [mobile-deployment-guide.md](./mobile-deployment-guide.md) | iOS/Android 打包发布 |
| CI/CD | [ci-cd-setup.md](./ci-cd-setup.md) | GitHub Actions 配置 |

## 环境变量配置

### 前端 (jushi_agent/.env.local)

```env
NEXT_PUBLIC_BACKEND_URL=https://your-domain.com
NEXT_PUBLIC_APP_NAME=聚石智能助手
MONGODB_URI=mongodb://127.0.0.1:27017/jushi_agent
JWT_SECRET=your-jwt-secret
```

### 后端 (jushi_backend/.env)

```env
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
MONGODB_URI=mongodb://127.0.0.1:27017/jushi-agent
MONGODB_DB_NAME=jushi-agent
LLM_API_KEY=your-llm-api-key
ALLOWED_ORIGINS=["https://your-domain.com"]
```

### 移动端 (mobile/jushi_mobile/.env.local)

```env
EXPO_PUBLIC_API_BASE_URL=https://api.your-domain.com
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_DEBUG=false
```

## 安全检查清单

- [ ] 所有密钥使用强随机字符串 (`openssl rand -hex 32`)
- [ ] JWT_SECRET 和 JWT_REFRESH_SECRET 已配置
- [ ] 数据库不对外暴露端口
- [ ] HTTPS 已启用
- [ ] ALLOWED_ORIGINS 已正确配置
- [ ] 生产环境 DEBUG=false
- [ ] 敏感信息未提交到 Git

## 监控与运维

### 日志查看

```bash
# Docker 部署
docker compose logs -f backend
docker compose logs -f frontend

# systemd 部署
sudo journalctl -u jushi-backend -f
sudo journalctl -u jushi-agent -f
```

### 健康检查

```bash
# 后端健康检查
curl https://your-domain.com/api/v1/health/

# 前端检查
curl -I https://your-domain.com
```

### 数据备份

```bash
# MongoDB 备份
mongodump --uri="mongodb://localhost:27017/jushi-agent" --out=/backup/$(date +%Y%m%d)

# Docker 环境
docker compose exec mongodb mongodump --archive=/data/backup.archive
docker cp jushi-mongodb:/data/backup.archive ./backup.archive
```

## 常见问题

### 1. 服务无法启动

- 检查端口是否被占用
- 查看日志定位错误
- 确认环境变量已正确配置

### 2. 数据库连接失败

- 确认 MongoDB 服务已启动
- 检查 MONGODB_URI 配置
- 验证网络连通性

### 3. HTTPS 证书问题

- 确认域名 DNS 已正确解析
- 检查防火墙是否开放 80/443 端口
- 查看证书申请日志

### 4. 移动端无法连接

- 确认 EXPO_PUBLIC_API_BASE_URL 配置正确
- 检查后端 CORS 配置
- 验证 HTTPS 证书有效
