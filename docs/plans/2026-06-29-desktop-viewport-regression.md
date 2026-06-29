# JUS-496 Desktop Viewport Regression & Container Adaptation Report

**Date**: 2026-06-29
**Branch**: `agent/JUS-496-viewport-regression`
**Base SHA**: `0ac47eecfe8859bea0e184f1be05cc81471ac1b8` (origin/dev)
**Architect Decision**: `apps/macos-native` (Swift/SwiftUI) confirmed as primary desktop container standard (per architect comment on JUS-496, 2026-06-29T09:06:48Z)

---

## 1. Verification Commands

### 1.1 Build

```bash
npm run build
```

**Result**: PASS (exit code 0)

- Compiled with warnings only (jose Edge Runtime warnings, pre-existing lint warnings)
- No build errors
- Static routes `/chat`, `/calendar`, `/dashboard` all generated successfully
- All 19 routes compiled without errors

### 1.2 Focused Tests

```bash
npm test -- --runInBand \
  src/components/layout/__tests__/JushiPageShell.test.tsx \
  src/components/chat/__tests__/ChatInterface.test.tsx \
  src/components/chat/__tests__/ChatSidebar.test.tsx \
  src/components/calendar/__tests__/BigCalendar.test.tsx \
  src/components/calendar/__tests__/DaySchedulePanel.test.tsx \
  src/app/dashboard/__tests__/page.test.tsx
```

**Result**: 5/6 suites found, 59/59 tests PASS (exit code 0)

| Suite | Status |
|-------|--------|
| `src/components/calendar/__tests__/DaySchedulePanel.test.tsx` | PASS |
| `src/components/chat/__tests__/ChatInterface.test.tsx` | PASS |
| `src/components/calendar/__tests__/BigCalendar.test.tsx` | PASS |
| `src/components/chat/__tests__/ChatSidebar.test.tsx` | PASS |
| `src/app/dashboard/__tests__/page.test.tsx` | PASS |
| `src/components/layout/__tests__/JushiPageShell.test.tsx` | **NOT FOUND** — file does not exist on `origin/dev` |

**Note**: `JushiPageShell.test.tsx` is referenced in the issue verification commands but does not exist on `dev`. This is not a blocker; 59/59 existing tests pass.

### 1.3 macOS Native File Search

```bash
find . -maxdepth 5 \
  \( -iname '*.xcodeproj' -o -iname '*.xcworkspace' -o -iname '*.swift' \
     -o -iname '*macos*' -o -iname '*desktop*' \) -print
```

**Result**: No Swift/Xcode/macOS native source found on `origin/dev`.

Files matched by `*desktop*` pattern:

| File | Type |
|------|------|
| `src/types/desktop.ts` | TypeScript type definitions |
| `src/hooks/useDesktopRuntime.ts` | React hook for desktop runtime |
| `src/hooks/useDesktopCommands.ts` | React hook for desktop commands |
| `src/components/tasks/TaskCockpitDesktop.tsx` | Desktop task layout |
| `src/components/layout/DesktopCommandBar.tsx` | Desktop command bar |
| `src/components/layout/DesktopAppFrame.tsx` | Desktop app frame (CSS Grid) |
| `src/components/layout/DesktopRuntimeProvider.tsx` | Desktop runtime context |

No `.swift`, `.xcodeproj`, `.xcworkspace`, or `*macos*` files found. All matches are web frontend code providing desktop-mode layout adaptation. Native SwiftUI/WKWebView container changes are **out of repo scope** for this branch.

---

## 2. Container Scope Conclusion

The architect confirmed `apps/macos-native` (Swift/SwiftUI native client) as the primary desktop container standard. However, **no macOS native source code exists on `origin/dev`**. The web frontend on this branch contains only desktop-mode layout adapters (`DesktopAppFrame`, `DesktopRuntimeProvider`, etc.) that run inside a WebView/browser context.

**Conclusion**: Native container changes are out of repo scope. This regression report covers the **web viewport layer** as rendered in any container (browser, Electron, or WKWebView). Container-specific quirks (WKWebView scroll physics, Electron window chrome, etc.) are not addressed here and would require the native source tree to be on `dev`.

---

## 3. Global Viewport Shell

**File: `src/app/globals.css` (lines 91-103)**

```css
html { height: 100dvh; }
body { min-height: 100dvh; overflow: hidden; }
```

```css
.jushi-app { height: 100vh; height: 100dvh; overflow: hidden; position: relative; }
.local-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
```

- `body { overflow: hidden }` disables document-level scrolling globally.
- `100dvh` with `100vh` fallback uses the standard progressive enhancement pattern.
- `overscroll-behavior: contain` on `.local-scroll` prevents scroll-chaining.

**File: `src/components/layout/MacAppShell.tsx`**

The app shell wraps all non-public routes:

```
<div class="flex flex-col h-screen md:h-[calc(100vh-32px)] overflow-hidden">
  <TitleBar /> <!-- 52px -->
  <div class="flex flex-1 overflow-hidden">
    <MacSidebar />
    <main class="flex-1 overflow-y-auto">  <!-- local scroll container -->
      {children}
    </main>
  </div>
</div>
```

The `<main>` element in `MacAppShell` is the outermost local scroll container for all child routes. On desktop, the shell card uses `h-[calc(100vh-32px)]` to show desktop chrome padding.

---

## 4. Route-by-Route Viewport Evidence

### 4.1 `/chat`

**Shell**: `JustimePageShell fullHeight` + `DesktopAppFrame` (desktop) or `JustimePageShell fullHeight` (mobile)

**Desktop layout** (`DesktopAppFrame.tsx`): CSS Grid `h-screen` with `min-h-0` on all cells. Titlebar (52px), sidebar (286px via `--desktop-sidebar-width`), and content area are all viewport-locked.

**Scroll behavior**:

| Aspect | Result |
|--------|--------|
| Document/body scroll | **Absent** — `body { overflow: hidden }` globally |
| Local scroll region | **MessageList** (`src/components/chat/MessageList.tsx`): `flex-1 overflow-y-auto scroll-smooth` |
| Secondary scroll | **ChatSidebar** session list (`src/components/chat/ChatSidebar.tsx`): `flex-1 overflow-y-auto` |
| Horizontal overflow | **Controlled** — `overflow-hidden` on parent flex containers; `min-w-0` on all flex children |
| Viewport units | `100dvh` (via `.jushi-app` and `html`), `100vh` fallback |

**Pinned elements**: ChatHeader (`sticky top-0 z-40`), ChatInputArea (`shrink-0`) — both stay fixed while MessageList scrolls.

**At 900x600**: MessageList scrolls vertically within its flex-1 allocation. Header and input area remain pinned. No horizontal overflow.

### 4.2 `/calendar`

**Shell**: `JustimePageShell fullHeight` with `contentClassName="h-full flex flex-col overflow-hidden"`

**Layout**: Toolbar (`flex-shrink-0`) + calendar body (`flex-1 min-h-0 overflow-hidden`).

**Scroll behavior**:

| Aspect | Result |
|--------|--------|
| Document/body scroll | **Absent** — `body { overflow: hidden }` globally |
| Local scroll region | **react-big-calendar internal**: `.rbc-time-content` (week/day view), `.rbc-month-view` (month view) |
| DaySchedulePanel | `flex-1 overflow-y-auto` on the 24-hour timeline (`src/components/calendar/DaySchedulePanel.tsx`) |
| Horizontal overflow | **Controlled** — `overflow-hidden` on calendar container; `min-h-0` flex chain |
| Viewport units | `100dvh` (via `.jushi-app`), `100vh` fallback |

**At 900x600**: Calendar fills available space. Internal scroll regions handle content that exceeds the viewport. Page container is locked with `overflow-hidden`.

### 4.3 `/dashboard`

**Desktop shell**: `JustimePageShell fullHeight` with `contentClassName="flex flex-col px-6 py-8 desktop-scrollbar"`

**Mobile shell**: Plain `<div className="min-h-screen bg-background">` (no `JustimePageShell fullHeight`)

**Scroll behavior**:

| Aspect | Result |
|--------|--------|
| Document/body scroll | **Absent** — `body { overflow: hidden }` globally |
| Local scroll (desktop) | **Card grid** (`src/app/dashboard/page.tsx`): `min-h-0 flex-1 overflow-y-auto` |
| Local scroll (mobile) | **No dedicated local scroll** — relies on `MacAppShell`'s `<main class="flex-1 overflow-y-auto">` |
| Horizontal overflow | **Controlled** — `max-w-5xl`/`max-w-6xl` constraints; responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) |
| Viewport units | Desktop: `100dvh` via `.jushi-app`; Mobile: `min-h-screen` (100vh) |

**Pinned elements (desktop)**: Greeting header (`shrink-0`) and footer (`shrink-0`). Card grid scrolls between them.

**At 900x600**: Desktop card grid scrolls vertically. Header and footer remain pinned. Mobile layout scrolls the `MacAppShell` main container.

---

## 5. Cross-Cutting Viewport Patterns

| Pattern | Implementation |
|---------|---------------|
| `100dvh` with `100vh` fallback | `globals.css` on `html`, `.jushi-app`; handles mobile browser chrome correctly |
| `overscroll-behavior: contain` | `.local-scroll` utility class; prevents bounce-scroll chaining |
| Body scroll lock | `body { overflow: hidden }` in `globals.css` |
| Desktop mode | `DesktopAppFrame` CSS Grid with custom properties (`--desktop-titlebar-height: 52px`, `--desktop-sidebar-width: 286px`) |
| Scrollbar theming | Global 6px thin scrollbar; `.desktop-scrollbar` 10px violet tint for desktop mode |
| `min-h-0` flex pattern | Used on all flex/grid children to prevent content overflow |

---

## 6. Remaining Caveats

1. **JushiPageShell.test.tsx missing**: The test file referenced in verification commands does not exist on `dev`. 59/59 existing tests pass.
2. **Native container not tested**: macOS native source (`apps/macos-native/`) is not on `origin/dev`. WKWebView-specific scroll physics, vibrancy effects, and traffic light positioning are not covered.
3. **Dashboard mobile scroll**: `/dashboard` mobile does not use `JustimePageShell fullHeight`; it relies on `MacAppShell`'s `<main>` for scrolling, which is architecturally different from the other two routes. This is functional but inconsistent.
4. **No Playwright/browser verification**: This report is based on static code analysis and build/test output. Visual viewport verification at specific breakpoints (900x600, 1280x720) requires a running dev server and browser, which was not executed in this CI-like context.

---

## 7. Conclusion

| Gate | Result |
|------|--------|
| Build | **PASS** |
| Focused Tests (59) | **PASS** |
| macOS Native Search | **No native source on dev** — native container out of repo scope |
| `/chat` viewport | Document scroll absent; local scroll on MessageList; overflow controlled |
| `/calendar` viewport | Document scroll absent; local scroll via react-big-calendar internals; overflow controlled |
| `/dashboard` viewport | Document scroll absent; local scroll on card grid (desktop) / MacAppShell main (mobile); overflow controlled |

All three routes enforce viewport-locked layouts with local scroll regions. Document/body scrolling is absent. Horizontal overflow is controlled at every level. Native SwiftUI/WKWebView container testing is deferred until the native source tree is available on `dev`.
