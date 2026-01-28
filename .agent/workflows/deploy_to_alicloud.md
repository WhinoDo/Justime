---
description: Deploy Jushi Project to Alibaba Cloud ECS (Ubuntu 22.04/20.04)
---

This guide steps you through deploying the `jushi` project (Next.js Frontend + Python/FastAPI Backend + MongoDB) to an Alibaba Cloud ECS instance.

## 1. Prerequisites (阿里云后台操作)

1.  **Purchase ECS**:
    *   OS: Ubuntu 22.04 LTS (recommended) or 20.04.
    *   Min Specs: 2 vCPU, 4GB RAM (Node build and LLM inference can be heavy).
2.  **Security Group (FastAPI & Next.js & SSH)**:
    *   Allow Inbound: `22` (SSH), `80` (HTTP), `443` (HTTPS).
    *   Optional (for testing): `3000`, `8080`.

## 2. Server Environment Setup (SSH into ECS)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# 1. Install MongoDB (or skip if using ApsaraDB for MongoDB)
# Import public key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
# Create list file
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
# Install
sudo apt update
sudo apt install -y mongodb-org
# Start
sudo systemctl start mongod
sudo systemctl enable mongod

# 2. Install Python 3.10+ and pip
sudo apt install -y python3 python3-pip python3-venv

# 3. Install Node.js 18+ (via nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install PM2 (Process Manager)
sudo npm install -g pm2

# 5. Install Nginx
sudo apt install -y nginx
```

## 3. Project Deployment

Assume code is uploaded/cloned to `/var/www/jushi`.
(You can use `git clone` or upload zip via `scp` or SFTP).

### Backend Deployment (`jushi_backend`)

```bash
cd /var/www/jushi/jushi_backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create Systemd Service
sudo nano /etc/systemd/system/jushi-backend.service
```

Add content to `jushi-backend.service`:
```ini
[Unit]
Description=Jushi Backend Application
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/jushi/jushi_backend
ExecStart=/var/www/jushi/jushi_backend/venv/bin/python start.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Start Backend:
```bash
sudo systemctl start jushi-backend
sudo systemctl enable jushi-backend
sudo systemctl status jushi-backend
# It should be running on localhost:8080
```

### Frontend Deployment (`jushi_agent`)

```bash
cd /var/www/jushi/jushi_agent

# Install dependencies
npm install

# Build the application
npm run build

# Start with PM2
pm2 start npm --name "jushi-frontend" -- start
pm2 save
pm2 startup
# It should be running on localhost:3000
```

## 4. Nginx Configuration (Reverse Proxy)

Configure Nginx to serve the site on port 80 and forward requests to Next.js and FastAPI.

```bash
sudo nano /etc/nginx/sites-available/jushi
```

Add content:
```nginx
server {
    listen 80;
    server_name your_domain_or_ip;  # Replace with ECS Public IP or Domain

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API (FastAPI) - Proxy /api/v1/ and others if needed
    # Assuming frontend calls backend via full URL or mapped paths.
    # Since frontend is server-side rendered, it can talk to localhost:8080 directly for SSR,
    # but browser-side calls usually need a public path.
    # Note: If your frontend is configured to call '/api/v1', ensure this matches.
    # Based on current code, frontend proxies requests via Next.js API routes or calls backend directly.
    # If explicit backend access is needed from browser:
    location /backend-api/ {
         rewrite ^/backend-api/(.*) /$1 break;
         proxy_pass http://localhost:8080;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/jushi /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Verification

1.  Visit `http://<ECS_PUBLIC_IP>` in your browser.
2.  You should see the Jushi Agent landing page.
3.  Try logging in or checking API status.

## 6. (Optional) Domain & SSL (HTTPS)

1.  Point your domain A record to the ECS Public IP.
2.  Install Certbot: `sudo apt install certbot python3-certbot-nginx`
3.  Run: `sudo certbot --nginx -d yourdomain.com`
