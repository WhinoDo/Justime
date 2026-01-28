#!/bin/bash
# 部署 MongoDB 和 Docker 配置到阿里云服务器
# 用法: ./deploy.sh [USER@IP]
# 示例: ./deploy.sh root@1.2.3.4
REMOTE_HOST=$1

if [ -z "$REMOTE_HOST" ]; then
    echo "❌ 请提供服务器地址，例如: ./deploy.sh root@123.45.67.89"
    exit 1
fi

echo "🚀 开始部署到 $REMOTE_HOST ..."

# 1. 修复远程 Docker daemon.json
# 使用目前验证最稳定的几个源
echo "🔧 配置 Docker 镜像源..."
ssh $REMOTE_HOST "cat > /etc/docker/daemon.json <<EOF
{
  \"registry-mirrors\": [
    \"https://docker.m.daocloud.io\",
    \"https://docker.1panel.live\",
    \"https://hub.rat.dev\"
  ]
}
EOF"

# 2. 重启 Docker
echo "🔄 重启 Docker 服务..."
ssh $REMOTE_HOST "systemctl daemon-reload && systemctl restart docker"
echo "⏳ 等待 Docker 启动..."
sleep 5

# 3. 检查 Docker 状态
echo "🔍 检查 Docker Info..."
ssh $REMOTE_HOST "docker info | grep 'Registry Mirrors' -A 3"

# 4. 创建目录
echo "qo 📂 创建部署目录..."
ssh $REMOTE_HOST "mkdir -p /root/jushi-mongodb"

# 5. 传输 docker-compose.yml
echo "Cc 📤 上传 docker-compose.yml..."
scp ./docker-compose.yml $REMOTE_HOST:/root/jushi-mongodb/docker-compose.yml

# 6. 生成 .env 并传输
echo "📝 设置 MongoDB 密码..."
read -p "请输入 MongoDB Root 用户名 (默认: admin): " MONGO_USER
MONGO_USER=${MONGO_USER:-admin}
read -s -p "请输入 MongoDB Root 密码: " MONGO_PASS
echo ""

# 创建本地临时 .env
cat > .env.temp <<EOF
MONGO_ROOT_USER=$MONGO_USER
MONGO_ROOT_PASSWORD=$MONGO_PASS
EOF

echo "📤 上传环境变量..."
scp .env.temp $REMOTE_HOST:/root/jushi-mongodb/.env
rm .env.temp

# 7. 启动服务
echo "🐳 启动 MongoDB..."
ssh $REMOTE_HOST "cd /root/jushi-mongodb"

# 尝试多种方式拉取镜像
echo "⬇️ 尝试拉取镜像..."
ssh $REMOTE_HOST "
if docker pull mongo:latest; then
    echo '✅ 官方源拉取成功'
elif docker pull m.daocloud.io/docker.io/library/mongo:latest; then
    echo '✅ DaoCloud 代理拉取成功'
    docker tag m.daocloud.io/docker.io/library/mongo:latest mongo:latest
elif docker pull docker.1panel.live/library/mongo:latest; then
    echo '✅ 1Panel 代理拉取成功'
    docker tag docker.1panel.live/library/mongo:latest mongo:latest
else
    echo '❌ 所有镜像源均尝试失败，请检查服务器网络或稍后再试。'
    exit 1
fi
"

if [ $? -eq 0 ]; then
    ssh $REMOTE_HOST "cd /root/jushi-mongodb && docker-compose up -d"
    echo "✅ 部署完成！"
    echo "可以通过 'ssh $REMOTE_HOST \"docker ps\"' 查看状态。"
else
    echo "❌ 部署中断：无法拉取 MongoDB 镜像。"
fi
