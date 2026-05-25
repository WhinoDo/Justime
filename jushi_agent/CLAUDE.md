# Jushi Web Frontend - CLAUDE.md

This file defines the commands, architecture, and coding standards for the Next.js web frontend (`jushi_agent/`).

---

## 🛠️ Build and Development Commands

Run these commands inside the `jushi_agent/` directory:

- **Run Dev Server**: `npm run dev` (runs on `http://localhost:3000`)
- **Build Production**: `npm run build`
- **Start Production Server**: `npm run start`
- **Lint Codebase**: `npm run lint` (runs `next lint`)
- **Format Code**: `npx prettier --write .`
- **Run All Tests**: `npm test` (uses Jest)
- **Watch Tests**: `npm run test:watch`
- **Test Coverage**: `npm run test:coverage`

---

## 🏗️ Architecture & Component Design

### 1. BFF (Backend-For-Frontend) Proxying
> [!IMPORTANT]
> **CRITICAL RULE**: Do **NOT** fetch the backend API server port (e.g. `http://localhost:8080`) directly from client React components.
> All client requests must go through the Next.js API Routes located at `src/app/api/*` (BFF layer).
> - Frontend components must import and invoke APIs defined in `src/lib/api/endpoints.ts`.
> - The BFF layer automatically forwards requests to the FastAPI backend, attaches JWT secure cookies (`token`, `refresh_token`), and manages CORS.

### 2. Next.js 14 App Router Standards
- **React Server Components (RSC)**: Default to server components. Keep pages or layouts server-side where possible to optimize data loading.
- **Client Components**: Mark files explicitly with `"use client"` at the very top only when using React hooks (e.g., `useState`, `useEffect`, `useContext`), event listeners, or browser APIs.
- **Dynamic Routing**: Store route folders in `src/app/` (e.g., `src/app/chat/page.tsx` for `/chat`).

### 3. Styling & Aesthetics (Tailwind CSS & shadcn/ui)
- **Design Principles**: Avoid basic default styles. Apply modern design systems featuring:
  - Curated HSL color schemes and clean dark/light modes.
  - Smooth gradients, fine borders, glassmorphism, and shadow effects.
  - Micro-animations and transition speeds for responsive actions (using Framer Motion where appropriate).
- **Component Placement**:
  - Reusable primitive components go to `src/components/ui/` (e.g., button, dropdown, input).
  - Business/page-specific components go to custom subdirectories under `src/components/` (e.g., `src/components/chat/ChatInterface.tsx`).

### 4. SSE (Server-Sent Events) & Stream Handling
- **Streaming Hooks**: Always use the custom `useSSEChat` hook to communicate with the stream endpoint (`/api/chat/stream`).
- **Smooth Render**: Display streaming tokens using `TypewriterMessage.tsx` to handle incremental words smoothly with minimal DOM layout shifting.

---

## 📝 TypeScript & Formatting Rules

- **Type Safety**: Avoid using `any`. Always declare robust interfaces for API responses and component props in `src/types/`.
- **Imports Order**:
  1. React core hooks and next.js packages.
  2. External dependencies and UI component library primitives.
  3. Local custom hooks, utility classes, and TS definitions.
  4. Styles and assets.
- **Naming Conventions**:
  - Component files: `PascalCase.tsx`
  - Helper files/hooks: `camelCase.ts` (e.g., `useSSEChat.ts`)
  - Export types: Named exports rather than default exports for components/hooks to ensure explicit IDE navigation.
