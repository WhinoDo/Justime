---
description: Ubuntu Server Deployment Guide for Justime Agent
---

This guide steps you through deploying the `justime` project (Next.js Frontend + Python/FastAPI Backend + MongoDB) to an Ubuntu 22.04/20.04 server.

## 1. Prerequisites (Server Preparation)

1.  **Server Specs**:
    *   OS: **Ubuntu 22.04 LTS** (Recommended) or 20.04.
    *   Min Specs: 2 vCPU, 4GB RAM.
2.  **Firewall / Security Group**:
    *   Allow Inbound: `22` (SSH), `80` (HTTP), `443` (HTTPS).

## 2. Environment Setup

SSH into your server (`ssh root@<IP>`) and run:

```bash
# 1. 更新系统软件包列表并升级已安装软件 (确保系统安全和依赖最新)
sudo apt update && sudo apt upgrade -y

# 安装基础工具: git(代码同步), unzip(解压), nginx(Web服务器), python环境, build-essential(编译依赖库所需gcc等)
sudo apt install -y git unzip nginx python3 python3-pip python3-venv build-essential

# 2. 安装 Node.js 20.x
# 下载并运行 NodeSource 的安装脚本，配置 Node.js 20 的源
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
# 正式安装 Node.js 和 npm
sudo apt install -y nodejs
# 全局安装 pm2 进程管理器，用于后台运行和守护 Node/Python 进程
sudo npm install -g pm2

# 3. 安装 MongoDB 7.0
# 导入 MongoDB 官方 GPG 公钥，确保下载的包是官方签名安全的
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
# 添加 MongoDB 的官方 apt 软件源地址到系统源列表
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
# 更新源列表以识别刚才添加的 MongoDB 源
sudo apt update
# 安装 MongoDB 数据库服务
sudo apt install -y mongodb-org
# 启用并立即启动 MongoDB 服务，使其开机自启
sudo systemctl enable --now mongod
```

## 3. Configure/Get Code

You have two options to get your code onto the server. **Option A (Git)** is recommended.

### Option A: Git Clone (Recommended)

```bash
# 创建 Web 应用的标准部署目录
mkdir -p /var/www
# 进入该目录
cd /var/www

# 从 GitHub 克隆项目代码 (如果是私有仓库可能需要输入账号密码或通过 SSH Key)
git clone https://github.com/zhuyx002/justime-agent.git justime
# 进入项目根目录
cd justime
```

### Option B: Upload Zip

If you packed your project using `scripts/release/pack_project.sh`:
1.  **Local**: `scp justime_deploy_package.zip root@<IP>:/tmp/`
2.  **Server**:
    ```bash
    mkdir -p /var/www/justime
    # 将上传到临时目录的 zip 包解压到部署目录
    unzip /tmp/justime_deploy_package.zip -d /var/www/justime
    cd /var/www/justime
    ```

## 4. Backend Deployment (Python)

**CRITICAL**: You must manually configure your secrets since `.env` is not in git.

```bash
# 进入后端代码目录
cd /var/www/justime/justime_backend

# 1. 配置密钥环境变量
# 复制示例配置文件为正式配置文件
cp .env.example .env
# 使用 nano 编辑器打开 .env 文件
nano .env
# [操作提示] 在此处填入您的 JWT_SECRET, MONGODB_URI, 和 LLM_API_KEY
# 编辑完成后：按 Ctrl+O 保存，按 Enter 确认，按 Ctrl+X 退出

# 2. 创建 Python 虚拟环境 (venv)，隔离项目依赖，不污染系统 Python 环境
python3 -m venv venv
# 激活虚拟环境 (激活后命令前的提示符会变，install 的包会装到 venv 里)
source venv/bin/activate

# 3. 安装项目运行所需的 Python 依赖包
pip install -r requirements.lock

# 4. 使用 PM2 启动后端服务
# 使用虚拟环境中的 python解释器运行 start.py，并命名进程为 "backend"
pm2 start "venv/bin/python start.py" --name backend
```

## 5. Frontend Deployment (Next.js)

```bash
# 进入前端代码目录
cd /var/www/justime/justime_agent

# 1. 安装 Node.js 依赖包
npm install

# 编译 Next.js 项目 (生成 .next 生产环境构建目录)
npm run build

# 2. 使用 PM2 启动前端服务
# 运行 npm start脚本，命名为 "frontend"
pm2 start npm --name "frontend" -- start

# 3. 保存当前 PM2 进程列表，并生成开机自启配置
pm2 save
pm2 startup
```

## 6. Nginx Configuration (Reverse Proxy)

Create config file:
```bash
# 创建一个新的 Nginx 站点配置文件
sudo nano /etc/nginx/sites-available/justime
```

Paste the following:
```nginx
server {
    listen 80;                            # 监听 80 端口 (HTTP)
    server_name _;                        # 匹配所有域名/IP (生产环境建议换成具体域名)

    # 前端 (Next.js) 反向代理规则
    location / {
        proxy_pass http://localhost:3000; # 转发请求到本地 3000 端口 (Next.js)
        proxy_http_version 1.1;           # 使用 HTTP 1.1 协议 (支持 WebSocket)
        proxy_set_header Upgrade $http_upgrade; # 支持 WebSocket 升级头
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;      # 传递原始 Host 头给后端
        proxy_cache_bypass $http_upgrade; # WebSocket 流量不缓存
    }

    # 后端 API (可选) - 如果前端代码在浏览器侧直接请求了后端接口
    location /api/ {
         proxy_pass http://localhost:3000/api/; # 这里依然指向 Next.js，因为项目使用了 Next.js API Routes 转发请求到后端
         proxy_set_header Host $host;
    }
    
    # 无需单独配置 FastAPI 的转发，因为 Next.js 服务器端代码会处理与 FastAPI (8080) 的通信
}
```

Activate site:
```bash
# 创建软链接到 sites-enabled 目录，启用该站点配置
sudo ln -s /etc/nginx/sites-available/justime /etc/nginx/sites-enabled/
# 删除 Nginx 默认的 "Welcome onto Nginx" 页面配置
sudo rm /etc/nginx/sites-enabled/default
# 检查 Nginx 配置文件语法是否正确
sudo nginx -t
# 重启 Nginx 服务使配置生效
sudo systemctl restart nginx
```

## 7. Verification

Visit `http://<YOUR_SERVER_IP>` in your browser. You should see the login page.
