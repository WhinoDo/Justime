# 配置文件优化说明

## 📋 优化内容

### 1. package.json

**简化脚本命令**：
- 移除了冗余的端口配置脚本（`dev:localhost`, `dev:127`）
- 移除了不再使用的数据库相关脚本（Prisma命令已不再使用）
- 移除了 `setup-port` 脚本（相关功能已整合）
- 添加了 `test:api` 脚本，统一测试命令

**当前脚本**：
```json
{
  "dev": "next dev",
  "dev:3000": "next dev -p 3000",
  "dev:3001": "next dev -p 3001",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:api": "node test-api.js"
}
```

### 2. next.config.js

**简化配置**：
- 移除了冗余的 `env` 配置（Next.js会自动读取 `.env.local` 文件）
- 保留了图片域名配置

### 3. tsconfig.json

**简化路径别名**：
- 统一使用 `@/*` 路径别名，移除重复的详细路径配置
- 简化了路径映射，更易维护

**之前**：
```json
"paths": {
  "@/*": ["./src/*"],
  "@/components/*": ["./src/components/*"],
  "@/lib/*": ["./src/lib/*"],
  "@/types/*": ["./src/types/*"],
  "@/app/*": ["./src/app/*"]
}
```

**现在**：
```json
"paths": {
  "@/*": ["./src/*"]
}
```

### 4. jest.config.js

**简化模块映射**：
- 统一使用 `@/*` 路径别名
- 修复了 `moduleNameMapping` 拼写错误（应为 `moduleNameMapper`）

### 5. test-api.js

**优化和规范化**：
- 添加了文件头注释说明
- 改进了错误提示信息
- 统一了代码风格
- 更新了模型名称（使用 `deepseek-chat`）

### 6. 删除的文件

**不再需要的文件**：
- `test-login-flow.md` - 过时的测试文档
- `scripts/setup-port.js` - 功能已整合
- `start-feishu-login.bat/sh` - 旧架构启动脚本
- `stop-feishu-login.bat/sh` - 旧架构停止脚本

## ✅ 优化结果

### 配置文件更简洁
- 移除了冗余配置
- 统一了路径别名
- 简化了脚本命令

### 维护性提升
- 减少了配置文件数量
- 统一了代码风格
- 清晰的文件结构

### 功能保持完整
- 所有核心功能保持不变
- 开发体验不受影响
- 测试和构建流程正常

## 📝 使用说明

### 开发环境启动
```bash
npm run dev          # 默认端口 3000
npm run dev:3000     # 明确指定端口 3000
npm run dev:3001     # 明确指定端口 3001
```

### 测试
```bash
npm test             # 运行所有测试
npm run test:watch   # 监听模式
npm run test:coverage # 生成覆盖率报告
npm run test:api     # 测试API连接
```

### 构建和部署
```bash
npm run build        # 构建生产版本
npm start            # 启动生产服务器
npm run lint         # 代码检查
```

## 🔄 迁移指南

如果你之前使用了被删除的脚本，请按以下方式迁移：

### setup-port.js
不再需要，端口配置在启动命令中直接指定。

### 飞书登录脚本
项目已迁移到Next.js架构，不再需要独立的启动/停止脚本。直接使用：
```bash
npm run dev
```

访问飞书相关页面即可。

