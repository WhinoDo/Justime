# macOS Desktop Shell

The Justime desktop app is an Electron shell at `apps/desktop/` that loads the Next.js frontend in a native macOS window with proper window chrome.

## Quick Start

```bash
# 1. Install desktop dependencies (one-time)
cd apps/desktop && npm install

# 2. Start the Next.js dev server
cd justime_agent && npm run dev

# 3. In another terminal, launch the desktop shell
cd apps/desktop && npm run dev
```

Or from the frontend directory:

```bash
cd justime_agent
npm run desktop:install   # one-time dependency install
npm run desktop:dev        # launches Electron (Next.js dev server must be running)
```

## Native Window Behavior

On macOS the shell provides:

- **Traffic lights** (close/minimize/zoom) positioned at `{ x: 16, y: 18 }` via `titleBarStyle: 'hiddenInset'`
- **Vibrancy** (`under-window` visual effect) for translucent sidebar backgrounds
- **Secure renderer** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`

## Renderer Platform Signal

The preload script exposes `window.justimeDesktop` to the renderer:

| Field | Type | Description |
|-------|------|-------------|
| `isDesktop` | `boolean` | `true` when running in Electron |
| `platform` | `string` | `process.platform` (e.g. `"darwin"`) |
| `isMac` | `boolean` | `process.platform === "darwin"` |
| `versions` | `object` | Chrome, Electron, Node version strings |
| `onCommand` | `function` | Subscribe to IPC commands from the menu |

The preload also sets `data-justime-runtime="desktop"` on `<html>` for CSS-based detection.

## Configuration

Set `JUSTIME_DESKTOP_URL` in `apps/desktop/.env` to point at a deployed frontend instead of localhost. See `apps/desktop/.env.example`.

## Building a .dmg

```bash
cd apps/desktop
npm run dist:dmg
```

Output goes to `apps/desktop/dist/`.

## Architecture

```
apps/desktop/
  src/main.js        — BrowserWindow, menu, IPC, URL policy
  src/preload.js     — contextBridge, runtime injection
  src/url-policy.js  — URL validation (testable module)

justime_agent/
  src/hooks/useDesktopRuntime.ts    — Detect Electron runtime
  src/hooks/useDesktopCommands.ts   — Subscribe to IPC commands
  src/types/desktop.ts              — Desktop bridge types
  src/components/layout/
    DesktopRuntimeProvider.tsx       — Data attribute injection
    DesktopAppFrame.tsx              — Title bar + layout grid
    DesktopCommandBar.tsx            — Toolbar buttons
```

## Integration Note for UI Issue

The desktop shell does NOT implement renderer-side titlebar padding or layout adjustments. That work belongs to the dependent UI adaptation issue, which should consume the `window.justimeDesktop` platform signal and the `data-justime-runtime` CSS hooks exposed by this shell.
