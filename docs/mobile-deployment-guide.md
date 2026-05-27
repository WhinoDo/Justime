# 聚时移动端部署指南

本文档说明聚时移动端应用（iOS/Android）的打包和发布流程。

## 前置要求

### 通用要求

- Node.js 20+
- npm 或 yarn
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) - 用于云构建

### Android 要求

- Java JDK 17
- Android SDK (通过 Android Studio 安装)
- Android Studio (可选，用于调试)

### iOS 要求

- macOS 系统
- Xcode 15+
- Apple Developer 账号 ($99/年)
- CocoaPods (`sudo gem install cocoapods`)

## 环境配置

### 1. 配置生产环境变量

创建 `.env.production` 文件：

```env
EXPO_PUBLIC_API_BASE_URL=https://api.justime.app
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_DEBUG=false
EXPO_PUBLIC_ALLOW_MANUAL_API_BASE_URL=false
EXPO_PUBLIC_ANALYTICS_ENABLED=true
```

### 2. 更新 app.json 配置

确保 `app.json` 中的版本号和包名正确：

```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "package": "com.justime.mobile",
      "versionCode": 1
    },
    "ios": {
      "bundleIdentifier": "com.justime.mobile",
      "buildNumber": "1.0.0"
    }
  }
}
```

## 构建方式

### 方式一：EAS Build（推荐）

EAS 是 Expo 官方提供的云构建服务，无需本地配置复杂的构建环境。

#### 1. 配置 EAS

创建 `eas.json`：

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "distribution": "store"
    }
  },
  "submit": {
    "production": {}
  }
}
```

#### 2. 登录 EAS

```bash
eas login
```

#### 3. 构建 Android APK（预览版）

```bash
eas build --platform android --profile preview
```

构建完成后可从 EAS Dashboard 下载 APK。

#### 4. 构建 Android AAB（生产版，用于上架）

```bash
eas build --platform android --profile production
```

#### 5. 构建 iOS

```bash
eas build --platform ios --profile production
```

#### 6. 提交到应用商店

```bash
# Android - 提交到 Google Play
eas submit --platform android --latest

# iOS - 提交到 App Store
eas submit --platform ios --latest
```

### 方式二：本地构建

#### Android 本地构建

```bash
cd mobile/justime_mobile

# 1. 设置生产环境
export EXPO_PUBLIC_ENV=production
export EXPO_PUBLIC_API_BASE_URL=https://api.justime.app

# 2. 生成原生工程
npx expo prebuild --platform android

# 3. 构建 Debug APK
cd android
./gradlew assembleDebug
# APK 位置: android/app/build/outputs/apk/debug/app-debug.apk

# 4. 构建 Release APK（需要签名配置）
./gradlew assembleRelease
# APK 位置: android/app/build/outputs/apk/release/app-release.apk
```

#### Android 签名配置

在 `android/gradle.properties` 中添加：

```properties
MYAPP_UPLOAD_STORE_FILE=justime-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=justime
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

生成签名密钥：

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore justime-release.keystore \
  -alias justime \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Justime, OU=Mobile, O=Justime Team, L=Beijing, ST=Beijing, C=CN"
```

#### iOS 本地构建

```bash
cd mobile/justime_mobile

# 1. 设置生产环境
export EXPO_PUBLIC_ENV=production

# 2. 生成原生工程
npx expo prebuild --platform ios

# 3. 安装 CocoaPods 依赖
cd ios
pod install

# 4. 使用 Xcode 打开工程
open justime_mobile.xcworkspace
```

在 Xcode 中：

1. 选择正确的 Team（Apple Developer 账号）
2. 配置 Bundle Identifier
3. 选择目标设备或 "Any iOS Device"
4. Product > Archive
5. 分发 Archive 到 App Store Connect

## 版本更新流程

### 1. 更新版本号

更新 `app.json`：

```json
{
  "expo": {
    "version": "1.1.0",
    "android": {
      "versionCode": 2  // 每次更新 +1
    },
    "ios": {
      "buildNumber": "1.1.0"
    }
  }
}
```

### 2. 更新 CHANGELOG

记录本次更新的内容。

### 3. 构建并发布

```bash
# 使用 EAS
eas build --platform all --profile production
eas submit --platform all --latest
```

## 持续集成

项目已配置 GitHub Actions，每次 PR 和 main 分支推送都会运行：

- ESLint 检查
- TypeScript 类型检查

详见 [CI/CD 配置文档](../../docs/ci-cd-setup.md)。

## 常见问题

### 1. EAS 构建失败

- 检查 `eas.json` 配置
- 查看 EAS Dashboard 的构建日志
- 确保环境变量正确配置

### 2. Android 签名问题

- 确保 keystore 文件路径正确
- 检查密码配置
- 使用 `jarsigner` 验证签名

### 3. iOS 证书问题

- 在 Xcode 中刷新证书：Preferences > Accounts > Download Manual Profiles
- 确保 Bundle ID 与 Apple Developer Portal 中一致
- 检查 Provisioning Profile 是否过期

### 4. 构建体积过大

优化建议：

- 使用 `expo-updates` 进行 OTA 更新
- 压缩图片资源
- 启用 ProGuard（Android）或 Bitcode（iOS）

## 相关资源

- [Expo 官方文档](https://docs.expo.dev/)
- [EAS Build 文档](https://docs.expo.dev/build/introduction/)
- [Android 发布指南](https://developer.android.com/studio/publish)
- [iOS 发布指南](https://developer.apple.com/documentation/xcode/preparing_your_app_for_distribution)
