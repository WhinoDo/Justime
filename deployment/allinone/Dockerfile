# 1. 采用官方精简版 Python + Node.js 复合底座镜像 (3.10 + v20)
FROM nikolaik/python-nodejs:python3.10-nodejs20-slim

LABEL maintainer="Justime Developer team"
LABEL description="Justime All-in-One single container production image (App + DB + Redis)"

# 2. 安装基础系统依赖、Redis、Supervisor
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    redis-server \
    supervisor \
    git \
    curl \
    ca-certificates \
    build-essential \
    libcurl4 \
    libssl3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 3. 强力破局 GPG/SHA1/Debian 仓库限制：直接下载官方预编译的 MongoDB Community Server 二进制包
# 支持 x86_64 和 aarch64 (Apple Silicon) 双重架构，免去一切签名与时区校验之苦
RUN ARCH=$(uname -m) && \
    echo "Detected architecture: $ARCH" && \
    if [ "$ARCH" = "x86_64" ]; then \
        curl -fsSL https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz -o mongodb.tgz; \
    else \
        curl -fsSL https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2204-7.0.14.tgz -o mongodb.tgz; \
    fi && \
    tar -zxvf mongodb.tgz && \
    mv mongodb-linux-*/bin/mongod /usr/bin/mongod && \
    chmod +x /usr/bin/mongod && \
    rm -rf mongodb-linux-* mongodb.tgz

# 3. 创建数据库与 Redis 数据持久化所需的专属存储目录
RUN mkdir -p /data/db /data/redis /var/log/mongodb \
    && chmod -R 777 /data /var/log/mongodb

# 4. 设定系统全局的工作空间目录
WORKDIR /app

# 5. 导入并配置多进程监管配置文件
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 6. 导入并配置容器启动入口脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 7. 暴露前端、后端、数据库、缓存的全部端口 (方便宿主机联调及数据查看)
EXPOSE 3000
EXPOSE 8080
EXPOSE 27017
EXPOSE 6379

# 8. 设定容器默认启动入口
ENTRYPOINT ["/entrypoint.sh"]
