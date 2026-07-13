# Justime 部署指南（10人并发）

本文档适用于当前仓库结构：
- 前端：`justime_agent`（Next.js 14）
- 后端：`justime_backend`（FastAPI）
- 数据库：MongoDB

## 1. 服务器配置建议

目标：约 10 人同时在线（聊天 + 日程 + 基础管理功能）。

| 档位 | CPU | 内存 | 磁盘 | 说明 |
|---|---:|---:|---:|---|
| 最低可用 | 2 vCPU | 4 GB | 60 GB SSD | 可运行，余量较小 |
| 推荐生产 | 4 vCPU | 8 GB | 80-100 GB SSD | 更稳，建议使用 |

建议系统：`Ubuntu 22.04 LTS`。

## 2. 生产拓扑

- `Nginx`：统一入口（80/443）
- `Next.js`：`127.0.0.1:3000`
- `FastAPI`：`127.0.0.1:8080`
- `MongoDB`：`127.0.0.1:27017`（或 MongoDB Atlas）

建议对外只暴露 `80/443`，不要暴露 `27017`。

## 3. 服务器初始化

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx python3 python3-venv python3-pip
```

安装 Node.js 20（示例）：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

如果你自建 MongoDB，请按官方文档安装并启动；也可以直接使用 MongoDB Atlas（更省运维）。

## 4. 拉取代码与目录约定

```bash
sudo mkdir -p /opt/justime
sudo chown -R $USER:$USER /opt/justime
cd /opt/justime
git clone <你的仓库地址> .
```

本文档后续命令默认在 `/opt/justime` 下执行。

## 5. 配置环境变量

### 5.1 前端变量（`justime_agent/.env.local`）

```env
NEXT_PUBLIC_BACKEND_URL=https://your-domain.com
NEXT_PUBLIC_APP_NAME=Justime 智能助手
NEXT_PUBLIC_APP_VERSION=1.0.0

MONGODB_URI=mongodb://127.0.0.1:27017/justime_agent
JWT_SECRET=请替换为强随机字符串
```

说明：
- `NEXT_PUBLIC_BACKEND_URL` 不带 `/api/v1`，代码会自动拼接。
- 你的前端部分 API 路由会直接连 MongoDB，因此这里也需要 `MONGODB_URI`。

### 5.2 后端变量（`justime_backend/.env`）

```env
JWT_SECRET=请替换为强随机字符串
JWT_REFRESH_SECRET=请替换为强随机字符串

MONGODB_URI=mongodb://127.0.0.1:27017/justime-agent
MONGODB_DB_NAME=justime-agent

HOST=127.0.0.1
PORT=8080
DEBUG=False

LLM_DEFAULT_PROVIDER=openai
LLM_API_KEY=你的真实Key
LLM_MODEL_ID=gpt-4o-mini
LLM_BASE_URL=https://api.openai.com/v1

ALLOWED_ORIGINS=["https://your-domain.com"]
```

生成随机密钥：

```bash
openssl rand -hex 32
```

## 6. 安装依赖与构建

```bash
cd /opt/justime/justime_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
deactivate
```

```bash
cd /opt/justime/justime_agent
npm ci
npm run build
```

## 7. systemd 常驻进程

### 7.1 后端服务 `/etc/systemd/system/justime-backend.service`

```ini
[Unit]
Description=Justime FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/justime/justime_backend
EnvironmentFile=/opt/justime/justime_backend/.env
ExecStart=/opt/justime/justime_backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8080 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 7.2 前端服务 `/etc/systemd/system/justime-agent.service`

```ini
[Unit]
Description=Justime Next.js Frontend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/justime/justime_agent
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

应用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now justime-backend
sudo systemctl enable --now justime-agent
sudo systemctl status justime-backend
sudo systemctl status justime-agent
```

## 8. Nginx 反向代理

创建 `/etc/nginx/sites-available/justime.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 20m;

    location /api/v1/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/justime.conf /etc/nginx/sites-enabled/justime.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 9. HTTPS（Let’s Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 10. 上线验证

```bash
curl -I https://your-domain.com
curl https://your-domain.com/api/v1/health/
```

日志排查：

```bash
sudo journalctl -u justime-backend -f
sudo journalctl -u justime-agent -f
sudo tail -f /var/log/nginx/error.log
```

## 11. 并发与扩容建议

- 10 人并发下，`uvicorn --workers 2` 通常够用。
- 如果响应高峰明显，先升级到 `4 vCPU / 8GB`，再考虑把后端 worker 提到 `3-4`。
- MongoDB 建议开启备份；若运维压力大，优先迁移到 MongoDB Atlas。
