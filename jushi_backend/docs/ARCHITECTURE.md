# 项目架构说明

## 🏗️ 整体架构

```
feishu-backend/
├── app/                           # 应用主目录
│   ├── __init__.py
│   ├── main.py                   # 应用入口（仅负责应用创建和配置）
│   ├── core/                     # 核心模块
│   │   ├── __init__.py
│   │   ├── config.py             # 配置管理
│   │   └── exceptions.py         # 全局异常处理
│   ├── api/                      # API层
│   │   ├── __init__.py
│   │   └── v1/                   # API v1版本
│   │       ├── __init__.py
│   │       ├── api.py            # 路由聚合
│   │       └── endpoints/        # API端点（仅负责请求处理）
│   │           ├── __init__.py
│   │           ├── health.py     # 健康检查
│   │           └── feishu.py     # 飞书集成API
│   ├── business/                 # 业务逻辑层
│   │   ├── __init__.py
│   │   └── feishu_business.py    # 飞书业务逻辑
│   ├── services/                 # 服务层
│   │   ├── __init__.py
│   │   ├── feishu_service.py     # 飞书API服务
│   │   └── auth_service.py       # 认证服务
│   └── models/                   # 数据模型层
│       ├── __init__.py
│       └── feishu.py             # 飞书相关数据模型
├── requirements.txt              # 依赖包
├── start.py                     # 启动脚本
└── README.md                    # 项目说明
```

## 📋 分层职责

### 1. API层 (`app/api/`)
- **职责**: 处理HTTP请求和响应
- **特点**: 简洁，只负责参数验证和调用Business层
- **原则**: 不包含业务逻辑，只做请求转发

### 2. Business层 (`app/business/`)
- **职责**: 处理业务逻辑和流程控制
- **特点**: 协调多个Service，处理复杂的业务规则
- **原则**: 不直接调用外部API，通过Service层

### 3. Service层 (`app/services/`)
- **职责**: 封装外部API调用和基础服务
- **特点**: 可复用，专注于单一功能
- **原则**: 不包含业务逻辑，只做技术实现

### 4. Model层 (`app/models/`)
- **职责**: 定义数据结构和验证规则
- **特点**: 类型安全，自动验证
- **原则**: 纯数据结构，无业务逻辑

### 5. Core层 (`app/core/`)
- **职责**: 提供核心功能（配置、异常处理等）
- **特点**: 全局可用，基础设施
- **原则**: 通用功能，无业务相关性

## 🔄 数据流向

```
HTTP请求 → API层 → Business层 → Service层 → 外部API
                ↓
HTTP响应 ← API层 ← Business层 ← Service层 ← 外部API
```

## 🎯 设计原则

### 1. 单一职责原则
- 每个模块只负责一个功能
- API层只处理HTTP，Business层只处理业务逻辑

### 2. 依赖倒置原则
- 高层模块不依赖低层模块
- 都依赖于抽象（接口）

### 3. 开闭原则
- 对扩展开放，对修改关闭
- 新增功能时不需要修改现有代码

### 4. 接口隔离原则
- 客户端不应该依赖它不需要的接口
- 每个接口都应该有明确的职责

## 🚀 扩展指南

### 添加新的API端点
1. 在 `app/api/v1/endpoints/` 中创建新的端点文件
2. 在 `app/api/v1/api.py` 中注册路由
3. 在 `app/business/` 中添加对应的业务逻辑
4. 在 `app/services/` 中添加需要的服务

### 添加新的数据模型
1. 在 `app/models/` 中定义Pydantic模型
2. 在API端点中使用模型进行验证
3. 在Business层中使用模型进行数据处理

### 添加新的服务
1. 在 `app/services/` 中创建服务类
2. 在Business层中调用服务
3. 保持服务的单一职责

## 📝 最佳实践

### 1. 错误处理
- 在Service层捕获技术异常
- 在Business层处理业务异常
- 在API层统一响应格式

### 2. 日志记录
- 在关键节点添加日志
- 使用结构化日志格式
- 区分不同级别的日志

### 3. 配置管理
- 所有配置都在 `app/core/config.py` 中
- 支持环境变量覆盖
- 提供默认值和验证

### 4. 测试策略
- 单元测试：测试Service层
- 集成测试：测试Business层
- 端到端测试：测试API层
