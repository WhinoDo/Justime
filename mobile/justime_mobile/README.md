# Justime Mobile

Justime 的移动端应用，基于 Expo (React Native) 构建，支持 iOS 和 Android 平台。

## 功能特性

- **聊天功能**: 与 AI 助手进行对话，支持多模型切换
- **日程管理**: 查看和管理日程安排
- **用户认证**: 登录/注册功能，支持 Token 自动刷新
- **历史会话**: 查看和管理聊天历史
- **模型配置**: 在设置中配置 AI 模型

## 技术栈

- **框架**: Expo SDK 54 + React Native 0.81
- **路由**: Expo Router (文件路由)
- **状态管理**: React Context + Hooks
- **UI 组件**: React Native + 自定义组件
- **存储**: AsyncStorage (本地持久化)
- **日历**: react-native-calendars

## 快速开始

### 1. 安装依赖

```bash
cd mobile/justime_mobile
npm install
```

### 2. 配置环境变量

复制环境变量模板并配置：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 文件，配置后端 API 地址：

```env
# 开发环境
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_DEBUG=true

# 生产环境
EXPO_PUBLIC_API_BASE_URL=https://api.justime.app
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_DEBUG=false
EXPO_PUBLIC_ALLOW_MANUAL_API_BASE_URL=false
```

### 3. 启动开发服务器

```bash
# 标准启动
npm start

# 使用隧道模式（推荐用于真机调试）
npm run start:tunnel

# 同时启动后端和 Expo
npm run start:all
```

### 4. 运行应用

在 Expo 开发服务器启动后，你可以：

- 按 `i` 在 iOS 模拟器中打开
- 按 `a` 在 Android 模拟器中打开
- 扫描二维码在 Expo Go 中打开（需要手机和电脑在同一网络）

## 项目结构

```
mobile/justime_mobile/
├── app/                    # 页面路由（Expo Router）
│   ├── (tabs)/            # Tab 导航页面
│   │   ├── index.tsx      # 聊天页面（主页）
│   │   ├── schedule.tsx   # 日程页面
│   │   └── profile.tsx    # 个人中心
│   ├── settings/          # 设置页面
│   │   └── model-config.tsx
│   └── _layout.tsx        # 根布局
├── components/            # UI 组件
│   ├── chat/              # 聊天相关组件
│   │   ├── AuthOverlay.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── ChatInputBox.tsx
│   │   ├── ChatMessageList.tsx
│   │   ├── HistorySessionModal.tsx
│   │   ├── ModelPickerModal.tsx
│   │   └── ThinkingBubble.tsx
│   ├── schedule/          # 日程相关组件
│   └── ui/                # 通用 UI 组件
├── constants/             # 常量配置
│   ├── app-config.ts      # 应用配置
│   └── theme.ts           # 主题配置
├── context/               # React Context
│   └── AuthContext.tsx    # 认证上下文
├── hooks/                 # 自定义 Hooks
├── types/                 # TypeScript 类型定义
└── assets/                # 静态资源
```

## 环境配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `EXPO_PUBLIC_API_BASE_URL` | 后端 API 地址 | `http://127.0.0.1:8080` |
| `EXPO_PUBLIC_ENV` | 环境模式 | `development` |
| `EXPO_PUBLIC_DEBUG` | 调试模式 | `true` |
| `EXPO_PUBLIC_ALLOW_MANUAL_API_BASE_URL` | 允许手动输入 API 地址 | `true` |
| `EXPO_PUBLIC_ANALYTICS_ENABLED` | 启用分析 | `false` |

### 环境模式

- **development**: 开发环境，启用调试日志，允许手动配置 API 地址
- **staging**: 预发布环境，连接预发布后端
- **production**: 生产环境，禁用调试，锁定 API 地址

## 打包发布

### Android APK

详细步骤见 [apk.md](./apk.md)

简要步骤：

```bash
# 1. 设置环境变量
export EXPO_PUBLIC_API_BASE_URL="https://api.justime.app"
export EXPO_PUBLIC_ENV="production"

# 2. 生成 Android 原生工程
npx expo prebuild -p android

# 3. 构建 APK
cd android
./gradlew assembleDebug

# 4. APK 位置
# android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS IPA

需要 Apple Developer 账号和 Xcode：

```bash
# 1. 生成 iOS 原生工程
npx expo prebuild -p ios

# 2. 使用 Xcode 打开项目
open ios/justime_mobile.xcworkspace

# 3. 在 Xcode 中配置签名并打包
```

### 使用 EAS Build (推荐)

EAS 是 Expo 提供的云构建服务：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 配置构建
eas build:configure

# 构建 Android
eas build --platform android

# 构建 iOS
eas build --platform ios
```

## 开发指南

### 代码规范

```bash
# 运行 ESLint
npm run lint
```

### 添加新页面

1. 在 `app/` 目录下创建新文件
2. Expo Router 会自动识别并创建路由

### 添加新组件

1. 在 `components/` 对应目录下创建组件
2. 使用 TypeScript 定义 props 类型
3. 遵循现有组件的命名和结构规范

### API 调用

使用 `AuthContext` 获取认证信息：

```tsx
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { token, baseUrl, user } = useAuth();
  
  const fetchData = async () => {
    const response = await fetch(`${baseUrl}/api/v1/...`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    // ...
  };
}
```

## 常见问题

### 1. 无法连接后端

- 检查 `EXPO_PUBLIC_API_BASE_URL` 配置
- 确保后端服务正在运行
- 真机调试时使用 `npm run start:tunnel`

### 2. Metro bundler 缓存问题

```bash
npx expo start --clear
```

### 3. Android 构建失败

- 确保 Java 版本为 17
- 检查 `app.json` 中的 Android 配置
- 查看 `android/gradle.properties` 配置

### 4. iOS 构建失败

- 确保 Xcode 版本 >= 15
- 检查 CocoaPods 依赖：`cd ios && pod install`

## 相关文档

- [APK 打包指南](./apk.md)
- [Expo 官方文档](https://docs.expo.dev/)
- [React Native 文档](https://reactnative.dev/)
