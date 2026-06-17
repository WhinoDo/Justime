# Justime macOS Desktop UI Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不另起一套完整业务代码的前提下，把 Justime macOS 桌面端从“Web/PWA 包壳”优化为更接近 Codex、Hermes 等 Agent 产品的桌面工作台体验，并将桌面端视觉主题确定为“纯白到淡紫色磨玻璃渐变”。

**Architecture:** 保留 `justime_agent/` 作为唯一业务前端，保留 `apps/desktop/` 作为 Electron macOS 壳。Electron 只注入桌面运行时、窗口能力和快捷键事件；Next.js 通过 `useDesktopRuntime`、桌面布局组件和 Tailwind/CSS token 渲染桌面专属 UI。后端 FastAPI、MongoDB、Redis、TaskProcess API 不做改动。

**Tech Stack:** Electron 31, Next.js 14 App Router, React 18, Tailwind CSS, Radix UI/shadcn-style components, lucide-react, Jest, React Testing Library.

---

## 0. 设计结论

不要另起一套桌面业务代码。当前 `apps/desktop/src/main.js` 只是创建 `BrowserWindow` 并加载 `http://localhost:3000` 或配置的 Web URL，`apps/desktop/src/preload.js` 只暴露了基础版本信息。完整复制一套桌面 UI 会造成聊天、任务进程、Evidence、KnowledgeOutput、API 类型和测试双份维护。

推荐路线是：

- `apps/desktop/`: 负责 macOS 原生壳能力，包括窗口 chrome、菜单、快捷键、运行时注入。
- `justime_agent/`: 继续负责所有业务 UI，通过桌面运行时开关渲染桌面变体。
- 后续如果 Web 和 Desktop 差异继续扩大，再抽 `packages/ui` 或 `packages/shared`，当前阶段不要提前 monorepo 化。

桌面体验目标：

- 信息密度高于 Web/PWA，减少大背景图、过大圆角和展示型卡片。
- 核心屏幕是 Agent 工作台：左侧导航/会话，中间执行区，右侧上下文/证据/产出检查器。
- 桌面视觉主题统一为 **Snow Lilac Glass**：纯白、雾白、淡紫、浅薰衣草渐变作为主背景，所有主要容器使用高透磨玻璃；文字使用深墨蓝/石墨灰，避免浅色背景下对比不足。
- 与 Codex、Hermes 的启发保持在布局和交互模式层面，不复制品牌视觉。
- 所有桌面端差异必须可测试、可回退，并且不能破坏移动端/Web 端现有表现。

---

## 0.1 桌面端视觉主题: Snow Lilac Glass

### 主题定义

桌面端不采用深色生产力主题，统一改为 **Snow Lilac Glass**。它的主视觉是从纯白到淡紫的柔和渐变，叠加 macOS 风格磨玻璃、细边框、高透阴影和轻量状态色。

核心观感:

- Base: `#FFFFFF`、`#FBFAFF`、`#F7F2FF`
- Lilac: `#EEE7FF`、`#E8D9FF`、`#D8C3FF`
- Text: `#171421`、`#34303F`、`#6D6680`
- Glass: `rgba(255,255,255,0.62)` 到 `rgba(255,255,255,0.82)`
- Border: `rgba(126,87,194,0.16)`、`rgba(255,255,255,0.72)`
- Shadow: `0 24px 80px rgba(112, 77, 171, 0.18)`
- Accent: 使用紫色作为主强调，但状态色仍保留青绿、琥珀、玫瑰，避免全界面只有单一紫色。

视觉规则:

- 桌面端背景必须是白到淡紫的渐变，不再使用深色 slate 背景。
- 玻璃面板使用 `backdrop-blur-xl` 或 `backdrop-blur-2xl`，但透明度要高，保证文字可读。
- 圆角保持 10 到 14px；工具栏、列表项、输入框不要使用 Web 端那种 28px/32px 大圆角。
- 面板不能层层套卡；页面结构还是工作台布局，只是表面材质变为浅色磨玻璃。
- 主要文字不使用纯紫，统一用深墨蓝；紫色用于 active、focus、selected、progress。
- 所有页面共享同一主题 token，但每个页面要有不同的淡紫“性格”，见下方页面矩阵。

### 页面差异化矩阵

| 页面 | 视觉重点 | 背景倾向 | 面板特征 | 交互重点 |
|------|----------|----------|----------|----------|
| `/chat` | Agent 对话台 | 白色中心 + 右侧淡紫上下文区 | 中间消息区更白，右侧 inspector 更紫 | 输入框像悬浮玻璃 dock，RAG 引用在右侧检查器中展开 |
| `/tasks` | 任务驾驶舱 | 三阶段区域有轻微分色 | Before 偏蓝紫，During 偏白紫，After 偏薄荷紫 | Focus Queue 用更高透明度，阻塞任务用玫瑰边框 |
| `/tasks/[id]` | 单任务工作间 | 左侧阶段轨道更淡，主区纸张感更强 | Evidence 是白玻璃卡，KnowledgeOutput 是淡紫预览卡 | 当前阶段用紫色光晕，不用深色 active 块 |
| `/knowledge` | 知识库阅读 | 雾白纸面 + 淡紫边缘 | Markdown 预览更像文档纸张 | 目录/引用保持低饱和 |
| `/calendar` | 时间编排 | 白紫日历底 | 日程块按类型轻色块 | 当前日和冲突提示更明显 |
| `/dashboard` | 总览 | 大面积雾白 | 指标卡更轻，不做厚重玻璃 | 只展示关键指标，避免营销式 hero |
| `/admin` / `/model-config` | 配置后台 | 接近纯白 | 表格和表单保持高对比 | 可读性优先，紫色只作为 focus ring |

### 主题优先级

本节是后续所有代码片段的主题准则。如果下方早期代码片段仍出现深色 slate 背景、`text-slate-100`、`bg-[hsl(225_18%_8%)]`、`teal` 主按钮等写法，实现时必须按本节替换为 Snow Lilac Glass。后续 patch 应优先修改 `globals.css`、`JustimeBackground`、`JustimeGlassPanel`、`DesktopAppFrame`，再逐页调整。

---

## 1. 修改范围总表

### 1.1 必改文件

- Modify: `apps/desktop/src/main.js`
- Modify: `apps/desktop/src/preload.js`
- Modify: `apps/desktop/README.md`
- Create: `justime_agent/src/types/desktop.ts`
- Create: `justime_agent/src/hooks/useDesktopRuntime.ts`
- Create: `justime_agent/src/hooks/useDesktopCommands.ts`
- Create: `justime_agent/src/hooks/__tests__/useDesktopRuntime.test.ts`
- Create: `justime_agent/src/hooks/__tests__/useDesktopCommands.test.ts`
- Create: `justime_agent/src/components/layout/DesktopRuntimeProvider.tsx`
- Create: `justime_agent/src/components/layout/DesktopAppFrame.tsx`
- Create: `justime_agent/src/components/layout/DesktopCommandBar.tsx`
- Modify: `justime_agent/src/app/layout.tsx`
- Modify: `justime_agent/src/app/globals.css`
- Modify: `justime_agent/src/components/PWAInstallBanner.tsx`
- Modify: `justime_agent/src/components/ui/JustimeBackground.tsx`
- Modify: `justime_agent/src/components/layout/JustimePageShell.tsx`
- Modify: `justime_agent/src/components/layout/JustimeGlassPanel.tsx`
- Modify: `justime_agent/src/app/chat/page.tsx`
- Modify: `justime_agent/src/components/chat/ChatInterface.tsx`
- Modify: `justime_agent/src/components/chat/ChatHeader.tsx`
- Modify: `justime_agent/src/components/chat/ChatSidebar.tsx`
- Modify: `justime_agent/src/components/chat/MessageList.tsx`
- Modify: `justime_agent/src/components/chat/ChatInputArea.tsx`
- Create: `justime_agent/src/components/chat/ChatContextInspector.tsx`
- Modify: `justime_agent/src/components/chat/__tests__/ChatInterface.test.tsx`
- Create: `justime_agent/src/components/chat/__tests__/ChatContextInspector.test.tsx`
- Modify: `justime_agent/src/app/tasks/page.tsx`
- Modify: `justime_agent/src/components/tasks/TaskCockpit.tsx`
- Create: `justime_agent/src/components/tasks/TaskCockpitDesktop.tsx`
- Modify: `justime_agent/src/components/tasks/__tests__/TaskCockpit.test.tsx`
- Create: `justime_agent/src/components/tasks/__tests__/TaskCockpitDesktop.test.tsx`
- Modify: `justime_agent/src/app/tasks/[id]/page.tsx`
- Modify: `justime_agent/src/components/tasks/TaskPhaseDetail.tsx`
- Create: `justime_agent/src/components/tasks/TaskDetailWorkbench.tsx`
- Create: `justime_agent/src/components/tasks/__tests__/TaskDetailWorkbench.test.tsx`
- Modify: `justime_agent/src/app/dashboard/page.tsx`
- Modify: `justime_agent/src/app/knowledge/page.tsx`
- Modify: `justime_agent/src/app/calendar/page.tsx`
- Modify: `justime_agent/src/app/admin/page.tsx`
- Modify: `justime_agent/src/app/model-config/page.tsx`
- Modify: `justime_agent/src/app/profile/page.tsx`
- Modify as needed: `justime_agent/src/app/login/page.tsx`
- Modify as needed: `justime_agent/src/app/reset-password/page.tsx`

### 1.2 暂不修改

- Do not modify: `justime_backend/**`
- Do not modify: MongoDB collections or indexes
- Do not modify: API route contracts in `justime_agent/src/lib/api/endpoints.ts`
- Do not modify: authentication flow
- Do not add: a second React app under `apps/desktop`
- Do not bundle: Python backend, MongoDB, Redis into the DMG in this UI phase

---

## 2. Task 1: 建立基线和工作分支

**Files:**

- Read: `apps/desktop/src/main.js`
- Read: `apps/desktop/src/preload.js`
- Read: `justime_agent/src/app/chat/page.tsx`
- Read: `justime_agent/src/components/chat/ChatInterface.tsx`
- Read: `justime_agent/src/app/tasks/page.tsx`
- Read: `justime_agent/src/app/tasks/[id]/page.tsx`

**Step 1: 检查工作区状态**

Run:

```bash
git status --short
```

Expected:

- 看清楚已有改动。
- 不要回滚用户已有改动。

**Step 2: 创建分支**

Run:

```bash
git switch -c codex/macos-desktop-ui-optimization
```

Expected:

- 当前分支变为 `codex/macos-desktop-ui-optimization`。

**Step 3: 跑现有核心测试**

Run:

```bash
cd justime_agent
npm test -- --runInBand src/components/chat/__tests__/ChatInterface.test.tsx src/components/tasks/__tests__/TaskCockpit.test.tsx
```

Expected:

- 测试通过，或记录现有失败。
- 如果现有失败，先确认失败是否与本次改造无关。

**Step 4: 提交基线文档**

如果只是创建计划，不需要提交。进入实现阶段后再按任务提交。

---

## 3. Task 2: Electron 壳注入桌面运行时

**Files:**

- Modify: `apps/desktop/src/preload.js`
- Modify: `apps/desktop/src/main.js`
- Modify: `apps/desktop/README.md`

### Step 1: 修改 `apps/desktop/src/preload.js`

当前内容只暴露：

```js
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('justimeDesktop', {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  }
})
```

改为暴露桌面运行时、平台、版本和受控命令订阅。

Implementation:

```js
const { contextBridge, ipcRenderer } = require('electron')

const allowedCommands = new Set([
  'new-chat',
  'focus-chat-input',
  'toggle-sidebar',
  'open-tasks',
])

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.justimeRuntime = 'desktop'
  document.documentElement.dataset.justimePlatform = process.platform
  document.documentElement.classList.add('desktop-runtime')
})

contextBridge.exposeInMainWorld('justimeDesktop', {
  isDesktop: true,
  platform: process.platform,
  isMac: process.platform === 'darwin',
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  onCommand(callback) {
    if (typeof callback !== 'function') {
      return () => {}
    }

    const handler = (_event, command) => {
      if (allowedCommands.has(command)) {
        callback(command)
      }
    }

    ipcRenderer.on('justime-desktop-command', handler)
    return () => ipcRenderer.removeListener('justime-desktop-command', handler)
  },
})
```

Why:

- `document.documentElement.dataset.justimeRuntime = 'desktop'` 让 CSS 可在首屏尽早命中桌面样式。
- `window.justimeDesktop.isDesktop` 让 React hook 可安全识别 Electron 环境。
- `onCommand` 只允许白名单命令，避免把任意 IPC 暴露给前端。

### Step 2: 修改 `apps/desktop/src/main.js` 的 `createMainWindow`

当前 `BrowserWindow` options:

```js
const win = new BrowserWindow({
  width: 1280,
  height: 860,
  minWidth: 1024,
  minHeight: 720,
  title: 'Justime',
  backgroundColor: '#08111f',
  show: false,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false
  }
})
```

改成：

```js
const macWindowOptions = process.platform === 'darwin'
  ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 18 },
      vibrancy: 'under-window',
      visualEffectState: 'active',
    }
  : {}

const win = new BrowserWindow({
  width: 1360,
  height: 900,
  minWidth: 1120,
  minHeight: 760,
  title: 'Justime',
  backgroundColor: '#fbfaff',
  show: false,
  ...macWindowOptions,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  },
})
```

Change details:

- `width`: 1280 -> 1360，给三栏工作台留空间。
- `height`: 860 -> 900，减少滚动压力。
- `minWidth`: 1024 -> 1120，避免桌面布局挤压。
- `minHeight`: 720 -> 760，保证输入区和消息区同时可用。
- `titleBarStyle: 'hiddenInset'`: 使用 macOS 原生 traffic lights，同时让内容控制顶部区域。
- `trafficLightPosition`: 与桌面 frame 顶栏对齐。
- `backgroundColor`: 改为雾白淡紫，避免加载时闪出深色背景。

### Step 3: 修改 `createMenu`，增加 Agent 常用快捷键

在 `createMenu()` 里新增 `File` 菜单，放在 app menu 后、View 前。

Implementation:

```js
{
  label: 'File',
  submenu: [
    {
      label: 'New Chat',
      accelerator: 'CommandOrControl+N',
      click: (_menuItem, browserWindow) => {
        const targetWindow = browserWindow || BrowserWindow.getFocusedWindow()
        targetWindow?.webContents.send('justime-desktop-command', 'new-chat')
      },
    },
    {
      label: 'Focus Chat Input',
      accelerator: 'CommandOrControl+L',
      click: (_menuItem, browserWindow) => {
        const targetWindow = browserWindow || BrowserWindow.getFocusedWindow()
        targetWindow?.webContents.send('justime-desktop-command', 'focus-chat-input')
      },
    },
    {
      label: 'Open Tasks',
      accelerator: 'CommandOrControl+Shift+T',
      click: (_menuItem, browserWindow) => {
        const targetWindow = browserWindow || BrowserWindow.getFocusedWindow()
        targetWindow?.webContents.send('justime-desktop-command', 'open-tasks')
      },
    },
  ],
},
```

Do not:

- 不要把任意 route URL 从 main process 直接拼到 `loadURL`。
- 不要暴露 `ipcRenderer.send` 给 renderer。

### Step 4: 更新 `apps/desktop/README.md`

新增章节：

```md
## Desktop Runtime

The Electron preload injects:

- `window.justimeDesktop.isDesktop`
- `window.justimeDesktop.platform`
- `window.justimeDesktop.onCommand(callback)`
- `html[data-justime-runtime="desktop"]`

The Next.js app uses these signals to render the desktop workbench UI while keeping one shared business frontend.
```

### Step 5: 验证 Electron 壳

Run:

```bash
cd apps/desktop
npm run dev
```

Expected:

- App window opens.
- macOS traffic lights align inside the top-left inset.
- DevTools console can evaluate `window.justimeDesktop.isDesktop === true`.
- DevTools Elements can see `html[data-justime-runtime="desktop"]`.

---

## 4. Task 3: 前端增加桌面运行时类型和 Hook

**Files:**

- Create: `justime_agent/src/types/desktop.ts`
- Create: `justime_agent/src/hooks/useDesktopRuntime.ts`
- Create: `justime_agent/src/hooks/useDesktopCommands.ts`
- Create: `justime_agent/src/hooks/__tests__/useDesktopRuntime.test.ts`
- Create: `justime_agent/src/hooks/__tests__/useDesktopCommands.test.ts`

### Step 1: 创建 `justime_agent/src/types/desktop.ts`

Implementation:

```ts
export type JustimeDesktopCommand =
  | 'new-chat'
  | 'focus-chat-input'
  | 'toggle-sidebar'
  | 'open-tasks'

export interface JustimeDesktopBridge {
  isDesktop: true
  platform: NodeJS.Platform | string
  isMac: boolean
  versions: {
    chrome?: string
    electron?: string
    node?: string
  }
  onCommand?: (callback: (command: JustimeDesktopCommand) => void) => () => void
}

declare global {
  interface Window {
    justimeDesktop?: JustimeDesktopBridge
  }
}

export {}
```

Notes:

- `tsconfig.json` 已 include `**/*.ts`，无需额外注册。
- 使用 `NodeJS.Platform | string` 是因为前端类型可能不总是带 Node runtime 语义。

### Step 2: 创建 `justime_agent/src/hooks/useDesktopRuntime.ts`

Implementation:

```ts
'use client'

import { useEffect, useState } from 'react'

interface DesktopRuntimeState {
  isDesktop: boolean
  isMac: boolean
  platform: string
  versions: {
    chrome?: string
    electron?: string
    node?: string
  }
}

const initialState: DesktopRuntimeState = {
  isDesktop: false,
  isMac: false,
  platform: 'web',
  versions: {},
}

export function readDesktopRuntime(): DesktopRuntimeState {
  if (typeof window === 'undefined') {
    return initialState
  }

  const bridge = window.justimeDesktop
  const runtimeDataset = document.documentElement.dataset.justimeRuntime
  const platformDataset = document.documentElement.dataset.justimePlatform
  const isDesktop = Boolean(bridge?.isDesktop) || runtimeDataset === 'desktop'
  const platform = bridge?.platform || platformDataset || 'web'

  return {
    isDesktop,
    isMac: Boolean(bridge?.isMac) || platform === 'darwin',
    platform,
    versions: bridge?.versions || {},
  }
}

export function useDesktopRuntime() {
  const [runtime, setRuntime] = useState<DesktopRuntimeState>(initialState)

  useEffect(() => {
    setRuntime(readDesktopRuntime())
  }, [])

  return runtime
}
```

Why:

- `readDesktopRuntime()` 单独导出，方便测试。
- Hook 首次 SSR/CSR hydration 时返回 Web 默认值，mount 后再更新，避免 hydration mismatch。

### Step 3: 创建 `justime_agent/src/hooks/useDesktopCommands.ts`

Implementation:

```ts
'use client'

import { useEffect } from 'react'
import type { JustimeDesktopCommand } from '@/types/desktop'

export function useDesktopCommands(
  handler: (command: JustimeDesktopCommand) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }

    const unsubscribe = window.justimeDesktop?.onCommand?.((command) => {
      handler(command)
    })

    return () => {
      unsubscribe?.()
    }
  }, [enabled, handler])
}
```

### Step 4: 创建 `useDesktopRuntime` 测试

Create: `justime_agent/src/hooks/__tests__/useDesktopRuntime.test.ts`

Implementation:

```ts
import { readDesktopRuntime } from '../useDesktopRuntime'

describe('readDesktopRuntime', () => {
  beforeEach(() => {
    delete window.justimeDesktop
    document.documentElement.removeAttribute('data-justime-runtime')
    document.documentElement.removeAttribute('data-justime-platform')
  })

  it('returns web defaults without Electron bridge', () => {
    expect(readDesktopRuntime()).toEqual({
      isDesktop: false,
      isMac: false,
      platform: 'web',
      versions: {},
    })
  })

  it('detects desktop from bridge', () => {
    window.justimeDesktop = {
      isDesktop: true,
      platform: 'darwin',
      isMac: true,
      versions: { electron: '31.7.7' },
    }

    expect(readDesktopRuntime()).toMatchObject({
      isDesktop: true,
      isMac: true,
      platform: 'darwin',
      versions: { electron: '31.7.7' },
    })
  })

  it('detects desktop from html dataset', () => {
    document.documentElement.dataset.justimeRuntime = 'desktop'
    document.documentElement.dataset.justimePlatform = 'darwin'

    expect(readDesktopRuntime()).toMatchObject({
      isDesktop: true,
      isMac: true,
      platform: 'darwin',
    })
  })
})
```

### Step 5: 创建 `useDesktopCommands` 测试

Create: `justime_agent/src/hooks/__tests__/useDesktopCommands.test.ts`

Implementation:

```ts
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { useDesktopCommands } from '../useDesktopCommands'

function Harness({ onCommand }: { onCommand: jest.Mock }) {
  useDesktopCommands(onCommand)
  return <div>desktop command harness</div>
}

describe('useDesktopCommands', () => {
  beforeEach(() => {
    delete window.justimeDesktop
  })

  it('subscribes to desktop commands through bridge', async () => {
    const unsubscribe = jest.fn()
    window.justimeDesktop = {
      isDesktop: true,
      platform: 'darwin',
      isMac: true,
      versions: {},
      onCommand: (callback) => {
        callback('new-chat')
        return unsubscribe
      },
    }

    const onCommand = jest.fn()
    const { unmount } = render(<Harness onCommand={onCommand} />)

    await waitFor(() => {
      expect(onCommand).toHaveBeenCalledWith('new-chat')
    })

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
```

### Step 6: 验证 hook

Run:

```bash
cd justime_agent
npm test -- --runInBand src/hooks/__tests__/useDesktopRuntime.test.ts src/hooks/__tests__/useDesktopCommands.test.ts
```

Expected:

- 两个新增测试通过。

---

## 5. Task 4: 全局桌面 Provider、Token 和基础壳组件

**Files:**

- Create: `justime_agent/src/components/layout/DesktopRuntimeProvider.tsx`
- Create: `justime_agent/src/components/layout/DesktopAppFrame.tsx`
- Create: `justime_agent/src/components/layout/DesktopCommandBar.tsx`
- Modify: `justime_agent/src/app/layout.tsx`
- Modify: `justime_agent/src/app/globals.css`
- Modify: `justime_agent/src/components/ui/JustimeBackground.tsx`
- Modify: `justime_agent/src/components/layout/JustimePageShell.tsx`
- Modify: `justime_agent/src/components/layout/JustimeGlassPanel.tsx`

### Step 1: 创建 `DesktopRuntimeProvider`

Create: `justime_agent/src/components/layout/DesktopRuntimeProvider.tsx`

Implementation:

```tsx
'use client'

import { useEffect } from 'react'
import { readDesktopRuntime } from '@/hooks/useDesktopRuntime'

interface DesktopRuntimeProviderProps {
  children: React.ReactNode
}

export function DesktopRuntimeProvider({ children }: DesktopRuntimeProviderProps) {
  useEffect(() => {
    const runtime = readDesktopRuntime()
    if (!runtime.isDesktop) {
      return
    }

    document.documentElement.dataset.justimeRuntime = 'desktop'
    document.documentElement.dataset.justimePlatform = runtime.platform
    document.documentElement.classList.add('desktop-runtime')

    return () => {
      document.documentElement.classList.remove('desktop-runtime')
    }
  }, [])

  return <>{children}</>
}
```

### Step 2: 修改 `justime_agent/src/app/layout.tsx`

Add import:

```tsx
import { DesktopRuntimeProvider } from '@/components/layout/DesktopRuntimeProvider'
```

Current body:

```tsx
<ThemeProvider ...>
  {children}
  <Toaster />
  <PWAInstallBanner />
</ThemeProvider>
```

Change to:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  <DesktopRuntimeProvider>
    {children}
    <Toaster />
    <PWAInstallBanner />
  </DesktopRuntimeProvider>
</ThemeProvider>
```

Why:

- 所有页面统一获得桌面 runtime data attribute。
- `PWAInstallBanner` 后续可通过 hook 自动隐藏。

### Step 3: 修改 `globals.css` 增加桌面 token

Append inside `@layer base` or after existing base layer:

```css
@layer base {
  html[data-justime-runtime="desktop"] {
    --background: 270 100% 99%;
    --foreground: 257 24% 10%;
    --card: 0 0% 100%;
    --card-foreground: 257 24% 10%;
    --popover: 0 0% 100%;
    --popover-foreground: 257 24% 10%;
    --primary: 263 74% 58%;
    --primary-foreground: 0 0% 100%;
    --secondary: 262 100% 97%;
    --secondary-foreground: 258 26% 20%;
    --muted: 260 43% 95%;
    --muted-foreground: 257 13% 45%;
    --accent: 275 92% 94%;
    --accent-foreground: 258 34% 24%;
    --destructive: 351 72% 56%;
    --destructive-foreground: 0 0% 100%;
    --border: 263 38% 82%;
    --input: 263 38% 82%;
    --ring: 263 74% 58%;
    --radius: 0.75rem;

    --desktop-titlebar-height: 52px;
    --desktop-sidebar-width: 286px;
    --desktop-inspector-width: 360px;
    --desktop-panel-radius: 12px;
    --desktop-hairline: 263 38% 82%;
    --desktop-glass-bg: 255 255 255 / 0.68;
    --desktop-glass-strong: 255 255 255 / 0.84;
    --desktop-lilac-bg: 247 242 255 / 0.76;
    --desktop-lilac-strong: 238 231 255 / 0.88;
    --desktop-shadow: 112 77 171 / 0.18;
  }

  html[data-justime-runtime="desktop"] body {
    background:
      radial-gradient(circle at 18% 8%, rgba(255, 255, 255, 0.96) 0, rgba(255, 255, 255, 0) 32%),
      radial-gradient(circle at 88% 18%, rgba(232, 217, 255, 0.72) 0, rgba(232, 217, 255, 0) 34%),
      linear-gradient(135deg, #ffffff 0%, #fbfaff 34%, #f4edff 68%, #eadcff 100%);
    color: hsl(257 24% 10%);
    padding: 0;
  }
}
```

Add utility classes:

```css
@layer utilities {
  .desktop-drag-region {
    -webkit-app-region: drag;
  }

  .desktop-no-drag {
    -webkit-app-region: no-drag;
  }

  .desktop-window-safe-top {
    padding-top: var(--desktop-titlebar-height);
  }

  .desktop-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgb(196 181 253 / 0.72) transparent;
  }

  .desktop-scrollbar::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .desktop-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(196 181 253 / 0.72);
    border: 2px solid transparent;
    border-radius: 999px;
    background-clip: content-box;
  }

  .desktop-glass-surface {
    border: 1px solid rgba(126, 87, 194, 0.14);
    background: rgba(255, 255, 255, 0.68);
    box-shadow: 0 24px 80px rgba(112, 77, 171, 0.14);
    backdrop-filter: blur(24px) saturate(1.25);
  }

  .desktop-lilac-surface {
    border: 1px solid rgba(126, 87, 194, 0.16);
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.74), rgba(238, 231, 255, 0.72));
    box-shadow: 0 18px 60px rgba(112, 77, 171, 0.12);
    backdrop-filter: blur(28px) saturate(1.22);
  }
}
```

Design constraints:

- 不使用当前 Web 的暖橙/咖啡作为桌面主视觉。
- 桌面端必须使用纯白到淡紫渐变；不要回到深色 slate/blue-black 体系。
- 不使用离散装饰球、bokeh 或强烈紫蓝渐变；渐变必须像 macOS 窗口材质一样轻。
- 保留多色语义：purple 主操作，sky 信息，emerald 完成，amber 提醒，rose 错误。
- 任何紫色面积都必须有白色/雾白缓冲，避免页面变成单一紫色。

### Step 4: 修改 `JustimeBackground`

Current props:

```tsx
interface JustimeBackgroundProps {
    className?: string
    blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
    opacity?: number
}
```

Change to:

```tsx
interface JustimeBackgroundProps {
  className?: string
  blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  opacity?: number
  variant?: 'immersive' | 'desktop'
}
```

Add early branch:

```tsx
if (variant === 'desktop') {
  return (
    <div className={cn('absolute inset-0 z-0 overflow-hidden bg-[#fbfaff]', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(255,255,255,0.98)_0,rgba(255,255,255,0)_34%),radial-gradient(circle_at_86%_16%,rgba(232,217,255,0.72)_0,rgba(232,217,255,0)_36%),linear-gradient(135deg,#ffffff_0%,#fbfaff_34%,#f4edff_68%,#eadcff_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/80" />
      <div className="absolute inset-y-0 left-[var(--desktop-sidebar-width)] w-px bg-violet-200/40" />
      <div className="absolute inset-y-0 right-[var(--desktop-inspector-width)] w-px bg-violet-200/30" />
    </div>
  )
}
```

Keep existing image branch for `variant === 'immersive'`.

### Step 5: 修改 `JustimePageShell`

Current props:

```tsx
interface JustimePageShellProps {
  children: React.ReactNode
  className?: string
  contentClassName?: string
  blur?: ...
  opacity?: number
  fullHeight?: boolean
}
```

Add:

```tsx
variant?: 'immersive' | 'desktop'
```

Change defaults:

```tsx
variant = 'immersive',
```

Change render:

```tsx
<JustimeBackground
  blur={blur}
  opacity={opacity}
  variant={variant === 'desktop' ? 'desktop' : 'immersive'}
/>
```

Change outer classes:

```tsx
className={cn(
  'relative overflow-hidden',
  fullHeight ? 'h-screen' : 'min-h-screen',
  variant === 'desktop' && 'bg-[#fbfaff] text-[#171421]',
  className
)}
```

### Step 6: 修改 `JustimeGlassPanel`

Current:

```tsx
export function JustimeGlassPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-xl',
        className
      )}
      {...props}
    />
  )
}
```

Change to:

```tsx
interface JustimeGlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'desktop' | 'sidebar' | 'inspector'
}

const panelVariants = {
  glass: 'border border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-xl',
  desktop: 'border border-violet-200/40 bg-white/70 text-[#171421] shadow-[0_24px_80px_rgba(112,77,171,0.14)] backdrop-blur-2xl',
  sidebar: 'border-r border-violet-200/40 bg-white/62 text-[#171421] shadow-none backdrop-blur-2xl',
  inspector: 'border-l border-violet-200/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,237,255,0.74))] text-[#171421] shadow-none backdrop-blur-2xl',
} as const

export function JustimeGlassPanel({
  className,
  variant = 'glass',
  ...props
}: JustimeGlassPanelProps) {
  return (
    <div
      className={cn(panelVariants[variant], className)}
      {...props}
    />
  )
}
```

### Step 7: 创建 `DesktopAppFrame`

Create: `justime_agent/src/components/layout/DesktopAppFrame.tsx`

Implementation:

```tsx
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface DesktopAppFrameProps {
  title: string
  subtitle?: string
  sidebar?: React.ReactNode
  inspector?: React.ReactNode
  toolbar?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function DesktopAppFrame({
  title,
  subtitle,
  sidebar,
  inspector,
  toolbar,
  children,
  className,
}: DesktopAppFrameProps) {
  return (
    <div
      data-testid="desktop-app-frame"
      className={cn('grid h-screen min-h-0 grid-rows-[var(--desktop-titlebar-height)_1fr]', className)}
    >
      <header className="desktop-drag-region flex items-center border-b border-violet-200/40 bg-white/58 pl-24 pr-4 shadow-[0_12px_36px_rgba(112,77,171,0.08)] backdrop-blur-2xl">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[13px] font-semibold leading-5 text-[#171421]">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[11px] leading-4 text-[#6d6680]">{subtitle}</p>
          ) : null}
        </div>
        {toolbar ? (
          <div className="desktop-no-drag ml-4 flex items-center gap-2">
            {toolbar}
          </div>
        ) : null}
      </header>

      <div className="grid min-h-0 grid-cols-[var(--desktop-sidebar-width)_minmax(0,1fr)]">
        {sidebar ? <aside className="min-h-0 border-r border-violet-200/40 bg-white/42 backdrop-blur-2xl">{sidebar}</aside> : null}
        <main
          className={cn(
            'grid min-h-0',
            inspector ? 'grid-cols-[minmax(0,1fr)_var(--desktop-inspector-width)]' : 'grid-cols-1',
            !sidebar && 'col-span-2',
          )}
        >
          <section className="min-h-0 min-w-0">{children}</section>
          {inspector ? <aside className="min-h-0 border-l border-violet-200/40 bg-[#f7f2ff]/56 backdrop-blur-2xl">{inspector}</aside> : null}
        </main>
      </div>
    </div>
  )
}
```

### Step 8: 创建 `DesktopCommandBar`

Create: `justime_agent/src/components/layout/DesktopCommandBar.tsx`

Implementation:

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

interface DesktopCommandBarProps {
  children: React.ReactNode
  className?: string
}

export function DesktopCommandBar({ children, className }: DesktopCommandBarProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {children}
    </div>
  )
}
```

### Step 9: 验证基础壳

Run:

```bash
cd justime_agent
npm test -- --runInBand src/hooks/__tests__/useDesktopRuntime.test.ts
npm run lint
```

Expected:

- 新 hook 测试通过。
- lint 无新增错误。

---

## 6. Task 5: 桌面端隐藏 PWA 安装提示

**Files:**

- Modify: `justime_agent/src/components/PWAInstallBanner.tsx`

### Step 1: 添加 hook import

Add:

```tsx
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
```

### Step 2: 在组件内读取桌面状态

Current:

```tsx
export function PWAInstallBanner() {
  const { canInstall, isInstalled, isOffline, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
```

Change to:

```tsx
export function PWAInstallBanner() {
  const { canInstall, isInstalled, isOffline, install } = usePWAInstall();
  const { isDesktop } = useDesktopRuntime();
  const [dismissed, setDismissed] = useState(false);
```

### Step 3: 桌面端直接 return null

Before offline branch:

```tsx
if (isDesktop) {
  return null;
}
```

Why:

- Electron desktop 已经是安装形态，不应该再提示安装 PWA。
- Offline banner 后续可以改成桌面状态栏，但本阶段先隐藏 PWA 安装能力。

### Step 4: 补测试

如果现有 `usePWAInstall` 测试已经覆盖 banner，可新建或扩展：

- Modify or Create: `justime_agent/src/components/__tests__/PWAInstallBanner.test.tsx`

Test case:

```tsx
it('does not render install banner inside desktop runtime', () => {
  window.justimeDesktop = {
    isDesktop: true,
    platform: 'darwin',
    isMac: true,
    versions: {},
  }

  render(<PWAInstallBanner />)

  expect(screen.queryByText('安装矩时应用')).not.toBeInTheDocument()
})
```

Run:

```bash
cd justime_agent
npm test -- --runInBand src/components/__tests__/PWAInstallBanner.test.tsx
```

Expected:

- 桌面 runtime 下不渲染安装提示。

---

## 7. Task 6: 改造 Chat 为桌面 Agent 工作台

**Files:**

- Modify: `justime_agent/src/app/chat/page.tsx`
- Modify: `justime_agent/src/components/chat/ChatInterface.tsx`
- Modify: `justime_agent/src/components/chat/ChatHeader.tsx`
- Modify: `justime_agent/src/components/chat/ChatSidebar.tsx`
- Modify: `justime_agent/src/components/chat/MessageList.tsx`
- Modify: `justime_agent/src/components/chat/ChatInputArea.tsx`
- Create: `justime_agent/src/components/chat/ChatContextInspector.tsx`
- Modify: `justime_agent/src/components/chat/__tests__/ChatInterface.test.tsx`
- Create: `justime_agent/src/components/chat/__tests__/ChatContextInspector.test.tsx`

### Step 1: 创建 `ChatContextInspector`

Create: `justime_agent/src/components/chat/ChatContextInspector.tsx`

Purpose:

- 桌面端右侧检查器。
- 展示当前绑定任务、模型、RAG 引用预览。
- 当没有引用时展示当前上下文状态，而不是空白。
- Snow Lilac Glass 页面特点：Chat 中心对话区保持接近纯白，右侧 inspector 使用更明显的淡紫玻璃，让“上下文”和“正文对话”形成视觉分区。

Implementation:

```tsx
'use client'

import { FileText, Layers3, Bot } from 'lucide-react'
import type { RagReference } from '@/types'
import { cn } from '@/lib/utils'
import {
  RagReferencePreviewPanel,
  RagFullContentState,
  RagPreviewTab,
} from './RagReferencePreviewPanel'

interface ChatContextInspectorProps {
  currentTaskLabel?: string | null
  selectedModel?: string
  selectedReference?: RagReference | null
  previewOpen?: boolean
  activeTab?: RagPreviewTab
  fullContentState?: RagFullContentState
  isFullContentLoading?: boolean
  onPreviewClose?: () => void
  onTabChange?: (tab: RagPreviewTab) => void
  className?: string
}

export function ChatContextInspector({
  currentTaskLabel,
  selectedModel,
  selectedReference,
  previewOpen = false,
  activeTab = 'snippets',
  fullContentState,
  isFullContentLoading = false,
  onPreviewClose,
  onTabChange,
  className,
}: ChatContextInspectorProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(244,237,255,0.78))] text-[#171421] backdrop-blur-2xl', className)}>
      <div className="border-b border-violet-200/40 px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">
          Context
        </div>
        <h2 className="mt-1 text-sm font-semibold text-[#171421]">上下文检查器</h2>
      </div>

      <div className="desktop-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <section className="rounded-xl border border-violet-200/45 bg-white/68 p-3 shadow-[0_16px_48px_rgba(112,77,171,0.10)] backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-[#5a4c73]">
              <Layers3 className="h-3.5 w-3.5 text-violet-500" />
              当前任务
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-[#171421]">
              {currentTaskLabel || '未绑定 TaskProcess'}
            </p>
          </section>

          <section className="rounded-xl border border-violet-200/45 bg-white/62 p-3 shadow-[0_16px_48px_rgba(112,77,171,0.08)] backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-[#5a4c73]">
              <Bot className="h-3.5 w-3.5 text-sky-500" />
              模型
            </div>
            <p className="mt-2 truncate text-sm text-[#171421]">
              {selectedModel || '未配置模型'}
            </p>
          </section>

          {previewOpen && selectedReference ? (
            <section className="overflow-hidden rounded-xl border border-violet-200/45 bg-white/68 shadow-[0_18px_60px_rgba(112,77,171,0.12)] backdrop-blur-2xl">
              <RagReferencePreviewPanel
                open={previewOpen}
                reference={selectedReference}
                activeTab={activeTab}
                onTabChange={onTabChange || (() => {})}
                fullContentState={fullContentState}
                isFullContentLoading={isFullContentLoading}
                onClose={onPreviewClose}
                className="h-[520px] border-none bg-transparent"
              />
            </section>
          ) : (
            <section className="rounded-xl border border-dashed border-violet-200/60 bg-white/50 p-4 text-sm text-[#6d6680] backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#5a4c73]">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                引用预览
              </div>
              点击回答中的 RAG 引用后，会在这里检查来源片段和全文。
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Step 2: 修改 `ChatInterfaceProps`

In `justime_agent/src/components/chat/ChatInterface.tsx`:

Current:

```tsx
export interface ChatInterfaceProps {
  initialMessages?: Message[]
  onTaskCreate?: (task: SubtaskItem) => void
  sessionId?: string | null
  onSessionChange?: (sessionId: string) => void
  initialTaskId?: string | null
  initialTaskTitle?: string | null
}
```

Change to:

```tsx
export interface ChatInterfaceProps {
  initialMessages?: Message[]
  onTaskCreate?: (task: SubtaskItem) => void
  sessionId?: string | null
  onSessionChange?: (sessionId: string) => void
  initialTaskId?: string | null
  initialTaskTitle?: string | null
  density?: 'comfortable' | 'desktop'
}
```

Add default in function params:

```tsx
density = 'comfortable',
```

Add import:

```tsx
import { ChatContextInspector } from './ChatContextInspector'
```

### Step 3: 给 header/list/input 传入 density

Add `density` to `headerProps`:

```tsx
const headerProps: ChatHeaderProps = {
  ...
  density,
  showBackButton: density !== 'desktop',
  showHistoryLink: density !== 'desktop',
}
```

Add to `messageListProps`:

```tsx
density,
```

Add to `inputAreaProps`:

```tsx
density,
previewPlacement: density === 'desktop' ? 'inspector' : 'floating',
```

### Step 4: 修改 `ChatInterface` render

Current render:

```tsx
return (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col text-white">
    <div className="flex min-w-0 min-h-0 flex-1 flex-col">
      <ChatHeader {...headerProps} />
      <MessageList {...messageListProps} />
      <ChatInputArea {...inputAreaProps}>
        ...
      </ChatInputArea>
    </div>
  </div>
)
```

Change to:

```tsx
const mainChat = (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <ChatHeader {...headerProps} />
    <MessageList {...messageListProps} />
    <ChatInputArea {...inputAreaProps}>
      {showTimeHelper && (
        <div className="border-t border-white/10 bg-white/[0.03] p-4">
          <TimeAwareTaskInput onTaskCreate={handleTimeAwareTaskCreate} />
        </div>
      )}
    </ChatInputArea>
  </div>
)

if (density === 'desktop') {
  return (
    <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_var(--desktop-inspector-width)] text-[#171421]">
      {mainChat}
      <ChatContextInspector
        currentTaskLabel={currentTaskLabel}
        selectedModel={selectedModel}
        previewOpen={previewOpen}
        selectedReference={selectedReference}
        activeTab={activeTab}
        fullContentState={selectedReference?.docPath ? fullContentCache[selectedReference.docPath] : undefined}
        isFullContentLoading={fullContentLoadingPath === selectedReference?.docPath}
        onPreviewClose={() => setPreviewOpen(false)}
        onTabChange={setActiveTab}
      />
    </div>
  )
}

return (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col text-white">
    {mainChat}
  </div>
)
```

### Step 5: 修改 `ChatHeaderProps`

In `ChatHeader.tsx`, add props:

```tsx
density?: 'comfortable' | 'desktop'
showBackButton?: boolean
showHistoryLink?: boolean
```

In params:

```tsx
density = 'comfortable',
showBackButton = true,
showHistoryLink = true,
```

Change outer class:

```tsx
className={cn(
  'sticky top-0 z-40 border-b backdrop-blur-xl',
  density === 'desktop'
    ? 'border-violet-200/40 bg-white/58 px-4 py-2 text-[#171421] shadow-[0_10px_36px_rgba(112,77,171,0.08)]'
    : 'border-white/10 bg-black/10 px-4 py-4 md:px-6'
)}
```

Add `cn` import:

```tsx
import { cn } from '@/lib/utils'
```

Render back button only when `showBackButton`:

```tsx
{showBackButton ? (
  <Link href="/dashboard">
    ...
  </Link>
) : null}
```

Render history link only when `showHistoryLink`:

```tsx
{showHistoryLink ? (
  <Link href="/chat/history">
    ...
  </Link>
) : null}
```

Desktop copy change:

```tsx
<h2 className={cn(
  'font-bold tracking-tight',
  density === 'desktop' ? 'text-[#171421]' : 'text-white',
  density === 'desktop' ? 'text-sm' : 'text-xl'
)}>
  {density === 'desktop' ? 'Agent Console' : '矩时智能助手'}
</h2>
<p className={cn(
  density === 'desktop' ? 'text-[#6d6680]' : 'text-white/55',
  density === 'desktop' ? 'text-xs' : 'text-sm'
)}>
  {density === 'desktop' ? '任务推进 · 上下文检查 · 知识沉淀' : '情绪感知 · 任务拆解 · 智能陪伴'}
</p>
```

### Step 6: 修改 `ChatSidebar`

Add prop:

```tsx
variant?: 'glass' | 'desktop'
```

Change function signature:

```tsx
export function ChatSidebar({
  userId,
  currentSessionId,
  onSelectSession,
  className,
  autoSelectLatest = false,
  variant = 'glass',
}: ChatSidebarProps) {
```

Change outer class:

```tsx
className={cn(
  'flex h-full flex-col',
  variant === 'desktop' ? 'bg-white/50 text-[#171421] backdrop-blur-2xl' : 'text-white',
  className,
)}
```

Change item radius in desktop:

- `rounded-2xl` -> desktop `rounded-lg`
- `bg-white/5` -> desktop `bg-transparent`
- active -> desktop `bg-white/[0.08] border-white/[0.1]`

Specific helper:

```tsx
const itemClass = (active: boolean) => cn(
  'group flex w-full items-center gap-3 border border-transparent px-3 py-2.5 text-left text-sm transition-colors',
  variant === 'desktop'
    ? 'rounded-xl hover:border-violet-200/60 hover:bg-white/72'
    : 'rounded-2xl hover:border-white/10 hover:bg-white/10',
  active
    ? variant === 'desktop'
      ? 'border-violet-300/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(238,231,255,0.76))] shadow-[0_16px_44px_rgba(112,77,171,0.12)]'
      : 'border-white/20 bg-white/15 shadow-lg shadow-black/10'
    : variant === 'desktop'
      ? 'bg-transparent'
      : 'bg-white/5',
)
```

### Step 7: 修改 `MessageListProps`

Add:

```tsx
density?: 'comfortable' | 'desktop'
```

In function params:

```tsx
density = 'comfortable',
```

Add `cn` import.

Change empty state:

```tsx
<div className={cn(
  'flex-1 overflow-y-auto scroll-smooth',
  density === 'desktop' ? 'desktop-scrollbar px-6 py-5' : 'px-4 py-6 md:px-6'
)}>
```

Desktop empty copy:

```tsx
<h3 className={cn('font-semibold text-white', density === 'desktop' ? 'text-base' : 'text-xl')}>
  {density === 'desktop' ? '等待任务上下文' : '开始对话'}
</h3>
<p className="max-w-md text-sm text-white/60">
  {density === 'desktop'
    ? '输入当前要推进的任务、粘贴错误日志，或从左侧选择一个会话继续。'
    : '告诉我你现在的任务或感受，我会根据你的情绪状态提供个性化的帮助和任务拆解建议'}
</p>
```

### Step 8: 修改 `ChatInputAreaProps`

Add:

```tsx
density?: 'comfortable' | 'desktop'
previewPlacement?: 'floating' | 'inspector'
```

In params:

```tsx
density = 'comfortable',
previewPlacement = 'floating',
```

Wrap floating preview:

```tsx
{previewPlacement === 'floating' && previewOpen && selectedReference && (
  ...
)}
```

Change textarea height:

```tsx
className={cn(
  'resize-none overflow-y-auto border-0 bg-transparent px-6 focus-visible:ring-0 focus-visible:ring-offset-0',
  density === 'desktop' ? 'text-[#171421] placeholder:text-[#8b7aa8]' : 'text-white placeholder:text-white/35',
  density === 'desktop' ? 'h-24 py-3 text-sm' : 'h-32 py-4 text-base'
)}
```

Change container:

```tsx
className={cn(
  'relative mx-auto overflow-hidden border transition-all duration-300',
  density === 'desktop'
    ? 'max-w-4xl rounded-2xl border-violet-200/50 bg-white/72 shadow-[0_24px_72px_rgba(112,77,171,0.14)] backdrop-blur-2xl focus-within:border-violet-400/55 focus-within:bg-white/82'
    : 'max-w-3xl rounded-3xl border-white/10 bg-white/5 shadow-lg shadow-black/10 backdrop-blur-xl focus-within:border-white/20 focus-within:bg-white/8 focus-within:ring-1 focus-within:ring-white/10'
)}
```

Change send button:

- Desktop button text may be only `发送` to reduce width.
- Keep accessible name with `aria-label="发送消息"` if visible text changes.

### Step 9: 修改 `chat/page.tsx`

Add imports:

```tsx
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { useDesktopCommands } from '@/hooks/useDesktopCommands'
import { DesktopAppFrame } from '@/components/layout/DesktopAppFrame'
import { DesktopCommandBar } from '@/components/layout/DesktopCommandBar'
import { Button } from '@/components/ui/button'
import { ListTree, Plus } from 'lucide-react'
```

Inside `ChatPageInner`:

```tsx
const { isDesktop } = useDesktopRuntime()
```

Add command handling:

```tsx
useDesktopCommands((command) => {
  if (command === 'new-chat') {
    setSessionId(null)
  }
  if (command === 'open-tasks') {
    window.location.href = '/tasks'
  }
})
```

Desktop render branch before current Web render:

```tsx
if (isDesktop) {
  return (
    <JustimePageShell fullHeight variant="desktop" blur="none" opacity={0} contentClassName="h-full">
      <DesktopAppFrame
        title="Justime Agent"
        subtitle={taskTitle ? `绑定任务: ${taskTitle}` : 'Chat, task process, evidence, and knowledge context'}
        toolbar={
          <DesktopCommandBar>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg border border-violet-200/50 bg-white/60 px-2 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/80 hover:text-[#171421]"
              onClick={() => setSessionId(null)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New
            </Button>
            <Link href="/tasks">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg border border-violet-200/50 bg-white/60 px-2 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/80 hover:text-[#171421]"
              >
                <ListTree className="mr-1.5 h-3.5 w-3.5" />
                Tasks
              </Button>
            </Link>
          </DesktopCommandBar>
        }
        sidebar={
          <ChatSidebar
            userId={user.id}
            currentSessionId={sessionId}
            onSelectSession={setSessionId}
            autoSelectLatest
            variant="desktop"
          />
        }
      >
        <ChatInterface
          density="desktop"
          sessionId={sessionId}
          onSessionChange={setSessionId}
          initialTaskId={taskId}
          initialTaskTitle={taskTitle}
        />
      </DesktopAppFrame>
    </JustimePageShell>
  )
}
```

Keep existing render branch unchanged for Web/PWA.

### Step 10: 测试 Chat 桌面 branch

Modify: `justime_agent/src/components/chat/__tests__/ChatInterface.test.tsx`

Add:

```tsx
it('renders desktop density with context inspector', async () => {
  render(<ChatInterface density="desktop" initialTaskTitle="桌面端 UI 优化" />)

  await waitFor(() => {
    expect(screen.getByText('Agent Console')).toBeInTheDocument()
  })

  expect(screen.getByText('上下文检查器')).toBeInTheDocument()
  expect(screen.getByText('桌面端 UI 优化')).toBeInTheDocument()
})
```

Create: `justime_agent/src/components/chat/__tests__/ChatContextInspector.test.tsx`

Implementation:

```tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChatContextInspector } from '../ChatContextInspector'

describe('ChatContextInspector', () => {
  it('renders task and model context', () => {
    render(
      <ChatContextInspector
        currentTaskLabel="macOS 桌面端优化"
        selectedModel="deepseek-chat"
      />,
    )

    expect(screen.getByText('上下文检查器')).toBeInTheDocument()
    expect(screen.getByText('macOS 桌面端优化')).toBeInTheDocument()
    expect(screen.getByText('deepseek-chat')).toBeInTheDocument()
    expect(screen.getByText(/点击回答中的 RAG 引用/)).toBeInTheDocument()
  })
})
```

Run:

```bash
cd justime_agent
npm test -- --runInBand src/components/chat/__tests__/ChatInterface.test.tsx src/components/chat/__tests__/ChatContextInspector.test.tsx
```

Expected:

- Chat existing tests pass.
- Desktop density test passes.

---

## 8. Task 7: 改造 Tasks 列表为桌面任务驾驶舱

**Files:**

- Modify: `justime_agent/src/app/tasks/page.tsx`
- Modify: `justime_agent/src/components/tasks/TaskCockpit.tsx`
- Create: `justime_agent/src/components/tasks/TaskCockpitDesktop.tsx`
- Modify: `justime_agent/src/components/tasks/__tests__/TaskCockpit.test.tsx`
- Create: `justime_agent/src/components/tasks/__tests__/TaskCockpitDesktop.test.tsx`

### Step 1: 创建 `TaskCockpitDesktop`

Create: `justime_agent/src/components/tasks/TaskCockpitDesktop.tsx`

Purpose:

- 桌面端任务工作台。
- 左侧为 Focus Queue。
- 中间为 Before/During/After phase board。
- 右侧为指标和阻塞摘要。
- Snow Lilac Glass 页面特点：`/tasks` 是最像工作台的页面，但不能变成深色 kanban。整体使用白紫底，三列阶段区轻微分色：Before 偏冷蓝紫，During 偏雾白紫，After 偏薄荷紫；阻塞任务只用玫瑰边框和浅玫瑰底。

Implementation outline:

```tsx
'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileText, FolderKanban } from 'lucide-react'
import type { TaskProcess } from '@/types/taskProcess'
import { cn } from '@/lib/utils'

interface TaskCockpitDesktopProps {
  tasks: TaskProcess[]
  loading?: boolean
}

const phaseLabels = {
  before: 'Before',
  during: 'During',
  after: 'After',
} as const

function formatHours(value: number) {
  return `${Number(value || 0).toFixed(value % 1 === 0 ? 0 : 1)}h`
}

function getPhaseBuckets(tasks: TaskProcess[]) {
  return {
    before: tasks.filter((task) => task.phase === 'before'),
    during: tasks.filter((task) => task.phase === 'during'),
    after: tasks.filter((task) => task.phase === 'after'),
  }
}

function getFocusTasks(tasks: TaskProcess[]) {
  return tasks
    .filter((task) => task.status === 'blocked' || task.status === 'active')
    .sort((a, b) => {
      if (a.status === 'blocked' && b.status !== 'blocked') return -1
      if (b.status === 'blocked' && a.status !== 'blocked') return 1
      return b.progress - a.progress
    })
    .slice(0, 8)
}

function getSummary(tasks: TaskProcess[]) {
  return {
    active: tasks.filter((task) => task.status === 'active').length,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    totalHours: tasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0),
    evidence: tasks.reduce((sum, task) => sum + (task.evidence_count || 0), 0),
    outputs: tasks.reduce((sum, task) => sum + (task.knowledge_output_count || 0), 0),
  }
}

export function TaskCockpitDesktop({ tasks, loading = false }: TaskCockpitDesktopProps) {
  const buckets = getPhaseBuckets(tasks)
  const focusTasks = getFocusTasks(tasks)
  const summary = getSummary(tasks)

  if (loading) {
    return <div className="p-6 text-sm text-[#6d6680]">加载任务中</div>
  }

  return (
    <div data-testid="task-cockpit-desktop" className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)_320px] bg-transparent text-[#171421]">
      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-r border-violet-200/40 bg-white/46 p-4 backdrop-blur-2xl">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Focus Queue</div>
        <div className="space-y-2">
          {focusTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-violet-200/60 bg-white/48 p-4 text-sm text-[#6d6680]">暂无需要推进的任务。</div>
          ) : focusTasks.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-xl border border-violet-200/45 bg-white/64 p-3 shadow-[0_14px_42px_rgba(112,77,171,0.08)] backdrop-blur-xl transition hover:border-violet-300/70 hover:bg-white/82">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#171421]">{task.title}</p>
                  <p className="mt-1 text-xs text-[#8b7aa8]">{phaseLabels[task.phase]} · {Math.round(task.progress * 100)}%</p>
                </div>
                {task.status === 'blocked' ? <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" /> : null}
              </div>
            </Link>
          ))}
        </div>
      </aside>

      <main className="desktop-scrollbar min-h-0 overflow-y-auto p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Task Process OS</div>
            <h1 className="mt-1 text-xl font-semibold text-[#171421]">任务驾驶舱</h1>
          </div>
          <Link href="/chat" className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/50 bg-white/64 px-3 py-1.5 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/82 hover:text-[#171421]">
            打开 Agent
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid min-h-[520px] grid-cols-3 gap-3">
          {(Object.keys(buckets) as Array<keyof typeof buckets>).map((phase) => (
            <section key={phase} className={cn(
              'rounded-2xl border border-violet-200/45 shadow-[0_20px_64px_rgba(112,77,171,0.10)] backdrop-blur-2xl',
              phase === 'before' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(239,246,255,0.68))]',
              phase === 'during' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,242,255,0.70))]',
              phase === 'after' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(236,253,245,0.58))]',
            )}>
              <div className="border-b border-violet-200/35 px-3 py-2">
                <h2 className="text-sm font-semibold text-[#171421]">{phaseLabels[phase]}</h2>
                <p className="text-xs text-[#8b7aa8]">{buckets[phase].length} tasks</p>
              </div>
              <div className="space-y-2 p-3">
                {buckets[phase].slice(0, 8).map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-xl border border-violet-200/40 bg-white/66 p-3 shadow-sm backdrop-blur-xl hover:border-violet-300/70 hover:bg-white/86">
                    <p className="line-clamp-2 text-sm font-medium text-[#171421]">{task.title}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(task.progress * 100)}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#8b7aa8]">
                      <span>{formatHours(task.actual_hours)}</span>
                      <span>{task.evidence_count} evidence</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-l border-violet-200/40 bg-[#f7f2ff]/54 p-4 backdrop-blur-2xl">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Metrics</div>
        <div className="grid gap-2">
          {[
            { label: '活跃任务', value: summary.active, icon: FolderKanban },
            { label: '阻塞任务', value: summary.blocked, icon: AlertTriangle },
            { label: '已完成', value: summary.completed, icon: CheckCircle2 },
            { label: '累计投入', value: formatHours(summary.totalHours), icon: Clock3 },
            { label: 'Evidence', value: summary.evidence, icon: FileText },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-violet-200/45 bg-white/64 p-3 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8b7aa8]">{item.label}</span>
                <item.icon className="h-3.5 w-3.5 text-[#8b7aa8]" />
              </div>
              <div className="mt-2 text-lg font-semibold text-[#171421]">{item.value}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
```

### Step 2: 修改 `TaskCockpit`

Add import:

```tsx
import { TaskCockpitDesktop } from './TaskCockpitDesktop'
```

Change props:

```tsx
interface TaskCockpitProps {
  tasks: TaskProcess[]
  loading?: boolean
  variant?: 'immersive' | 'desktop'
}
```

At top of function:

```tsx
export function TaskCockpit({ tasks, loading = false, variant = 'immersive' }: TaskCockpitProps) {
  if (variant === 'desktop') {
    return <TaskCockpitDesktop tasks={tasks} loading={loading} />
  }

  ...
}
```

Keep current Web UI unchanged.

### Step 3: 修改 `tasks/page.tsx`

Add:

```tsx
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { DesktopAppFrame } from '@/components/layout/DesktopAppFrame'
```

Inside component:

```tsx
const { isDesktop } = useDesktopRuntime()
```

Desktop branch:

```tsx
if (isDesktop) {
  return (
    <JustimePageShell fullHeight variant="desktop" blur="none" opacity={0} contentClassName="h-full">
      <DesktopAppFrame
        title="Task Process OS"
        subtitle="Before, During, After"
        toolbar={
          <TaskCreateLauncher
            buttonLabel="新建任务"
            createTask={createTask}
            buttonProps={{ className: 'h-8 rounded-lg bg-violet-600 px-3 text-xs text-white shadow-[0_12px_32px_rgba(126,87,194,0.28)] hover:bg-violet-500' }}
            buttonContent={<><Plus className="mr-1.5 h-3.5 w-3.5" />新建任务</>}
          />
        }
      >
        <TaskCockpit tasks={taskList} loading={loading} variant="desktop" />
      </DesktopAppFrame>
    </JustimePageShell>
  )
}
```

Keep current Web branch unchanged.

### Step 4: Tests

Modify: `TaskCockpit.test.tsx`

Add:

```tsx
it('renders desktop variant through TaskCockpit', () => {
  render(<TaskCockpit tasks={tasks} loading={false} variant="desktop" />)

  expect(screen.getByTestId('task-cockpit-desktop')).toBeInTheDocument()
  expect(screen.getByText('Focus Queue')).toBeInTheDocument()
})
```

Create: `TaskCockpitDesktop.test.tsx`

Implementation:

```tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import { TaskCockpitDesktop } from '../TaskCockpitDesktop'
import type { TaskProcess } from '@/types/taskProcess'

const tasks = [
  {
    id: 'task-1',
    userId: 'user-1',
    title: '推进 macOS 桌面端',
    description: '桌面 UI 优化',
    goal: '完成桌面工作台',
    category: 'project',
    tags: ['desktop'],
    status: 'active',
    phase: 'during',
    priority: 'high',
    progress: 0.5,
    progress_source: 'evidence',
    actual_hours: 3,
    milestones: [],
    blockers: [],
    ai_suggestions: [],
    related_chat_session_ids: [],
    related_calendar_event_ids: [],
    evidence_count: 4,
    knowledge_output_count: 1,
  },
] satisfies TaskProcess[]

describe('TaskCockpitDesktop', () => {
  it('renders focus queue, phase board, and metrics', () => {
    render(<TaskCockpitDesktop tasks={tasks} />)

    expect(screen.getByText('Focus Queue')).toBeInTheDocument()
    expect(screen.getByText('During')).toBeInTheDocument()
    expect(screen.getByText('推进 macOS 桌面端')).toBeInTheDocument()
    expect(screen.getByText('累计投入')).toBeInTheDocument()
  })
})
```

Run:

```bash
cd justime_agent
npm test -- --runInBand src/components/tasks/__tests__/TaskCockpit.test.tsx src/components/tasks/__tests__/TaskCockpitDesktop.test.tsx
```

Expected:

- Existing immersive TaskCockpit still passes.
- Desktop TaskCockpit passes.

---

## 9. Task 8: 改造任务详情为桌面 Workbench

**Files:**

- Modify: `justime_agent/src/app/tasks/[id]/page.tsx`
- Modify: `justime_agent/src/components/tasks/TaskPhaseDetail.tsx`
- Create: `justime_agent/src/components/tasks/TaskDetailWorkbench.tsx`
- Create: `justime_agent/src/components/tasks/__tests__/TaskDetailWorkbench.test.tsx`

### Step 1: 创建 `TaskDetailWorkbench`

Create: `justime_agent/src/components/tasks/TaskDetailWorkbench.tsx`

Purpose:

- 桌面任务详情页不再是三张大玻璃卡，而是工作台。
- 左侧为阶段轨道。
- 中间为当前阶段工作区。
- 右侧为 Evidence、KnowledgeOutput、时间投入和 Chat 入口。
- Snow Lilac Glass 页面特点：`/tasks/[id]` 要比任务列表更像“文档工作间”。主工作区更白、更像纸张；左侧阶段轨道使用很淡的紫色玻璃；右侧 inspector 更偏淡紫，用于 Evidence 和 KnowledgeOutput。

Implementation structure:

```tsx
'use client'

import Link from 'next/link'
import { ArrowRight, BookOpenCheck, Clock3, FileText, MessageSquareMore, Pencil } from 'lucide-react'
import type { Evidence, KnowledgeOutput, TaskProcess } from '@/types/taskProcess'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TaskDetailActions, type TaskDetailActionsProps } from './TaskDetailActions'

interface TaskDetailWorkbenchProps {
  task: TaskProcess
  evidence: Evidence[]
  outputs: KnowledgeOutput[]
  onEditTask: () => void
  onCreateEvidence: TaskDetailActionsProps['onCreateEvidence']
  onCreateTimeLog: TaskDetailActionsProps['onCreateTimeLog']
  onGenerateKnowledge: TaskDetailActionsProps['onGenerateKnowledge']
}

const phases = [
  { key: 'before', label: 'Before', description: '规划和前置准备' },
  { key: 'during', label: 'During', description: '执行、证据和阻塞' },
  { key: 'after', label: 'After', description: '总结、发布和复盘' },
] as const

export function TaskDetailWorkbench({
  task,
  evidence,
  outputs,
  onEditTask,
  onCreateEvidence,
  onCreateTimeLog,
  onGenerateKnowledge,
}: TaskDetailWorkbenchProps) {
  const activePhase = phases.find((phase) => phase.key === task.phase)

  return (
    <div data-testid="task-detail-workbench" className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)_360px] bg-transparent text-[#171421]">
      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-r border-violet-200/40 bg-white/50 p-4 backdrop-blur-2xl">
        <div className="mb-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Task Detail</div>
          <h1 className="mt-1 line-clamp-3 text-lg font-semibold text-[#171421]">{task.title}</h1>
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#6d6680]">{task.goal}</p>
        </div>

        <div className="space-y-2">
          {phases.map((phase) => {
            const active = phase.key === task.phase
            return (
              <div
                key={phase.key}
                className={cn(
                  'rounded-xl border p-3 backdrop-blur-xl',
                  active
                    ? 'border-violet-300/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(238,231,255,0.78))] shadow-[0_16px_48px_rgba(112,77,171,0.14)]'
                    : 'border-violet-200/40 bg-white/52',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#171421]">{phase.label}</span>
                  {active ? <span className="text-[10px] uppercase tracking-[0.16em] text-violet-600">Active</span> : null}
                </div>
                <p className="mt-1 text-xs text-[#8b7aa8]">{phase.description}</p>
              </div>
            )
          })}
        </div>
      </aside>

      <main className="desktop-scrollbar min-h-0 overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">{activePhase?.label}</div>
            <h2 className="mt-1 text-xl font-semibold text-[#171421]">{activePhase?.description}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="h-8 rounded-lg border border-violet-200/50 bg-white/64 px-3 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/84 hover:text-[#171421]" onClick={onEditTask}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              编辑
            </Button>
            <Link href={`/chat?taskId=${encodeURIComponent(task.id)}&taskTitle=${encodeURIComponent(task.title)}`}>
              <Button type="button" variant="ghost" className="h-8 rounded-lg border border-violet-200/50 bg-white/64 px-3 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/84 hover:text-[#171421]">
                打开任务对话
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <section className="rounded-2xl border border-violet-200/40 bg-white/78 p-4 shadow-[0_24px_80px_rgba(112,77,171,0.10)] backdrop-blur-2xl">
          <TaskDetailActions
            taskId={task.id}
            onCreateEvidence={onCreateEvidence}
            onCreateTimeLog={onCreateTimeLog}
            onGenerateKnowledge={onGenerateKnowledge}
          />
        </section>
      </main>

      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-l border-violet-200/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(244,237,255,0.78))] p-4 backdrop-blur-2xl">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Inspector</div>
        <div className="grid gap-2">
          {[
            { icon: Clock3, label: 'Actual Hours', value: `${task.actual_hours}h` },
            { icon: FileText, label: 'Evidence', value: String(task.evidence_count) },
            { icon: BookOpenCheck, label: 'Outputs', value: String(task.knowledge_output_count) },
            { icon: MessageSquareMore, label: 'Chat Sessions', value: String(task.related_chat_session_ids.length) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-violet-200/45 bg-white/64 p-3 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between text-xs text-[#8b7aa8]">
                <span>{item.label}</span>
                <item.icon className="h-3.5 w-3.5" />
              </div>
              <div className="mt-2 text-lg font-semibold text-[#171421]">{item.value}</div>
            </div>
          ))}
        </div>

        <section className="mt-4 rounded-xl border border-violet-200/45 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-[#171421]">Recent Evidence</h3>
          <div className="mt-3 space-y-2">
            {evidence.length === 0 ? (
              <p className="text-sm text-[#6d6680]">还没有 Evidence。</p>
            ) : evidence.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg border border-violet-200/40 bg-white/64 p-2">
                <p className="truncate text-sm text-[#171421]">{item.title || '未命名 Evidence'}</p>
                <p className="mt-1 line-clamp-2 text-xs text-[#6d6680]">{item.content}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-violet-200/45 bg-[linear-gradient(135deg,rgba(255,255,255,0.70),rgba(238,231,255,0.70))] p-3 shadow-sm backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-[#171421]">Knowledge Outputs</h3>
          <div className="mt-3 space-y-2">
            {outputs.length === 0 ? (
              <p className="text-sm text-[#6d6680]">还没有知识产出。</p>
            ) : outputs.slice(0, 5).map((output) => (
              <div key={output.id} className="rounded-lg border border-violet-200/40 bg-white/64 p-2">
                <p className="truncate text-sm text-[#171421]">{output.title}</p>
                <p className="mt-1 text-xs text-[#8b7aa8]">{output.status}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}
```

### Step 2: 保持 `TaskPhaseDetail` Web UI 不破坏

Do not replace current `TaskPhaseDetail` body. It remains Web/PWA immersive UI.

Optional minor change:

- Extract `phaseLabels`, `formatHours` only if duplication becomes high.
- Do not refactor Web UI in the same commit.

### Step 3: 修改 `tasks/[id]/page.tsx`

Add imports:

```tsx
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { DesktopAppFrame } from '@/components/layout/DesktopAppFrame'
import { TaskDetailWorkbench } from '@/components/tasks/TaskDetailWorkbench'
```

Inside component:

```tsx
const { isDesktop } = useDesktopRuntime()
```

Change loading wrapper:

```tsx
const pageShellProps = isDesktop
  ? { fullHeight: true, variant: 'desktop' as const, blur: 'none' as const, opacity: 0, contentClassName: 'h-full' }
  : { blur: 'lg' as const, opacity: 0.35, contentClassName: 'px-4 py-8 md:px-8' }
```

Use:

```tsx
<JustimePageShell {...pageShellProps}>
```

For desktop task render:

```tsx
{task && isDesktop ? (
  <DesktopAppFrame title={task.title} subtitle={`${task.phase.toUpperCase()} · ${task.status}`}>
    <TaskDetailWorkbench
      task={task}
      evidence={evidence}
      outputs={outputs}
      onEditTask={() => setEditOpen(true)}
      onCreateEvidence={...same existing handler...}
      onCreateTimeLog={...same existing handler...}
      onGenerateKnowledge={...same existing handler...}
    />
  </DesktopAppFrame>
) : null}
```

For Web render, keep existing fragment:

```tsx
{task && !isDesktop ? (
  <>
    <TaskPhaseDetail ... />
    <KnowledgeOutputPanel ... />
    ...
  </>
) : null}
```

Important:

- Dialogs `TaskProcessFormDialog` and `KnowledgeOutputEditorDialog` should remain outside the desktop/Web conditional when possible, so both modes keep edit and publish behavior.
- `KnowledgeOutputPanel` may stay Web-only for this phase because desktop inspector lists outputs. Full output editing still opens from existing dialogs if wired later.

### Step 4: Test `TaskDetailWorkbench`

Create: `justime_agent/src/components/tasks/__tests__/TaskDetailWorkbench.test.tsx`

Implementation:

```tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import { TaskDetailWorkbench } from '../TaskDetailWorkbench'
import type { Evidence, KnowledgeOutput, TaskProcess } from '@/types/taskProcess'

const task: TaskProcess = {
  id: 'task-1',
  userId: 'user-1',
  title: 'macOS 桌面端 UI 优化',
  description: '优化桌面工作台',
  goal: '让桌面端适合长时间任务推进',
  category: 'project',
  tags: ['desktop'],
  status: 'active',
  phase: 'during',
  priority: 'high',
  progress: 0.5,
  progress_source: 'evidence',
  actual_hours: 4,
  milestones: [],
  blockers: [],
  ai_suggestions: [],
  related_chat_session_ids: ['session-1'],
  related_calendar_event_ids: [],
  evidence_count: 1,
  knowledge_output_count: 1,
}

const evidence: Evidence[] = [{
  id: 'ev-1',
  task_id: 'task-1',
  userId: 'user-1',
  type: 'note',
  title: '桌面布局调研',
  content: '确认三栏工作台结构。',
  source: 'manual',
  createdAt: new Date().toISOString(),
}]

const outputs: KnowledgeOutput[] = [{
  id: 'ko-1',
  task_id: 'task-1',
  userId: 'user-1',
  title: '桌面端 UI 优化方案',
  content: '# 方案',
  format: 'summary',
  status: 'draft',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}]

describe('TaskDetailWorkbench', () => {
  it('renders desktop task detail workbench', () => {
    render(
      <TaskDetailWorkbench
        task={task}
        evidence={evidence}
        outputs={outputs}
        onEditTask={jest.fn()}
        onCreateEvidence={jest.fn()}
        onCreateTimeLog={jest.fn()}
        onGenerateKnowledge={jest.fn()}
      />,
    )

    expect(screen.getByTestId('task-detail-workbench')).toBeInTheDocument()
    expect(screen.getByText('macOS 桌面端 UI 优化')).toBeInTheDocument()
    expect(screen.getByText('Recent Evidence')).toBeInTheDocument()
    expect(screen.getByText('桌面布局调研')).toBeInTheDocument()
    expect(screen.getByText('Knowledge Outputs')).toBeInTheDocument()
  })
})
```

Run:

```bash
cd justime_agent
npm test -- --runInBand src/components/tasks/__tests__/TaskDetailWorkbench.test.tsx
```

Expected:

- Desktop workbench renders core task, phase rail, evidence, outputs.

---

## 10. Task 8.5: 次级页面应用 Snow Lilac Glass

**Files:**

- Modify: `justime_agent/src/app/dashboard/page.tsx`
- Modify: `justime_agent/src/app/knowledge/page.tsx`
- Modify: `justime_agent/src/app/calendar/page.tsx`
- Modify: `justime_agent/src/app/admin/page.tsx`
- Modify: `justime_agent/src/app/model-config/page.tsx`
- Modify: `justime_agent/src/app/profile/page.tsx`
- Modify as needed: `justime_agent/src/app/login/page.tsx`
- Modify as needed: `justime_agent/src/app/reset-password/page.tsx`

### Step 1: Dashboard 改成雾白总览页

Target file: `justime_agent/src/app/dashboard/page.tsx`

Current issue:

- 当前 `DashboardPage` 直接用 `JustimeBackground` 的图片/深色玻璃风，标题和卡片大量使用 `text-white`。
- 桌面端会和新的 Snow Lilac Glass 冲突。

Implementation:

1. Import:

```tsx
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
```

2. Inside component:

```tsx
const { isDesktop } = useDesktopRuntime()
```

3. Replace desktop loading branch:

```tsx
if (isLoading && isDesktop) {
  return (
    <JustimePageShell fullHeight variant="desktop" blur="none" opacity={0} contentClassName="flex items-center justify-center">
      <div className="rounded-2xl border border-violet-200/45 bg-white/68 px-6 py-5 text-center shadow-[0_24px_80px_rgba(112,77,171,0.14)] backdrop-blur-2xl">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-violet-500" />
        <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Loading Workbench</p>
      </div>
    </JustimePageShell>
  )
}
```

4. Desktop render should wrap content:

```tsx
if (isDesktop) {
  return (
    <JustimePageShell variant="desktop" blur="none" opacity={0} contentClassName="min-h-screen px-6 py-8">
      <div ref={containerRef} className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-violet-200/45 bg-white/66 p-7 shadow-[0_24px_80px_rgba(112,77,171,0.12)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-200/50 bg-white/70 text-violet-600 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#171421]">
                {greeting}，{user?.username || '朋友'}
              </h1>
              <p className="mt-1 text-sm text-[#6d6680]">今天的任务、日程和知识入口都在这里。</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => (
            <Link key={index} href={card.href} className="group block">
              <div className="h-full rounded-2xl border border-violet-200/45 bg-white/64 p-5 shadow-[0_18px_60px_rgba(112,77,171,0.10)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-violet-300/70 hover:bg-white/82">
                <div className="flex items-start justify-between gap-4">
                  <div className={cn('rounded-xl p-2.5', card.bgColor)}>
                    <card.icon className={cn('h-5 w-5', card.color)} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#8b7aa8] transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-[#171421]">{card.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6d6680]">{card.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </JustimePageShell>
  )
}
```

5. Keep existing non-desktop render branch unchanged.

Dashboard page character:

- 比 Chat 更像入口总览，卡片更轻，标题不做大 hero。
- 背景以雾白为主，淡紫只在卡片边缘、hover 和 icon chip 上出现。

### Step 2: Knowledge 改成白色文档库

Target file: `justime_agent/src/app/knowledge/page.tsx`

Current issue:

- 当前页面直接使用 `JustimeBackground`，文件列表和预览多处沿用白字/深背景。

Implementation:

1. Import:

```tsx
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
```

2. Inside component:

```tsx
const { isDesktop } = useDesktopRuntime()
```

3. Desktop wrapper:

```tsx
const shell = isDesktop ? (
  <JustimePageShell variant="desktop" blur="none" opacity={0} contentClassName="min-h-screen px-6 py-8">
    {/* existing authenticated content goes here with desktop classes */}
  </JustimePageShell>
) : (
  /* existing page */
)
```

4. For desktop file cards use:

```tsx
className="rounded-2xl border border-violet-200/45 bg-white/68 p-4 shadow-[0_18px_60px_rgba(112,77,171,0.10)] backdrop-blur-2xl transition hover:border-violet-300/70 hover:bg-white/84"
```

5. For preview dialog content in desktop mode:

```tsx
className="border-violet-200/50 bg-white/88 text-[#171421] shadow-[0_28px_96px_rgba(112,77,171,0.18)] backdrop-blur-2xl"
```

6. Loading icons:

```tsx
<Loader2 className="h-6 w-6 animate-spin text-violet-500" />
```

Knowledge page character:

- 要像“文档纸张库”，白色面积最大。
- 淡紫只用于边框、预览弹窗背景、选中态和上传按钮。
- Markdown 阅读区域不要半透明过高，正文必须高对比。

### Step 3: Calendar 改成浅紫时间画布

Target file: `justime_agent/src/app/calendar/page.tsx`

Implementation:

1. Import `useDesktopRuntime` and `JustimePageShell`.
2. If desktop, wrap calendar in:

```tsx
<JustimePageShell variant="desktop" blur="none" opacity={0} contentClassName="min-h-screen px-6 py-8">
  <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_320px] gap-5">
    <section className="rounded-3xl border border-violet-200/45 bg-white/68 p-5 shadow-[0_24px_80px_rgba(112,77,171,0.12)] backdrop-blur-2xl">
      {/* existing calendar view */}
    </section>
    <aside className="rounded-3xl border border-violet-200/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(244,237,255,0.78))] p-5 shadow-[0_24px_80px_rgba(112,77,171,0.10)] backdrop-blur-2xl">
      {/* day schedule / event inspector */}
    </aside>
  </div>
</JustimePageShell>
```

3. Calendar event color rules:

- Task event: `bg-violet-100 text-violet-800 border-violet-200`
- Meeting/event: `bg-sky-100 text-sky-800 border-sky-200`
- Personal: `bg-emerald-100 text-emerald-800 border-emerald-200`
- Conflict/error: `bg-rose-100 text-rose-800 border-rose-200`

Calendar page character:

- 要像时间画布，不要像任务看板。
- 主日历底更白，右侧日程详情偏淡紫。
- 当前日期使用紫色 ring，不使用大面积深色高亮。

### Step 4: Admin / Model Config 改成高可读配置台

Target files:

- `justime_agent/src/app/admin/page.tsx`
- `justime_agent/src/app/model-config/page.tsx`

Implementation:

1. Use `JustimePageShell variant="desktop"` only in desktop mode.
2. Tables/forms must use:

```tsx
className="rounded-2xl border border-violet-200/45 bg-white/78 text-[#171421] shadow-[0_18px_60px_rgba(112,77,171,0.10)] backdrop-blur-2xl"
```

3. Form inputs:

```tsx
className="border-violet-200/60 bg-white/76 text-[#171421] placeholder:text-[#8b7aa8] focus-visible:ring-violet-400"
```

4. Primary actions:

```tsx
className="bg-violet-600 text-white shadow-[0_12px_32px_rgba(126,87,194,0.24)] hover:bg-violet-500"
```

5. Dangerous actions:

```tsx
className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
```

Admin/config page character:

- 可读性优先，淡紫只是系统风格，不做强装饰。
- 表格行 hover 用 `bg-violet-50/70`。
- API key、模型 ID 等长文本必须保持清晰，不使用低对比浅紫文字。

### Step 5: Profile / Auth 改成轻量账户面板

Target files:

- `justime_agent/src/app/profile/page.tsx`
- `justime_agent/src/app/login/page.tsx`
- `justime_agent/src/app/reset-password/page.tsx`

Implementation:

1. Desktop profile:

```tsx
<JustimePageShell variant="desktop" blur="none" opacity={0} contentClassName="min-h-screen px-6 py-8">
  <div className="mx-auto max-w-4xl rounded-3xl border border-violet-200/45 bg-white/70 p-6 shadow-[0_24px_80px_rgba(112,77,171,0.12)] backdrop-blur-2xl">
    {/* existing profile content */}
  </div>
</JustimePageShell>
```

2. Auth desktop:

- Use centered glass panel.
- Keep form fields pure white.
- Background can be slightly more purple than dashboard because auth is a focused flow.

```tsx
className="mx-auto w-full max-w-md rounded-3xl border border-violet-200/50 bg-white/74 p-7 shadow-[0_28px_96px_rgba(112,77,171,0.18)] backdrop-blur-2xl"
```

Profile/auth page character:

- Profile 更像设置面板。
- Login/reset 更像独立磨玻璃浮窗。
- 不引入复杂侧栏，不做三栏工作台。

### Step 6: 次级页面测试策略

Create or extend tests only where existing tests already exist. At minimum:

- `DashboardPage`: desktop runtime does not render white-on-dark text.
- `KnowledgeBasePage`: desktop runtime renders upload/rebuild actions with readable text.
- `CalendarPage`: desktop runtime wraps calendar in white/lilac shell.
- `ModelConfigPage`: primary action uses violet desktop class.

Run:

```bash
cd justime_agent
npm test -- --runInBand src/app/dashboard src/app/knowledge src/app/calendar src/app/model-config
```

Expected:

- Existing page tests pass if present.
- If no page tests exist, manually verify with Electron and browser screenshots.

---

## 10. Task 9: 桌面快捷键接入 Chat 页面

**Files:**

- Modify: `justime_agent/src/components/chat/ChatInterface.tsx`
- Modify: `justime_agent/src/app/chat/page.tsx`

### Step 1: 给 `ChatInterface` 暴露 focus input 能力

Current `textareaRef` is internal:

```tsx
const textareaRef = useRef<HTMLTextAreaElement>(null)
```

Add prop:

```tsx
focusSignal?: number
```

In component params:

```tsx
focusSignal = 0,
```

Add effect:

```tsx
useEffect(() => {
  if (!focusSignal) return
  textareaRef.current?.focus()
}, [focusSignal])
```

### Step 2: `chat/page.tsx` 处理 `focus-chat-input`

Add state:

```tsx
const [focusSignal, setFocusSignal] = useState(0)
```

Update command handler:

```tsx
useDesktopCommands((command) => {
  if (command === 'new-chat') {
    setSessionId(null)
  }
  if (command === 'focus-chat-input') {
    setFocusSignal((value) => value + 1)
  }
  if (command === 'open-tasks') {
    window.location.href = '/tasks'
  }
})
```

Pass to desktop and Web ChatInterface:

```tsx
<ChatInterface
  focusSignal={focusSignal}
  ...
/>
```

### Step 3: Test focus behavior

Modify `ChatInterface.test.tsx`:

```tsx
it('focuses input when focusSignal changes', async () => {
  const { rerender } = render(<ChatInterface focusSignal={0} />)

  await waitFor(() => {
    expect(screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')).toBeInTheDocument()
  })

  rerender(<ChatInterface focusSignal={1} />)

  expect(screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')).toHaveFocus()
})
```

Run:

```bash
cd justime_agent
npm test -- --runInBand src/components/chat/__tests__/ChatInterface.test.tsx
```

Expected:

- Focus signal test passes.
- Existing send tests still pass.

---

## 11. Task 10: 可访问性和交互细节检查

**Files:**

- Modify as needed: `ChatHeader.tsx`
- Modify as needed: `ChatInputArea.tsx`
- Modify as needed: `TaskCockpitDesktop.tsx`
- Modify as needed: `TaskDetailWorkbench.tsx`
- Modify as needed: `globals.css`

### Required checks

1. Icon-only buttons must have `title` or `aria-label`.
2. Desktop toolbar buttons must keep visible focus ring.
3. Text inside buttons must not overflow at 1120px width.
4. Scroll containers must use `min-h-0` on grid/flex parents.
5. Top drag region must not include clickable controls. Use `desktop-no-drag` around toolbar.
6. Desktop mode must not render PWA install banner.
7. Web mode must keep current `JustimePageShell` immersive background.
8. Mobile width must still use current Web/PWA layout.

### CSS focus ring rule

Add to `globals.css`:

```css
@layer utilities {
  html[data-justime-runtime="desktop"] .desktop-focus-ring {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white;
  }
}
```

Apply `desktop-focus-ring` to new desktop buttons and links.

### Manual viewport checks

Run app:

```bash
cd justime_agent
npm run dev
```

Open in browser:

- `http://localhost:3000/chat`
- `http://localhost:3000/tasks`
- `http://localhost:3000/tasks/<existing-task-id>`

Then run desktop shell:

```bash
cd apps/desktop
npm run dev
```

Check:

- 1360 x 900: three-column desktop layout fits.
- 1120 x 760: no text overlap, sidebars still usable.
- Fullscreen: content does not stretch into unreadable line lengths.
- Light/dark system changes: desktop mode remains Snow Lilac Glass and does not flip to dark slate.
- Main glass panels remain readable over the pure white to pale lilac gradient.

---

## 12. Task 11: Verification

**Files:** no code changes unless verification finds failures.

### Step 1: Run targeted tests

Run:

```bash
cd justime_agent
npm test -- --runInBand \
  src/hooks/__tests__/useDesktopRuntime.test.ts \
  src/hooks/__tests__/useDesktopCommands.test.ts \
  src/components/chat/__tests__/ChatInterface.test.tsx \
  src/components/chat/__tests__/ChatContextInspector.test.tsx \
  src/components/tasks/__tests__/TaskCockpit.test.tsx \
  src/components/tasks/__tests__/TaskCockpitDesktop.test.tsx \
  src/components/tasks/__tests__/TaskDetailWorkbench.test.tsx
```

Expected:

- All targeted tests pass.

### Step 2: Run full frontend test suite

Run:

```bash
cd justime_agent
npm test -- --runInBand
```

Expected:

- Full Jest suite passes.

### Step 3: Run lint

Run:

```bash
cd justime_agent
npm run lint
```

Expected:

- No new lint errors.

### Step 4: Build frontend

Run:

```bash
cd justime_agent
npm run build
```

Expected:

- Next.js build succeeds.

### Step 5: Run Electron desktop shell

Start frontend:

```bash
cd justime_agent
npm run dev
```

Start desktop shell:

```bash
cd apps/desktop
npm run dev
```

Expected:

- Electron opens Justime.
- `window.justimeDesktop.isDesktop` is true.
- Chat page renders desktop workbench.
- Tasks page renders desktop task cockpit.
- PWA install banner is hidden.
- `Cmd+N` starts new chat.
- `Cmd+L` focuses chat input.
- `Cmd+Shift+T` navigates to `/tasks`.

### Step 6: Package smoke test

Run:

```bash
cd apps/desktop
npm run dist:dmg
```

Expected:

- DMG builds in `apps/desktop/dist/`.
- Packaged app still reads `~/Library/Application Support/Justime/config.json`.
- Packaged app still injects desktop runtime.

---

## 13. Commit Plan

Commit 1:

```bash
git add apps/desktop/src/main.js apps/desktop/src/preload.js apps/desktop/README.md
git commit -m "feat(desktop): expose macos runtime and commands"
```

Commit 2:

```bash
git add justime_agent/src/types/desktop.ts justime_agent/src/hooks/useDesktopRuntime.ts justime_agent/src/hooks/useDesktopCommands.ts justime_agent/src/hooks/__tests__/useDesktopRuntime.test.ts justime_agent/src/hooks/__tests__/useDesktopCommands.test.ts
git commit -m "feat(frontend): add desktop runtime hooks"
```

Commit 3:

```bash
git add justime_agent/src/app/layout.tsx justime_agent/src/app/globals.css justime_agent/src/components/layout/DesktopRuntimeProvider.tsx justime_agent/src/components/layout/DesktopAppFrame.tsx justime_agent/src/components/layout/DesktopCommandBar.tsx justime_agent/src/components/ui/JustimeBackground.tsx justime_agent/src/components/layout/JustimePageShell.tsx justime_agent/src/components/layout/JustimeGlassPanel.tsx justime_agent/src/components/PWAInstallBanner.tsx
git commit -m "feat(ui): add desktop shell styling primitives"
```

Commit 4:

```bash
git add justime_agent/src/app/chat/page.tsx justime_agent/src/components/chat/ChatInterface.tsx justime_agent/src/components/chat/ChatHeader.tsx justime_agent/src/components/chat/ChatSidebar.tsx justime_agent/src/components/chat/MessageList.tsx justime_agent/src/components/chat/ChatInputArea.tsx justime_agent/src/components/chat/ChatContextInspector.tsx justime_agent/src/components/chat/__tests__/ChatInterface.test.tsx justime_agent/src/components/chat/__tests__/ChatContextInspector.test.tsx
git commit -m "feat(chat): add desktop agent workbench"
```

Commit 5:

```bash
git add justime_agent/src/app/tasks/page.tsx justime_agent/src/components/tasks/TaskCockpit.tsx justime_agent/src/components/tasks/TaskCockpitDesktop.tsx justime_agent/src/components/tasks/__tests__/TaskCockpit.test.tsx justime_agent/src/components/tasks/__tests__/TaskCockpitDesktop.test.tsx
git commit -m "feat(tasks): add desktop task cockpit"
```

Commit 6:

```bash
git add 'justime_agent/src/app/tasks/[id]/page.tsx' justime_agent/src/components/tasks/TaskPhaseDetail.tsx justime_agent/src/components/tasks/TaskDetailWorkbench.tsx justime_agent/src/components/tasks/__tests__/TaskDetailWorkbench.test.tsx
git commit -m "feat(tasks): add desktop task detail workbench"
```

Commit 7:

```bash
git add justime_agent/src/app/dashboard/page.tsx justime_agent/src/app/knowledge/page.tsx justime_agent/src/app/calendar/page.tsx justime_agent/src/app/admin/page.tsx justime_agent/src/app/model-config/page.tsx justime_agent/src/app/profile/page.tsx justime_agent/src/app/login/page.tsx justime_agent/src/app/reset-password/page.tsx
git commit -m "feat(ui): apply snow lilac desktop theme to secondary pages"
```

Commit 8:

```bash
git add docs/plans/2026-06-17-macos-desktop-ui-optimization.md
git commit -m "docs: add macos desktop ui optimization plan"
```

---

## 14. Acceptance Criteria

Desktop runtime:

- Electron injects `html[data-justime-runtime="desktop"]`.
- Frontend detects desktop through `useDesktopRuntime`.
- Desktop commands are exposed through a white-listed `onCommand` API.

Chat:

- Web/PWA chat layout remains unchanged.
- Desktop chat uses app frame, left session sidebar, middle chat stream, right context inspector.
- RAG references open in inspector in desktop mode.
- `Cmd+N` starts new chat.
- `Cmd+L` focuses input.

Tasks:

- Web/PWA tasks page remains unchanged.
- Desktop tasks page uses focus queue, phase board, metrics inspector.
- Desktop task detail uses phase rail, work area, evidence/output inspector.

Visual:

- Desktop mode uses Snow Lilac Glass: pure white to pale lilac gradient, white/lilac frosted glass, deep ink text, violet primary actions.
- Desktop mode keeps semantic accents for status: sky information, emerald completion, amber warning, rose destructive/error.
- Desktop mode avoids oversized hero/card composition.
- Desktop mode keeps panels at approximately 10 to 14px radius.
- Text does not overflow at 1120px width.
- Scroll areas work inside Electron window without layout collapse.
- No desktop surface uses dark slate/blue-black backgrounds as its default page background.

Testing:

- New hook tests pass.
- Existing ChatInterface tests pass.
- Existing TaskCockpit tests pass.
- New desktop component tests pass.
- `npm run lint` passes.
- `npm run build` passes.

---

## 15. Rollback Strategy

If desktop UI introduces regression:

1. Keep Electron preload runtime injection because it is low-risk and useful.
2. Disable desktop UI by forcing `useDesktopRuntime()` consumers to ignore `isDesktop`, or temporarily remove desktop branches in `chat/page.tsx`, `tasks/page.tsx`, and `tasks/[id]/page.tsx`.
3. Do not remove shared tokens unless they cause build or style regression.
4. Revert only the specific commit that introduced the failing surface.

Priority rollback order:

- Chat desktop branch
- Task desktop branch
- Task detail desktop branch
- Shell styling primitives
- Electron command bridge

---

## 16. Deferred Work

Do not include in this phase:

- Bundling local FastAPI backend into DMG.
- Local MongoDB/Redis management.
- Native file picker for Vault export.
- Native notifications.
- Global hotkey outside app focus.
- Auto updater.
- Multiple windows.
- Full command palette.
- Separate desktop renderer app.

These can be planned after the desktop workbench proves useful.
