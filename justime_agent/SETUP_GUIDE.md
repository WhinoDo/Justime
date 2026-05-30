# 项目设置指南

## 环境配置

### 1. 创建环境变量文件

复制 `.env.example` 文件为 `.env.local`：

```bash
cp .env.example .env.local
```

### 2. 配置环境变量

编辑 `.env.local` 文件，设置以下变量：

```env
# 后端服务地址
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8080

# 应用配置
NEXT_PUBLIC_APP_NAME=矩时智能助手
NEXT_PUBLIC_APP_VERSION=1.0.0

# MongoDB 数据库配置
MONGODB_URI=mongodb://localhost:27017/justime_agent

# JWT 密钥（生产环境请使用强密钥）
JWT_SECRET=your-secret-key-here-change-in-production
```

## MongoDB 设置

### 选项 1: 本地 MongoDB

1. **安装 MongoDB**（如果尚未安装）：

   **macOS (使用 Homebrew):**
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   ```

   **启动 MongoDB:**
   ```bash
   brew services start mongodb-community
   ```

2. **验证 MongoDB 运行**：
   ```bash
   mongosh
   ```

### 选项 2: MongoDB Atlas（云数据库）

1. 访问 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 创建免费集群
3. 获取连接字符串
4. 更新 `.env.local` 中的 `MONGODB_URI`：
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/justime_agent?retryWrites=true&w=majority
   ```

## 安装依赖

```bash
npm install
```

## 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

## 功能验证

### 1. 访问主页
打开浏览器访问 http://localhost:3000

### 2. 测试日历功能
- 点击右上角的日历图标
- 或直接访问 http://localhost:3000/calendar

### 3. 测试聊天功能
- 访问 http://localhost:3000/chat
- 尝试发送消息

## 常见问题

### MongoDB 连接失败

**错误信息**: `MongooseServerSelectionError: connect ECONNREFUSED`

**解决方案**:
1. 确认 MongoDB 正在运行：
   ```bash
   brew services list | grep mongodb
   ```

2. 如果未运行，启动它：
   ```bash
   brew services start mongodb-community
   ```

3. 检查连接字符串是否正确

### 端口被占用

**错误信息**: `Port 3000 is already in use`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -ti:3000

# 终止进程
kill -9 $(lsof -ti:3000)
```

### 清除缓存

如果遇到奇怪的编译错误：

```bash
# 删除 .next 目录
rm -rf .next

# 删除 node_modules 并重新安装
rm -rf node_modules
npm install

# 重启开发服务器
npm run dev
```

## 项目结构

```
justime_agent/
├── src/
│   ├── app/                    # Next.js 应用路由
│   │   ├── api/               # API 路由
│   │   │   ├── auth/         # 认证相关 API
│   │   │   └── calendar/     # 日历相关 API
│   │   ├── calendar/         # 日历页面
│   │   └── chat/             # 聊天页面
│   ├── components/            # React 组件
│   │   ├── calendar/         # 日历组件
│   │   ├── chat/             # 聊天组件
│   │   └── ui/               # UI 组件
│   └── lib/                   # 工具库
│       ├── database/         # 数据库相关
│       └── ai/               # AI 相关功能
├── .env.local                 # 环境变量（需创建）
├── .env.example              # 环境变量示例
└── package.json              # 项目依赖
```

## 核心功能

### 1. React Big Calendar 集成
- ✅ 本地 MongoDB 存储
- ✅ 完整的 CRUD 操作
- ✅ 拖放和调整大小
- ✅ 中文本地化
- ✅ 深色模式支持

### 2. AI 任务管理
- ✅ AI 生成的任务可直接添加到日历
- ✅ 任务优先级管理
- ✅ 提醒功能

### 3. 用户认证
- ✅ JWT 认证
- ✅ 用户注册/登录
- ✅ 个人资料管理

## 下一步

1. **配置 MongoDB** - 确保数据库正常运行
2. **创建 .env.local** - 设置环境变量
3. **启动服务器** - `npm run dev`
4. **测试功能** - 访问日历和聊天页面

## 技术栈

- **框架**: Next.js 14
- **语言**: TypeScript
- **数据库**: MongoDB + Mongoose
- **UI**: React, TailwindCSS, shadcn/ui
- **日历**: React Big Calendar
- **认证**: JWT
- **AI**: OpenAI API

## 支持

如有问题，请查看：
- [Next.js 文档](https://nextjs.org/docs)
- [MongoDB 文档](https://docs.mongodb.com/)
- [React Big Calendar 文档](https://jquense.github.io/react-big-calendar/)
