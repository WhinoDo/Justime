#!/bin/bash

# 设置输出文件名
OUTPUT_FILE="jushi_deploy_package.zip"

echo "📦 开始打包项目文件..."

# 确保在项目根目录
cd "$(dirname "$0")/.."

# 删除旧的包
if [ -f "$OUTPUT_FILE" ]; then
    rm "$OUTPUT_FILE"
fi

# 打包文件，排除不需要的目录和文件
# -x 用于排除模式
zip -r "$OUTPUT_FILE" . \
    -x "*/node_modules/*" \
    -x "*/.next/*" \
    -x "*/venv/*" \
    -x "*/__pycache__/*" \
    -x "*/.git/*" \
    -x "*/.DS_Store" \
    -x "*/.vscode/*" \
    -x "*/.idea/*" \
    -x "*/coverage/*" \
    -x "*.zip" \
    -x "*/logs/*" \
    -x "*/tmp/*"

echo "✅ 打包完成！"
echo "📂生成文件: $OUTPUT_FILE"
echo "📏 文件大小: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "🚀 部署建议："
echo "1. 使用 scp 将此文件上传到服务器: scp $OUTPUT_FILE user@your-server-ip:/tmp/"
echo "2. 在服务器解压: unzip /tmp/$OUTPUT_FILE -d /var/www/jushi"
echo "3. 按照 .agent/workflows/deploy_to_alicloud.md 指南进行配置"
