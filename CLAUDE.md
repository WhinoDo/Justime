# Justime Agent (矩时) - Root CLAUDE.md

Welcome to **Justime (矩时)**, an AI-powered personal assistant platform integrating chat, calendar, knowledge base, and book analysis. This repository is structured as a multi-module workspace.

> [!NOTE]
> This root file guides global coordination and directory routing. For module-specific commands and code style, please consult the respective child `CLAUDE.md` files:
> - **Web Frontend**: [`justime_agent/CLAUDE.md`](file:///Users/zhuyuxuan/Desktop/Code/justime/justime_agent/CLAUDE.md)
> - **Python Backend**: [`justime_backend/CLAUDE.md`](file:///Users/zhuyuxuan/Desktop/Code/justime/justime_backend/CLAUDE.md)
> - **Mobile Client**: [`mobile/justime_mobile/CLAUDE.md`](file:///Users/zhuyuxuan/Desktop/Code/justime/mobile/justime_mobile/CLAUDE.md)

---

## 📂 Repository Structure

- `justime_agent/`: Web Frontend (Next.js 14, React 18, Tailwind CSS, Radix UI)
- `justime_backend/`: Backend API (FastAPI, Python 3.10+, Motor, Redis, MongoDB)
- `mobile/justime_mobile/`: Mobile Client (Expo 54, React Native 0.81, Expo Router)
- `deployment/homelab/`: Multi-container homelab deployments (Docker Compose)
- `infrastructure/`: Database configuration and index templates

---

## 🛠️ Global Development Commands

Claude Code should target commands to their respective subdirectories. Do not execute commands in the root directory directly unless installing global utilities.

### 🌐 Web Frontend (`justime_agent/`)
- **Install Dependencies**: `npm install` (run in `justime_agent/`)
- **Development Server**: `npm run dev` (runs on port 3000)
- **Production Build**: `npm run build`
- **Linting**: `npm run lint`
- **Run Tests**: `npm test`

### 🐍 FastAPI Backend (`justime_backend/`)
- **Setup Virtual Env**: `python -m venv .venv && source .venv/bin/activate` (run in `justime_backend/`)
- **Install Dependencies**: `pip install -r requirements.lock` (run in `justime_backend/`)
- **Development Server**: `python start.py` (runs on port 8080)
- **Run Tests**: `pytest tests/ -v --tb=short`

### 📱 Mobile Client (`mobile/justime_mobile/`)
- **Install Dependencies**: `npm install` (run in `mobile/justime_mobile/`)
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

---

## 🤖 Agent Mandatory Enforcement Rules

These rules are **non-negotiable** and must be followed on every code change. Do not skip any step.

1. **Run lint + tests after every code modification**:
   - Frontend: `cd justime_agent && npm run lint && npm test`
   - Backend: `cd justime_backend && ruff check . && pytest tests/ -v --tb=short`
   - Mobile: `cd mobile/justime_mobile && npm run lint`
2. **Never commit code that fails lint**. Fix all errors before considering the task done.
3. **SSE-related changes MUST be synchronized across Web and Mobile**. Both `justime_agent/src/hooks/useSSEChat.ts` and `mobile/justime_mobile/hooks/useSSEChat.ts` must be updated together. Use the `/add-sse-feature` skill for any SSE work.
4. **New API endpoints MUST follow the layered pattern**: `model` → `service` → `business` → `endpoint` → `route registration`. Use the `/add-backend-api` skill.
5. **All new MongoDB fields MUST have default values** for backwards compatibility (schema-less database).
6. **No debug code in commits**: Remove all `console.log`, `print()`, `breakpoint`, and temporary logging before finalizing.
7. **No hardcoded secrets**: All credentials, tokens, and API keys must come from environment variables.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
