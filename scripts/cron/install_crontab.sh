#!/bin/bash

# Jushi 项目定时任务安装脚本
# 使用方法: ./install_crontab.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
CRONTAB_FILE="$SCRIPT_DIR/crontab.example"
BACKUP_FILE="$SCRIPT_DIR/crontab.backup.$(date +%Y%m%d_%H%M%S)"

echo "🚀 Jushi 项目定时任务安装"
echo "============================"
echo ""

# 检查项目目录
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 项目目录不存在: $PROJECT_DIR"
    exit 1
fi

# 创建日志目录
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
echo "✅ 创建日志目录: $LOG_DIR"

# 创建报告目录
REPORT_DIR="$PROJECT_DIR/docs/optimization_reports"
mkdir -p "$REPORT_DIR"
echo "✅ 创建报告目录: $REPORT_DIR"

# 创建备份目录
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"
echo "✅ 创建备份目录: $BACKUP_DIR"

# 备份当前 crontab
echo ""
echo "📋 备份当前 crontab..."
crontab -l > "$BACKUP_FILE" 2>/dev/null || echo "# 无现有 crontab" > "$BACKUP_FILE"
echo "✅ 备份已保存: $BACKUP_FILE"

# 替换 crontab 文件中的变量
TEMP_CRONTAB=$(mktemp)
sed "s|/Users/zhuyuxuan/Desktop/Code/jushi|$PROJECT_DIR|g" "$CRONTAB_FILE" > "$TEMP_CRONTAB"

# 显示将要安装的任务
echo ""
echo "📋 将要安装的定时任务:"
echo "----------------------------"
cat "$TEMP_CRONTAB"
echo "----------------------------"

# 确认安装
echo ""
read -p "确认安装以上定时任务？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消安装"
    rm "$TEMP_CRONTAB"
    exit 0
fi

# 安装 crontab
crontab "$TEMP_CRONTAB"
rm "$TEMP_CRONTAB"

echo ""
echo "✅ 定时任务安装完成！"
echo ""
echo "📝 常用命令:"
echo "  - 查看定时任务: crontab -l"
echo "  - 编辑定时任务: crontab -e"
echo "  - 移除定时任务: crontab -r"
echo ""
echo "📁 日志位置: $LOG_DIR"
echo "📄 恢复备份: crontab $BACKUP_FILE"
echo ""

# 测试脚本
echo "🧪 测试定时任务脚本..."
echo ""

read -p "是否测试健康检查脚本？(y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "运行健康检查..."
    python3 "$SCRIPT_DIR/health_check.py"
fi

echo ""
read -p "是否测试清理脚本？(y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "运行清理脚本（干运行模式）..."
    python3 "$SCRIPT_DIR/cleanup_temp.py" --dry-run 2>/dev/null || python3 "$SCRIPT_DIR/cleanup_temp.py"
fi

echo ""
echo "🎉 安装完成！定时任务将在指定时间自动执行。"
