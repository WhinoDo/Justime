#!/bin/bash
# MongoDB 认证用户初始化脚本
#
# 此脚本在容器首次启动时执行，创建:
#   1. root 用户 (管理员权限)
#   2. jushi_app 用户 (应用数据库读写权限)
#
# 安全说明:
#   - 生产环境必须通过环境变量设置强密码
#   - 不要在代码中硬编码密码
#   - 建议密码长度 >= 32 字符，包含大小写字母、数字、特殊字符

set -e

# 数据库名称
DB_NAME="${MONGODB_DB_NAME:-jushi-agent}"

# 检查密码是否已设置
if [ -z "${MONGO_ROOT_PASSWORD}" ]; then
    echo "错误: MONGO_ROOT_PASSWORD 未设置"
    exit 1
fi

if [ -z "${MONGO_APP_PASSWORD}" ]; then
    echo "错误: MONGO_APP_PASSWORD 未设置"
    exit 1
fi

echo "正在初始化 MongoDB 用户..."

# 创建 root 用户
mongosh admin --eval "
db.createUser({
    user: 'root',
    pwd: '${MONGO_ROOT_PASSWORD}',
    roles: [{ role: 'root', db: 'admin' }]
});
"

echo "已创建 root 用户"

# 创建应用用户
mongosh admin --eval "
db = db.getSiblingDB('${DB_NAME}');
db.createUser({
    user: 'jushi_app',
    pwd: '${MONGO_APP_PASSWORD}',
    roles: [{ role: 'readWrite', db: '${DB_NAME}' }]
});
"

echo "已创建 jushi_app 用户，数据库: ${DB_NAME}"
echo "MongoDB 认证初始化完成！"
