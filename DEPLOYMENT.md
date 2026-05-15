# Jushi 部署指南

本文档提供 Jushi 项目的完整部署指南，涵盖 Docker Compose、手动部署和移动端发布。

## 目录

- [系统架构](#系统架构)
- [部署方式概览](#部署方式概览)
- [Docker Compose 部署](#docker-compose-部署)
- [手动部署](#手动部署)
- [移动端部署](#移动端部署)
- [环境变量配置](#环境变量配置)
- [安全检查清单](#安全检查清单)
- [监控与运维](#监控与运维)
- [常见问题](#常见问题)

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
│                     Caddy / Nginx 网关                       │
│                    (反向代理 + HTTPS)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   Next.js 前端   │ │  FastAPI   │ │   OpenClaw      │
│  (jushi_agent)  │ │   后端      │ │   (可选)         │
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

## 部署方式概览

| 方式 | 适用场景 | 复杂度 | 推荐度 |
|------|----------|--------|--------|
| Docker Compose | 单服务器、Homelab | 低 | ★★★★★ |
| 手动部署 | 自定义需求、云服务器 | 中 | ★★★☆☆ |
| 云平台 | 前端 Vercel/后端 K8s | 中 | ★★★★☆ |
| EAS Build | 移动端打包发布 | 低 | ★★★★★ |

## Docker Compose 部署

### 服务器要求

| 配置 | CPU | 内存 | 磁盘 | 说明 |
|------|----:|-----:|-----:|------|
| 最低 | 2 vCPU | 4 GB | 60 GB | 可运行，余量小 |
| 推荐 | 4 vCPU | 8 GB | 100 GB | 生产推荐 |

系统: Ubuntu 22.04 LTS 或 macOS

### 快速启动

```bash
# 1. 克隆代码
git clone <repo-url> /opt/jushi
cd /opt/jushi

# 2. 配置环境变量
cd deployment/homelab
cp .env.example .env

# 3. 编辑配置
vim .env
# 必须修改:
# - JUSHI_REPO_ROOT=/opt/jushi
# - JWT_SECRET (openssl rand -hex 32)
# - JWT_REFRESH_SECRET (openssl rand -hex 32)
# - ENCRYPTION_SECRET (openssl rand -hex 32)
# - OPENCLAW_GATEWAY_TOKEN (openssl rand -hex 16)

# 4. 启动服务
docker compose up -d

# 5. 检查状态
docker compose ps
docker compose logs -f
```

### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| gateway | 8088 | Caddy 网关 (入口) |
| frontend | 3000 | Next.js 前端 |
| backend | 8080 | FastAPI 后端 |
| mongodb | 27017 | MongoDB 数据库 |
| redis | 6379 | Redis 缓存 |
| openclaw | 18789 | OpenClaw 网关 (可选) |

### 访问地址

- 前端: `http://localhost:8088`
- 后端 API: `http://localhost:8088/backend/api/v1/`
- API 文档: `http://localhost:8088/backend/docs`
- OpenClaw: `http://localhost:8088/openclaw/`

### 常用命令

```bash
# 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 重启服务
docker compose restart backend

# 更新部署
git pull
docker compose build --no-cache
docker compose up -d

# 停止服务
docker compose down

# 数据备份
docker compose exec mongodb mongodump --archive=/data/backup.archive
docker cp jushi-mongodb:/data/backup.archive ./backup-$(date +%Y%m%d).archive
```

## 手动部署

详见 [jushi_agent/deployment-guide.md](./jushi_agent/deployment-guide.md)

### 核心步骤

1. **服务器初始化**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y git curl nginx python3-venv nodejs
   ```

2. **安装依赖**
   ```bash
   # 前端
   cd jushi_agent && npm ci && npm run build
   
   # 后端
   cd jushi_backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **配置环境变量**
   - 前端: `jushi_agent/.env.local`
   - 后端: `jushi_backend/.env`

4. **创建 systemd 服务**
   - `/etc/systemd/system/jushi-backend.service`
   - `/etc/systemd/system/jushi-agent.service`

5. **配置 Nginx 反向代理**

6. **配置 HTTPS (Let's Encrypt)**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## 移动端部署

详见 [docs/mobile-deployment-guide.md](./docs/mobile-deployment-guide.md)

### EAS Build (推荐)

```bash
cd mobile/jushi_mobile

# 配置环境
export EXPO_PUBLIC_API_BASE_URL=https://api.your-domain.com

# 登录 EAS
eas login

# 构建 Android APK
eas build --platform android --profile preview

# 构建生产版本并提交
eas build --platform all --profile production
eas submit --platform all --latest
```

### 本地构建

```bash
# Android
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease

# iOS
npx expo prebuild --platform ios
cd ios && pod install
open *.xcworkspace  # 使用 Xcode 打包
```

## 环境变量配置

### 前端 (jushi_agent/.env.local)

```env
# 应用配置
NEXT_PUBLIC_APP_NAME=聚石智能助手
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_BACKEND_URL=/backend

# 数据库
MONGODB_URI=mongodb://mongodb:27017/jushi-agent

# 安全
JWT_SECRET=<32字符以上随机字符串>

# 认证 (生产环境)
NEXTAUTH_URL=https://your-domain.com
```

### 后端 (jushi_backend/.env)

```env
# 服务配置
HOST=0.0.0.0
PORT=8080
DEBUG=false

# 数据库
MONGODB_URI=mongodb://mongodb:27017/jushi-agent
MONGODB_DB_NAME=jushi-agent
REDIS_URL=redis://redis:6379/0

# 安全 (必须配置)
JWT_SECRET=<32字符以上随机字符串>
JWT_REFRESH_SECRET=<32字符以上随机字符串>
ENCRYPTION_SECRET=<32字符以上随机字符串>

# LLM 配置
DEEPSEEK_API_KEY=your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DASHSCOPE_API_KEY=your-dashscope-key

# 阿里云 OSS (可选)
ALIYUN_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
ALIYUN_OSS_BUCKET=your-bucket
ALIYUN_OSS_ACCESS_KEY_ID=your-access-key
ALIYUN_OSS_ACCESS_KEY_SECRET=your-secret

# OpenClaw (可选)
OPENCLAW_ENABLED=true
OPENCLAW_GATEWAY_TOKEN=<随机字符串>
MINIMAX_API_KEY=your-minimax-key
```

### 移动端 (mobile/jushi_mobile/.env.local)

```env
EXPO_PUBLIC_API_BASE_URL=https://api.your-domain.com
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_DEBUG=false
```

## 安全检查清单

部署前必须确认:

- [ ] 所有密钥使用强随机字符串 (`openssl rand -hex 32`)
- [ ] `JWT_SECRET`、`JWT_REFRESH_SECRET`、`ENCRYPTION_SECRET` 已配置
- [ ] 密钥长度 ≥ 32 字符
- [ ] 数据库端口不对外暴露
- [ ] HTTPS 已启用
- [ ] `ALLOWED_ORIGINS` 已正确配置 (禁止使用 `*`)
- [ ] 生产环境 `DEBUG=false`
- [ ] 敏感信息未提交到 Git
- [ ] `.env` 文件已加入 `.gitignore`

## 监控与运维

### 健康检查

```bash
# 后端健康检查
curl http://localhost:8088/backend/api/v1/health/

# 前端检查
curl -I http://localhost:8088

# 数据库连接
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"
docker compose exec redis redis-cli ping
```

### 日志查看

```bash
# Docker 部署
docker compose logs -f --tail=100 backend
docker compose logs -f --tail=100 frontend

# systemd 部署
sudo journalctl -u jushi-backend -f
sudo journalctl -u jushi-agent -f
```

### 性能监控

```bash
# 容器资源使用
docker stats

# MongoDB 状态
docker compose exec mongodb mongosh --eval "db.serverStatus()"

# Redis 状态
docker compose exec redis redis-cli info
```

### 数据备份

```bash
# MongoDB 备份
docker compose exec mongodb mongodump \
  --uri="mongodb://localhost:27017/jushi-agent" \
  --archive=/data/backup.archive
docker cp jushi-mongodb:/data/backup.archive ./backup.archive

# MongoDB 恢复
docker cp ./backup.archive jushi-mongodb:/data/backup.archive
docker compose exec mongodb mongorestore --archive=/data/backup.archive
```

## 常见问题

### 服务无法启动

1. 检查端口占用: `netstat -tlnp | grep -E '3000|8080|27017|6379'`
2. 查看日志: `docker compose logs backend`
3. 确认环境变量: `docker compose config`

### 数据库连接失败

1. 确认 MongoDB/Redis 服务已启动
2. 检查 `MONGODB_URI` / `REDIS_URL` 配置
3. 验证网络连通性: `docker compose exec backend ping mongodb`

### HTTPS 证书问题

1. 确认域名 DNS 已正确解析
2. 检查防火墙开放 80/443 端口
3. 查看证书日志: `docker compose logs gateway`

### 移动端无法连接

1. 确认 `EXPO_PUBLIC_API_BASE_URL` 配置正确
2. 检查后端 CORS 配置 (`ALLOWED_ORIGINS`)
3. 验证 HTTPS 证书有效
4. 真机调试使用隧道模式: `npm run start:tunnel`

### OpenClaw 连接失败

1. 确认 `OPENCLAW_ENABLED=true`
2. 检查 `OPENCLAW_GATEWAY_TOKEN` 配置一致
3. 查看日志: `docker compose logs openclaw`

## 相关文档

- [部署架构说明](./docs/deployment-overview.md)
- [手动部署指南](./jushi_agent/deployment-guide.md)
- [移动端部署指南](./docs/mobile-deployment-guide.md)
- [CI/CD 配置](./docs/ci-cd-setup.md)
