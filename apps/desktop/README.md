# Justime Desktop

Minimal Electron shell for packaging Justime as a macOS `.dmg`.

This desktop app does not duplicate or rewrite the existing Next.js/FastAPI code. It loads the configured Justime Web frontend URL in a native macOS window, injects a desktop runtime API into the renderer, and keeps business logic entirely in the shared `justime_agent` frontend.

## Architecture

```
apps/desktop/            ← Electron shell (macOS only)
  ├── src/main.js        ← BrowserWindow, menu, IPC
  └── src/preload.js     ← contextBridge, runtime injection

justime_agent/           ← Shared business frontend (Next.js)
  ├── src/hooks/useDesktopRuntime.ts   ← Detect Electron runtime
  ├── src/hooks/useDesktopCommands.ts  ← Subscribe to IPC commands
  ├── src/types/desktop.ts             ← Desktop bridge types
  └── src/components/layout/
      ├── DesktopRuntimeProvider.tsx    ← Sets data attributes
      ├── DesktopAppFrame.tsx          ← Title bar + sidebar/inspector grid
      └── DesktopCommandBar.tsx         ← Toolbar button container
```

## Desktop Runtime API

The preload script exposes a single global via `contextBridge.exposeInMainWorld`:

### `window.justimeDesktop`

| Field | Type | Description |
|-------|------|-------------|
| `isDesktop` | `boolean` | Always `true` in Electron |
| `platform` | `string` | `process.platform` (e.g. `"darwin"`) |
| `isMac` | `boolean` | `process.platform === "darwin"` |
| `versions` | `{ chrome?, electron?, node? }` | Runtime version strings |
| `onCommand(callback)` | `(fn: (cmd: string) => void) => () => void` | Subscribe to IPC commands; returns unsubscribe function |

### `onCommand` allowed commands

Only whitelisted commands are forwarded to the renderer:

| Command | Accelerator | Action |
|---------|-------------|--------|
| `new-chat` | `Cmd+N` | Start a new chat session |
| `focus-chat-input` | `Cmd+L` | Focus the chat input textarea |
| `toggle-sidebar` | — | Toggle chat sidebar |
| `open-tasks` | `Cmd+Shift+T` | Navigate to the Tasks page |

### Renderer detection

The preload also sets CSS-accessible attributes on `document.documentElement`:

```html
<html data-justime-runtime="desktop" data-justime-platform="darwin" class="desktop-runtime">
```

The frontend `useDesktopRuntime` hook reads these to detect the Electron environment.

## CSS Hooks

| Selector | Purpose |
|----------|---------|
| `html[data-justime-runtime="desktop"]` | Desktop-only CSS variables and overrides in `globals.css` |
| `.desktop-runtime` | Class-based selector (legacy) |
| `.desktop-drag-region` | `-webkit-app-region: drag` for the title bar |
| `.desktop-no-drag` | `-webkit-app-region: no-drag` for interactive elements in the title bar |
| `.desktop-window-safe-top` | Adds `padding-top: var(--desktop-titlebar-height)` |
| `.desktop-scrollbar` | Thin styled scrollbars for desktop panels |
| `.desktop-glass-surface` | Standard frosted glass panel with `backdrop-filter` |
| `.desktop-lilac-surface` | Lilac-tinted frosted glass panel |
| `.desktop-focus-ring` | Consistent violet focus ring for interactive elements |

## Desktop CSS Variables

Defined under `html[data-justime-runtime="desktop"]` in `globals.css`:

| Variable | Default | Description |
|----------|---------|-------------|
| `--desktop-titlebar-height` | `52px` | Height of the custom title bar |
| `--desktop-sidebar-width` | `286px` | Left sidebar width |
| `--desktop-inspector-width` | `360px` | Right inspector panel width |
| `--desktop-panel-radius` | `12px` | Panel border radius |
| `--desktop-hairline` | `263 38% 82%` | Hairline border color (HSL) |
| `--desktop-glass-bg` | `255 255 255 / 0.68` | Glass surface background |
| `--desktop-glass-strong` | `255 255 255 / 0.84` | Stronger glass background |
| `--desktop-lilac-bg` | `247 242 255 / 0.76` | Lilac glass background |
| `--desktop-lilac-strong` | `238 231 255 / 0.88` | Stronger lilac glass |
| `--desktop-shadow` | `112 77 171 / 0.18` | Default panel shadow |

## Keyboard Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Cmd+N` | New Chat | Chat page |
| `Cmd+L` | Focus chat input | Chat page |
| `Cmd+Shift+T` | Open Tasks | Global |

Shortcuts are registered in the Electron `Menu` via `main.js` and sent to the renderer via `webContents.send('justime-desktop-command', ...)`. The preload `onCommand` whitelist enforces that only allowed commands reach the frontend.

## Security Boundary

| Setting | Value | Rationale |
|---------|-------|-----------|
| `contextIsolation` | `true` | Renderer cannot access Node.js or Electron APIs directly |
| `nodeIntegration` | `false` | No `require()` in the renderer |
| `sandbox` | `true` | Chromium sandbox enabled (safer IPC) |
| `preload` | `src/preload.js` | Only whitelisted IPC commands via `contextBridge` |
| `ipcRenderer.send` | **Not exposed** | Renderer cannot send arbitrary IPC — only `ipcRenderer.on` listener for whitelisted commands |
| External URLs | HTTPS + localhost only | Blocked via `will-navigate` and `setWindowOpenHandler` |

## Development

Start the required services first:

```bash
# Terminal 1: Backend
cd justime_backend
python start.py

# Terminal 2: Web frontend BFF
cd justime_agent
npm run dev
```

Then run the desktop shell:

```bash
cd apps/desktop
npm install        # First time only
npm run dev
```

Open DevTools at startup:

```bash
JUSTIME_DESKTOP_DEVTOOLS=1 npm run dev
```

### Overriding the target URL

```bash
JUSTIME_DESKTOP_URL=https://your-justime.example.com npm run dev
```

Packaged apps launched from Finder do not inherit terminal environment variables. For packaged builds, use the app menu:

`Justime` → `Configure App URL`

This creates or reveals:

`~/Library/Application Support/Justime/config.json`

Example:

```json
{
  "appUrl": "https://your-justime.example.com"
}
```

### Verifying the desktop runtime

After the app loads, open DevTools and run:

```js
window.justimeDesktop.isDesktop      // → true
window.justimeDesktop.platform        // → "darwin"
document.documentElement.dataset.justimeRuntime  // → "desktop"
```

## Build

### Unsigned DMG (smoke test only)

```bash
cd apps/desktop
npm run pack          # Extractable directory (fast)
npm run dist:dmg      # Full DMG
```

Output is written to `apps/desktop/dist/`.

> ⚠️ **Apple signing and notarization credentials not configured.** The current DMG is unsigned and suitable only for local smoke testing. Code signing and notarization setup is a separate task.

### Checking syntax

```bash
node --check src/main.js
node --check src/preload.js
```

## Notes

- The desktop shell expects the backend to be running separately or deployed remotely.
- Bundling Python, MongoDB, and Redis into the DMG is deferred.
- A later fully local edition can add process management for FastAPI and a local data store.
- The frontend uses Snow Lilac Glass visual theme in desktop mode (white-to-lilac gradient, frosted glass panels, deep ink text). Web/PWA retains its existing dark immersive theme.
