#!/bin/bash
# MongoDB 认证用户初始化脚本
#
# 此脚本在容器首次启动时执行，创建:
#   1. root 用户 (管理员权限)
#   2. justime_app 用户 (应用数据库读写权限)
#
# 安全说明:
#   - 生产环境必须通过环境变量设置强密码
#   - 不要在代码中硬编码密码
#   - 建议密码长度 >= 32 字符，包含大小写字母、数字、特殊字符

set -e

DB_NAME="${MONGODB_DB_NAME:-justime-agent}"

if [ -z "${MONGO_ROOT_PASSWORD}" ]; then
    echo "错误: MONGO_ROOT_PASSWORD 未设置"
    exit 1
fi

if [ -z "${MONGO_APP_PASSWORD}" ]; then
    echo "错误: MONGO_APP_PASSWORD 未设置"
    exit 1
fi

validate_password() {
    local pw="$1"
    local label="$2"
    if [[ "$pw" =~ [\'\;\`] ]]; then
        echo "错误: ${label} 包含不安全字符 (单引号/分号/反引号)"
        exit 1
    fi
}

validate_password "$MONGO_ROOT_PASSWORD" "MONGO_ROOT_PASSWORD"
validate_password "$MONGO_APP_PASSWORD" "MONGO_APP_PASSWORD"

create_mongo_user() {
    local db="$1"
    local user="$2"
    local password="$3"
    local roles="$4"

    local tmpfile
    tmpfile=$(mktemp)
    cat > "$tmpfile" <<EOF
db.getSiblingDB("${db}").createUser({
    user: "${user}",
    pwd: $(printf '"%s"' "$password" | sed 's/\\/\\\\/g; s/"/\\"/g'),
    roles: ${roles}
});
EOF
    mongosh admin --file "$tmpfile"
    rm -f "$tmpfile"
}

echo "正在初始化 MongoDB 用户..."

# create_mongo_user "admin" "root" "$MONGO_ROOT_PASSWORD" '[{ role: "root", db: "admin" }]'
# echo "已创建 root 用户"

create_mongo_user "$DB_NAME" "justime_app" "$MONGO_APP_PASSWORD" '[{ role: "readWrite", db: "'"$DB_NAME"'" }]'
echo "已创建 justime_app 用户，数据库: ${DB_NAME}"

echo "MongoDB 认证初始化完成！"
