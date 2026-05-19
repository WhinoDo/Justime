#!/bin/bash
# ==============================================================================
# Jushi 环境配置验证脚本
# ==============================================================================
#
# 此脚本用于验证 .env 文件中的敏感配置是否已正确配置
# 在部署前运行此脚本以确保安全性
#
# 使用方法:
#   ./scripts/validate-env.sh [path/to/.env]
#
# ==============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认 .env 文件路径
ENV_FILE="${1:-./.env}"

echo "========================================"
echo "Jushi 环境配置验证"
echo "========================================"
echo ""

# 检查文件是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 错误: 找不到 .env 文件: $ENV_FILE${NC}"
    echo ""
    echo "请先创建 .env 文件:"
    echo "  cp .env.example .env"
    echo "  vim .env  # 编辑并替换所有占位符"
    exit 1
fi

echo -e "检查文件: ${YELLOW}$ENV_FILE${NC}"
echo ""

ERRORS=0
WARNINGS=0

# 检查占位符函数
check_placeholder() {
    local name="$1"
    local placeholder="$2"

    if grep -q "$placeholder" "$ENV_FILE"; then
        echo -e "${RED}❌ $name 包含占位符: $placeholder${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ $name 已配置${NC}"
    fi
}

# 检查密钥长度
check_secret_length() {
    local name="$1"
    local key="$2"
    local min_length="$3"

    local value
    value=$(grep "^$key=" "$ENV_FILE" | cut -d'=' -f2-)

    if [ -n "$value" ] && [ ${#value} -lt $min_length ]; then
        echo -e "${YELLOW}⚠ $name 长度不足 (当前: ${#value}, 建议: ≥$min_length)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

echo "1. 检查占位符..."
echo ""
check_placeholder "NEXTAUTH_URL" "replace-with-your-tailnet-host"
check_placeholder "JWT_SECRET" "replace-with-a-long-random-string"
check_placeholder "JWT_REFRESH_SECRET" "replace-with-a-second-long-random-string"
check_placeholder "OPENCLAW_GATEWAY_TOKEN" "replace-with-a-random-openclaw-token"

echo ""
echo "2. 检查密钥强度..."
echo ""
check_secret_length "JWT_SECRET" "JWT_SECRET" 32
check_secret_length "JWT_REFRESH_SECRET" "JWT_REFRESH_SECRET" 32

echo ""
echo "3. 检查其他配置..."
echo ""

# 检查 DEBUG 模式
if grep -q "^DEBUG=true" "$ENV_FILE"; then
    echo -e "${YELLOW}⚠ DEBUG 模式已启用，不建议用于生产环境${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ DEBUG 模式已禁用${NC}"
fi

# 检查是否包含空密钥
if grep -qE "^(DEEPSEEK_API_KEY|DASHSCOPE_API_KEY|MINIMAX_API_KEY)=$" "$ENV_FILE" 2>/dev/null; then
    echo -e "${YELLOW}⚠ 部分 LLM API 密钥为空 (功能可能受限)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "========================================"
echo "验证结果"
echo "========================================"

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ 发现 $ERRORS 个错误，$WARNINGS 个警告${NC}"
    echo ""
    echo "请修复以上错误后再部署。"
    echo ""
    echo "生成随机密钥:"
    echo "  openssl rand -hex 32  # JWT_SECRET, JWT_REFRESH_SECRET"
    echo "  openssl rand -hex 16  # OPENCLAW_GATEWAY_TOKEN"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ 发现 $WARNINGS 个警告${NC}"
    echo ""
    echo "建议修复警告后再部署到生产环境。"
    exit 0
else
    echo -e "${GREEN}✅ 所有检查通过！${NC}"
    echo ""
    echo "可以安全部署。"
    exit 0
fi
