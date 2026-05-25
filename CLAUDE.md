# Jushi Agent (矩时) - Root CLAUDE.md

Welcome to **Jushi (矩时)**, an AI-powered personal assistant platform integrating chat, calendar, knowledge base, and book analysis. This repository is structured as a multi-module workspace.

> [!NOTE]
> This root file guides global coordination and directory routing. For module-specific commands and code style, please consult the respective child `CLAUDE.md` files:
> - **Web Frontend**: [`jushi_agent/CLAUDE.md`](file:///Users/zhuyuxuan/Desktop/Code/jushi/jushi_agent/CLAUDE.md)
> - **Python Backend**: [`jushi_backend/CLAUDE.md`](file:///Users/zhuyuxuan/Desktop/Code/jushi/jushi_backend/CLAUDE.md)
> - **Mobile Client**: [`mobile/jushi_mobile/CLAUDE.md`](file:///Users/zhuyuxuan/Desktop/Code/jushi/mobile/jushi_mobile/CLAUDE.md)

---

## 📂 Repository Structure

- `jushi_agent/`: Web Frontend (Next.js 14, React 18, Tailwind CSS, Radix UI)
- `jushi_backend/`: Backend API (FastAPI, Python 3.10+, Motor, Redis, MongoDB)
- `mobile/jushi_mobile/`: Mobile Client (Expo 54, React Native 0.81, Expo Router)
- `deployment/homelab/`: Multi-container homelab deployments (Docker Compose)
- `infrastructure/`: Database configuration and index templates

---

## 🛠️ Global Development Commands

Claude Code should target commands to their respective subdirectories. Do not execute commands in the root directory directly unless installing global utilities.

### 🌐 Web Frontend (`jushi_agent/`)
- **Install Dependencies**: `npm install` (run in `jushi_agent/`)
- **Development Server**: `npm run dev` (runs on port 3000)
- **Production Build**: `npm run build`
- **Linting**: `npm run lint`
- **Run Tests**: `npm test`

### 🐍 FastAPI Backend (`jushi_backend/`)
- **Setup Virtual Env**: `python -m venv .venv && source .venv/bin/activate` (run in `jushi_backend/`)
- **Install Dependencies**: `pip install -r requirements.txt` (run in `jushi_backend/`)
- **Development Server**: `python start.py` (runs on port 8080)
- **Run Tests**: `pytest tests/ -v --tb=short`

### 📱 Mobile Client (`mobile/jushi_mobile/`)
- **Install Dependencies**: `npm install` (run in `mobile/jushi_mobile/`)
- **Start Expo Server**: `npm start`
- **Start Expo Tunnel**: `npm run start:tunnel`
- **Linting**: `npm run lint`

---

## 🛡️ Global Code Quality & Security Standards

When modifying any part of the project, follow these general principles:

1. **Strict Confidentiality & Secrets Control**:
   - **NEVER** hardcode credentials, tokens, or API keys. Always fetch them via environment variables (`process.env` in TS/JS, `settings` or `os.getenv` in Python).
   - Ensure all `.env` and `.env.local` changes are kept local and never committed.
2. **Zero Placeholders**:
   - Always write complete, production-grade implementations. Do not use placeholders or write `// TODO` comments unless specifically instructed.
3. **Documentation Preservation**:
   - Preserve all existing comments, docstrings, and headers unless they are outdated or explicitly requested to be removed.
4. **Architectural Separation**:
   - Keep frontend business logic isolated from presentation components.
   - Do not call the backend FastAPI port (e.g. `8080`) directly from Web components; always route API requests through Next.js BFF proxy `/api/v1/*` to manage CORS and secure cookies properly.
