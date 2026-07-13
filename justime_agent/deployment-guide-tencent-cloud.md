# Justime 腾讯云部署指南（CVM 版）

本文档是 `deployment-guide.md` 的腾讯云专用版本，适用于：
- 前端：`justime_agent`（Next.js 14）
- 后端：`justime_backend`（FastAPI）
- 数据库：MongoDB（自建或 Atlas）

目标容量：约 10 人并发在线使用。

## 1. 推荐配置（腾讯云）

| 档位 | 推荐 CVM 规格 | 系统盘 | 带宽 | 适用 |
|---|---|---:|---:|---|
| 最低可用 | 2核4G | 60GB SSD | 3Mbps+ | 开发/轻生产 |
| 推荐生产 | 4核8G | 80GB SSD | 5Mbps+ | 正式对外服务 |

建议系统：`Ubuntu 22.04 LTS`。

## 2. 腾讯云侧准备

## 2.1 购买 CVM

在腾讯云 CVM 控制台购买 Linux 实例，建议：
- 系统：Ubuntu 22.04
- 公网 IP：开启
- 安全组：仅放通必须端口

## 2.2 安全组规则

入站建议只放行：
- `TCP 22`（SSH）
- `TCP 80`（HTTP）
- `TCP 443`（HTTPS）

不要放通 `27017`（MongoDB）。

## 2.3 SSH 登录实例

```bash
ssh ubuntu@<CVM公网IP>
```

## 2.4 域名与备案说明

- 如果你部署在**中国大陆地域 CVM**并使用域名公网访问，需要先完成 ICP 备案后再正式开站。
- 如果暂时不做备案，可先使用中国香港/海外地域做公网访问，或仅 IP+端口内测。

## 3. 服务器初始化

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx python3 python3-venv python3-pip
```

安装 Node.js 20：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 4. 部署代码

```bash
sudo mkdir -p /opt/justime
sudo chown -R $USER:$USER /opt/justime
cd /opt/justime
git clone <你的仓库地址> .
```

## 5. 配置环境变量

## 5.1 前端：`/opt/justime/justime_agent/.env.local`

```env
NEXT_PUBLIC_BACKEND_URL=https://your-domain.com
NEXT_PUBLIC_APP_NAME=Justime 智能助手
NEXT_PUBLIC_APP_VERSION=1.0.0

MONGODB_URI=mongodb://127.0.0.1:27017/justime_agent
JWT_SECRET=请替换为强随机字符串
```

## 5.2 后端：`/opt/justime/justime_backend/.env`

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

后端依赖：

```bash
cd /opt/justime/justime_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
deactivate
```

前端构建：

```bash
cd /opt/justime/justime_agent
npm ci
npm run build
```

## 7. 配置 systemd 服务

## 7.1 后端服务 `/etc/systemd/system/justime-backend.service`

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

## 7.2 前端服务 `/etc/systemd/system/justime-agent.service`

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

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now justime-backend
sudo systemctl enable --now justime-agent
sudo systemctl status justime-backend --no-pager
sudo systemctl status justime-agent --no-pager
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

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/justime.conf /etc/nginx/sites-enabled/justime.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 9. DNSPod 解析与 HTTPS

## 9.1 DNSPod 添加 A 记录

把域名解析到 CVM 公网 IP：
- 主机记录 `@` -> `CVM公网IP`
- 主机记录 `www` -> `CVM公网IP`

## 9.2 申请 HTTPS 证书（Let’s Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 10. 验证与排障

健康检查：

```bash
curl -I https://your-domain.com
curl https://your-domain.com/api/v1/health/
```

日志查看：

```bash
sudo journalctl -u justime-backend -f
sudo journalctl -u justime-agent -f
sudo tail -f /var/log/nginx/error.log
```

常见问题：
- 访问超时：检查安全组是否已放通 `80/443`。
- SSH 失败：检查安全组 `22` 端口与实例登录方式（密码/密钥）。
- `502 Bad Gateway`：多半是 `justime-backend` 或 `justime-agent` 没启动成功。

## 11. 10人并发下的扩容建议

- 初始建议：`4核8G + workers=2`。
- 如果聊天高峰响应变慢：先升配 CVM，再把后端 worker 提升到 `3-4`。
- MongoDB 长期建议：
  - 自建请做定时备份；
  - 或迁移 MongoDB Atlas 降低运维成本。

## 12. 腾讯云官方文档参考

- CVM 产品页：`https://cloud.tencent.com/product/cvm`
- SSH 登录 Linux 实例：`https://cloud.tencent.com/document/product/213/35700`
- 配置安全组：`https://cloud.tencent.com/document/product/213/15377`
- 安全组概述：`https://cloud.tencent.com/document/product/215/20089`
- 添加安全组规则：`https://cloud.tencent.com/document/product/213/112614`
- DNSPod A 记录：`https://cloud.tencent.com/document/product/302/3449`
- ICP 首次备案：`https://cloud.tencent.com/document/product/243/37402`
- ICP 接入备案：`https://cloud.tencent.com/document/product/243/97669`
- 腾讯云 CVM 搭建 Docker（可选）：`https://cloud.tencent.com/document/product/213/46000`
