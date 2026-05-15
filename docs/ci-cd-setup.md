# CI/CD 配置指南

本文档介绍 Jushi 项目的持续集成/持续部署 (CI/CD) 配置。

## 概述

项目使用 GitHub Actions 实现 CI/CD，包含以下工作流：

| 工作流 | 文件 | 触发条件 | 用途 |
|--------|------|----------|------|
| CI | `.github/workflows/ci.yml` | push/PR 到 main/master | 代码质量检查和测试 |
| Deploy | `.github/workflows/deploy.yml` | push 到 main 或 tag | 构建和部署 |

## CI 工作流

### 流水线结构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CI Pipeline                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐                                                 │
│  │  code-quality  │ ─── Lint + TypeCheck (Frontend + Mobile)       │
│  └───────┬────────┘                                                 │
│          │                                                          │
│    ┌─────┴─────┬─────────────┬─────────────┐                        │
│    ▼           ▼             ▼             ▼                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐            │
│ │ frontend │ │  mobile  │ │  backend │ │ security-scan│            │
│ │  tests   │ │  tests   │ │  tests   │ │    (Trivy)   │            │
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘            │
│      │            │            │              │                     │
│      └────────────┴────────────┴──────────────┘                     │
│                         │                                            │
│                         ▼                                            │
│                ┌────────────────┐                                   │
│                │    ci-gate     │ ─── 汇总结果                       │
│                └────────────────┘                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Job 说明

#### 1. code-quality

代码质量门禁，执行 Lint 和 TypeScript 类型检查。

```yaml
- Frontend Lint (ESLint)
- Frontend Type Check (tsc --noEmit)
- Mobile Lint (Expo Lint)
- Mobile Type Check (tsc --noEmit)
```

#### 2. frontend-tests

前端单元测试和构建检查。

```yaml
- Jest 测试
- 代码覆盖率收集
- Next.js 构建
```

#### 3. mobile-tests

移动端测试。

```yaml
- TypeScript 类型检查
```

#### 4. backend-tests

后端测试，使用 MongoDB 服务容器。

```yaml
- pytest 测试
- MongoDB 7.0 服务容器
- 代码覆盖率收集
```

#### 5. security-scan

安全漏洞扫描。

```yaml
- Trivy 文件系统扫描
- 检测 CRITICAL/HIGH 级别漏洞
```

#### 6. ci-gate

CI 门禁，汇总所有 job 结果。

### 并发控制

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

同一分支的新提交会取消正在运行的旧工作流。

## Deploy 工作流

### 触发条件

```yaml
on:
  push:
    branches: [main, master]
    tags: ['v*']
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
```

### 部署流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Deploy Pipeline                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐                                               │
│  │  build-images    │ ─── 构建 Docker 镜像                           │
│  └────────┬─────────┘                                               │
│           │                                                          │
│     ┌─────┴─────┐                                                   │
│     ▼           ▼                                                    │
│ ┌───────────┐ ┌───────────┐                                         │
│ │  staging  │ │production │                                        │
│ │  (main)   │ │   (tag)   │                                        │
│ └───────────┘ └───────────┘                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 部署环境

| 环境 | 触发条件 | 说明 |
|------|----------|------|
| staging | push 到 main/master | 自动部署到测试环境 |
| production | tag v* | 发布到生产环境，创建 GitHub Release |

## 配置要求

### Secrets 配置

在 GitHub 仓库 Settings > Secrets and variables > Actions 中配置：

#### Docker Hub (镜像推送)

| Secret | 说明 |
|--------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |

#### Staging 部署

| Secret | 说明 |
|--------|------|
| `STAGING_HOST` | Staging 服务器地址 |
| `STAGING_USER` | SSH 用户名 |
| `STAGING_SSH_KEY` | SSH 私钥 |

#### Production 部署

| Secret | 说明 |
|--------|------|
| `PRODUCTION_HOST` | Production 服务器地址 |
| `PRODUCTION_USER` | SSH 用户名 |
| `PRODUCTION_SSH_KEY` | SSH 私钥 |

### 服务器要求

部署服务器需要：

1. Docker 和 Docker Compose 已安装
2. 代码已克隆到 `/opt/jushi`
3. `.env` 文件已配置
4. SSH 密钥认证已配置

## 本地测试

### 运行 CI 检查本地

```bash
# 前端 Lint
cd jushi_agent && npm run lint

# 前端类型检查
cd jushi_agent && npx tsc --noEmit

# 前端测试
cd jushi_agent && npm test -- --coverage

# 后端测试
cd jushi_backend && pytest tests/ -v --cov=app
```

### 使用 act 本地运行 GitHub Actions

```bash
# 安装 act
brew install act

# 运行 CI 工作流
act pull_request

# 运行特定 job
act -j frontend-tests
```

## 状态徽章

在 README.md 中添加 CI 状态徽章：

```markdown
[![CI](https://github.com/your-org/jushi/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/jushi/actions/workflows/ci.yml)
[![Deploy](https://github.com/your-org/jushi/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-org/jushi/actions/workflows/deploy.yml)
```

## 故障排除

### CI 失败常见原因

1. **Lint 错误**: 运行 `npm run lint` 检查
2. **类型错误**: 运行 `npx tsc --noEmit` 检查
3. **测试失败**: 查看测试输出日志
4. **MongoDB 连接失败**: 检查服务容器状态

### 部署失败常见原因

1. **SSH 连接失败**: 检查 Secrets 配置
2. **Docker 构建失败**: 检查 Dockerfile 和依赖
3. **服务启动失败**: 检查服务器日志

## 相关文档

- [部署指南](../DEPLOYMENT.md)
- [架构设计](./deployment-overview.md)
