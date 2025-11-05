# 飞书集成后端服务

基于FastAPI的飞书集成后端服务，提供飞书OAuth认证、日历管理等功能。

## 项目结构

```
feishu-backend/
├── app/                    # 应用主目录
│   ├── __init__.py
│   ├── main.py            # 应用入口
│   ├── core/              # 核心模块
│   │   ├── __init__.py
│   │   ├── config.py      # 配置管理
│   │   └── exceptions.py  # 异常处理
│   ├── api/               # API模块
│   │   ├── __init__.py
│   │   └── v1/            # API v1版本
│   │       ├── __init__.py
│   │       ├── api.py     # 路由聚合
│   │       └── endpoints/ # API端点
│   │           ├── __init__.py
│   │           ├── health.py    # 健康检查
│   │           └── feishu.py    # 飞书集成API
│   └── services/         # 服务层
│       ├── __init__.py
│       ├── feishu_service.py  # 飞书服务
│       └── auth_service.py    # 认证服务
├── requirements.txt       # 依赖包
└── README.md             # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的飞书应用配置：

```env
FEISHU_CLIENT_ID=your_feishu_client_id
FEISHU_CLIENT_SECRET=your_feishu_client_secret
```

### 3. 启动服务

```bash
python -m app.main
```

或者使用uvicorn：

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

## API文档

启动服务后，访问以下地址查看API文档：

- Swagger UI: http://127.0.0.1:8080/docs
- ReDoc: http://127.0.0.1:8080/redoc

## 主要功能

### 1. 健康检查
- `GET /api/v1/health/` - 服务健康状态

### 2. 飞书集成
- `GET /api/v1/feishu/calendars` - 获取日历列表
- `GET /api/v1/feishu/calendar-events` - 获取日历事件
- `POST /api/v1/feishu/oauth/callback` - OAuth回调处理
- `GET /api/v1/feishu/tenant-token` - 获取应用令牌

## 开发说明

### 项目架构

- **app/core/**: 核心功能模块（配置、异常处理等）
- **app/api/**: API路由定义
- **app/services/**: 业务逻辑服务层
- **app/models/**: 数据模型（如需要）

### 添加新功能

1. 在 `app/services/` 中添加服务类
2. 在 `app/api/v1/endpoints/` 中添加API端点
3. 在 `app/api/v1/api.py` 中注册路由

### 配置管理

所有配置都在 `app/core/config.py` 中管理，支持环境变量覆盖。

## 部署

### 生产环境

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 4
```

### Docker部署

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```
