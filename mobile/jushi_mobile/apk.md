
  1. 进入项目

  cd /Users/zhuyuxuan/Desktop/Code/jushi/mobile/jushi_mobile

  2. 设置后端地址（根据你的环境配置）

  # 本地开发
  export EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:8080"
  
  # 或远程服务器
  # export EXPO_PUBLIC_API_BASE_URL="https://your-api-server.com"

  3. 生成 Android 原生工程

  npx expo prebuild -p android

  4. 打 APK

  cd android
  ./gradlew assembleDebug

  5. APK 位置

  /Users/zhuyuxuan/Desktop/Code/jushi/mobile/jushi_mobile/android/app/build/outputs/apk/debug/app-debug.apk

  6. 安装到手机（可选）

  adb install -r app/build/outputs/apk/debug/app-debug.apk