#!/bin/bash
set -e

echo "=============================================================="
echo "      Justime All-in-One Container Initialization Tool       "
echo "=============================================================="

# 1. 安全性自检：检查当前工作空间并尝试拉取最新代码
if [ -d "/app/.git" ]; then
    echo "[*] 检测到挂载了 Git 仓库目录，正在准备执行代码拉取更新..."
    # 临时配置 git 安全目录
    git config --global --add safe.directory /app
    
    # 尝试 git pull
    if git pull; then
        echo "[✓] 【代码同步成功】成功获取到远程最新分支代码！"
    else
        echo "[!] 【警告】Git Pull 拉取代码失败。可能由于本地未追踪修改冲突或网络连通问题。将直接使用本地当前代码启动。"
    fi
else
    echo "[!] 未检测到工作目录挂载有 .git 仓库，将直接使用本地现有代码启动。"
fi

echo "--------------------------------------------------------------"

# 2. 后端依赖自动同步与校验
echo "[*] 正在准备同步后端 Python 环境依赖..."
cd /app/justime_backend

# 自动处理虚拟环境 (在容器内采用 .venv_docker 独立命名以隔绝与 Mac 宿主机 .venv 的混淆，防止 Shebang 二进制解析冲突)
if [ ! -d ".venv_docker" ]; then
    echo "[*] 未检测到 .venv_docker 虚拟环境，正在自动为您初始化建立..."
    python3 -m venv .venv_docker
fi

# 升级 pip 并安装最新 requirements 依赖
echo "[*] 正在安装/升级后端依赖库 (pip install)..."
.venv_docker/bin/pip install --upgrade pip -q
echo "[*] 正在极速预装 CPU-only 版 PyTorch (以隔绝并削减 >1.7GB 无用 CUDA 驱动，实现秒级依赖同步)..."
.venv_docker/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu --no-cache-dir -q
if .venv_docker/bin/pip install -r requirements.txt; then
    echo "[✓] 后端 Python 依赖库同步成功！"
else
    echo "[!] 【错误】后端依赖库安装失败。请检查依赖包网络及版本兼容情况。"
    exit 1
fi

echo "--------------------------------------------------------------"

# 3. 前端依赖自动同步与生产环境编译构建
echo "[*] 正在准备同步前端 Node.js 环境依赖..."
cd /app/justime_agent

# 确保前端有配置 .env.local 副本
if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
    echo "[*] 未检测到前端 .env.local，自动复制 .env.example 模板..."
    cp .env.example .env.local
fi

echo "[*] 正在执行前端依赖安装 (npm install)..."
if npm install --include=dev --no-audit --no-fund; then
    echo "[✓] 前端 Node 依赖库同步成功！"
else
    echo "[!] 【错误】前端依赖库安装失败。请检查 package.json 规范。"
    exit 1
fi

echo "[*] 正在为您重新编译并构建前端生产环境包 (npm run build)..."
if npm run build; then
    echo "[✓] 【构建成功】前端生产环境包编译成功！"
else
    echo "[!] 【错误】前端编译构建失败，可能存在编译期错误。将回退尝试使用开发环境或已存在构建启动。"
fi

echo "=============================================================="
echo "   [✓] 聚石 (Justime) 核心依赖自检通过！正在拉起后台进程管理器...   "
echo "=============================================================="

# 4. 一键拉起 supervisor，托管前后端双服务
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
