# ADR: Native macOS Migration

## Decision

Choose a phased **SwiftUI/AppKit + WKWebView** native shell for the Justime macOS desktop app. The native shell hosts the existing Next.js web frontend inside a `WKWebView` while progressively exposing native macOS capabilities (file system, notifications, menu bar, window management, signing/notarization, auto-update).

Keep the existing `apps/desktop` Electron shell as a **supported fallback** until the signed native application passes all acceptance gates: auth, SSE streaming, task workspace, signing/notarization, and auto-update.

Explicitly **reject** the following for Phase 1:

- **Full SwiftUI rewrite** — too costly; the web frontend is mature and the team's primary investment. A ground-up rewrite defers delivery by many months with no incremental value.
- **Tauri** — introduces a Rust toolchain dependency and a new WebView runtime (WebKitGTK on Linux / WebView2 on Windows). Tauri's macOS story is viable but its Rust-based plugin model raises the barrier for the existing TypeScript/Python team. Revisit in Phase 3 if cross-platform unification becomes a priority.

## Option Comparison

| Criteria | SwiftUI/AppKit + WKWebView | Tauri | Full SwiftUI Rewrite |
|---|---|---|---|
| Reuse existing web frontend | Full — WKWebView loads the same Next.js app | Full — Tauri WebView loads the same app | None — every screen rebuilt |
| Native API access | Direct Swift/ObjC bridge; no FFI layer | Rust plugins with `tauri::command`; requires writing/maintaining Rust bindings | Direct; idiomatic Swift |
| Signing / notarization | Standard Xcode workflow; Apple-notarized DMG | Supported via `tauri-bundler`; less community precedent on macOS | Standard Xcode workflow |
| Auto-update | Sparkle (industry standard, drop-in) | `tauri-plugin-updater`; less mature macOS support | Sparkle or SPU |
| Team ramp-up | Low — Swift/SwiftUI knowledge sufficient | High — Rust toolchain, new build pipeline | Very high — full reimplementation |
| Incremental delivery | High — native shell first, migrate views later | Medium — plugin architecture required up front | Low — no partial delivery |
| Risk | Low — proven pattern (1Password, Slack, VS Code) | Medium — macOS is a secondary Tauri target | High — timeline + regression risk |

**Verdict:** SwiftUI/AppKit + WKWebView optimises for incremental delivery, team familiarity, and proven macOS patterns.

## Target Architecture

```
Justime.app (native macOS)
├── SwiftUI App Shell
│   ├── Main Window (NSWindow / NSWindowController)
│   │   └── WKWebView
│   │       └── https://<host>/ (Next.js web frontend, same codebase)
│   ├── Menu Bar Extra (NSStatusItem / SwiftUI MenuBarExtra)
│   ├── Preferences Window (SwiftUI)
│   └── About / Update Window
├── Native Bridge Layer (WKScriptMessageHandler)
│   ├── Auth Bridge — inject/extract HttpOnly cookies, biometric unlock
│   ├── File Bridge — local Markdown vault read/write via NSDocument
│   ├── Notification Bridge — UNUserNotificationCenter
│   ├── Shortcut Bridge — global keyboard shortcuts
│   └── Update Bridge — Sparkle integration
├── Embedded FastAPI Launcher (optional, Phase 2+)
│   └── Managed Python process for local-only mode
└── Distribution
    ├── Signed & notarized DMG
    └── Sparkle auto-update feed (appcast.xml)
```

Key architectural decisions:

- **WKWebView as the primary content surface.** The Next.js app runs unmodified. Native features are injected via `WKUserContentController` message handlers and evaluated JavaScript.
- **SwiftUI for chrome only.** Menu bar, preferences, about window, and onboarding are pure SwiftUI. No attempt to replace web views with native views in Phase 1.
- **Bridge protocol is versioned.** A `JustimeBridge` JavaScript namespace is injected into the WKWebView. Native messages use `window.webkit.messageHandlers.<name>.postMessage(...)`. The bridge schema is a formal contract shared between the native shell and web frontend.

## Migration Phases

### Phase 0 — Foundation (current)

- Document architecture decisions (this ADR).
- Define the bridge protocol schema.
- Stand up Xcode project skeleton under `apps/native/`.
- Verify WKWebView loads the existing Next.js build with no regressions.

### Phase 1 — Native Shell MVP

- Auth: cookie injection, biometric unlock. WKWebView persists the backend's existing HttpOnly cookies natively — native code must **not** extract HttpOnly cookie values into plaintext Keychain storage or any other local store.
- SSE: `WKWebView` SSE streaming verified end-to-end with Redis resume.
- Task workspace: local Markdown vault read/write via bridge.
- Notifications: `UNUserNotificationCenter` for task/chat events.
- Signing & notarization: Developer ID certificate, `codesign`, `notarytool`, stapled DMG.
- Auto-update: Sparkle integrated with signed appcast feed.
- Electron fallback remains fully functional.

### Phase 2 — Local Backend & Parity

- Embed Python runtime; launch/manage FastAPI as a child process.
- Local-only mode: app works offline with bundled backend + SQLite/MongoDB Lite.
- Migrate remaining desktop-specific UI to native SwiftUI where it improves UX (e.g., native preferences, native menubar search).
- Deprecation warnings in Electron build.

### Phase 3 — Cross-Platform & Cleanup

- Evaluate Tauri or Windows native shell if Windows demand materialises.
- Remove Electron shell after native app has been stable in production for ≥ 2 releases and rollback is documented.
- Archive `apps/desktop/`.

## Contract Boundaries

The following contracts are **authoritative in the web/FastAPI layer** and must not change as part of this migration:

| Contract | Owner | Scope |
|---|---|---|
| Auth cookie names & JWT structure | `justime_backend/app/api/v1/endpoints/auth.py` | Cookie names (`access_token`, `refresh_token`), HS256 JWT claims, refresh flow |
| Chat/session/task REST endpoints | `justime_backend/app/api/v1/endpoints/chat.py` | All `/api/v1/chat/*` routes, request/response schemas |
| SSE event format | `justime_backend/app/services/sse_stream_service.py` | Event types (`start`, `token`, `metadata`, `usage`, `done`, `error`), `Last-Event-ID` resume |
| Redis resume semantics | `justime_backend/app/services/sse_stream_service.py` | TTL, key format, replay behaviour |
| TaskProcess models | `justime_backend/app/models/` | Pydantic models for chat, tasks, sessions |
| BFF proxy layer | `justime_agent/src/app/api/` | Next.js API routes that proxy to FastAPI |

The native shell **consumes** these contracts via WKWebView. It must not introduce parallel endpoints, modify request/response shapes, or bypass the BFF proxy. Any proposed contract change follows the normal backend change process and is independent of this ADR.

## Electron Fallback Policy

The existing `apps/desktop/` Electron shell is governed by the following policy:

1. **Feature freeze.** No new features are added to the Electron shell. All new desktop work targets the native shell.
2. **Security fixes continue.** Critical security patches (Electron CVEs, dependency updates) are applied until Electron is deleted.
3. **Release fallback.** The Electron shell remains the recommended release for users on macOS < 13 (Ventura) and for any user who encounters a native shell regression. The download page presents both options during Phase 1.
4. **Deletion criteria.** Electron is deleted only when ALL of the following are true:
   - The native signed app has been in production for ≥ 2 release cycles.
   - All acceptance gates (auth, SSE, task workspace, signing/notarization, auto-update) pass on the native app.
   - A rollback runbook exists: the team can re-publish the Electron DMG within 24 hours if a native shell blocker is discovered.
   - User telemetry shows < 5% of macOS desktop sessions on Electron.
5. **Archive, don't delete silently.** When deletion criteria are met, `apps/desktop/` is moved to `docs/archive/apps-desktop-electron/` with a README explaining the history and rollback instructions.

## Native Capability Acceptance Matrix

| Capability | Phase 1 Target | Acceptance Test | Electron Fallback |
|---|---|---|---|
| **Login / Cookie / JWT** | WKWebView persists `access_token` and `refresh_token` HttpOnly cookies natively; biometric unlock for returning users; native code must not extract HttpOnly cookie values into plaintext storage | Login flow completes in native WKWebView; `document.cookie` shows valid `access_token` (HttpOnly flag not accessible to JS but cookie is set by backend); session persists across app restart; no plaintext cookie storage in Keychain | Full Electron support |
| **SSE Stream / Resume** | `WKWebView` receives SSE events; `Last-Event-ID` resume works after network drop | Start a chat stream → disconnect network → reconnect → stream resumes from last event; no duplicate tokens | Full Electron support |
| **Local Markdown Vault** | Native bridge reads/writes `.md` files in user-selected directory | Create, edit, delete a vault note from the web UI; files appear on disk with correct content; no data loss on crash | Not available in Electron |
| **Notifications** | `UNUserNotificationCenter` for chat and task events | Notification appears when chat reply arrives; clicking notification focuses the app; notification permissions prompt shown on first launch | Not available in Electron |
| **Menu Bar** | `MenuBarExtra` with quick actions (new chat, search, preferences) | Menu bar icon visible; actions open correct views; persists across Spaces | Not available in Electron |
| **Global Shortcuts** | Configurable keyboard shortcuts via `NSEvent.addGlobalMonitorForEvents` | Global shortcut opens/focuses the app; configurable in preferences; no conflict with system shortcuts | Limited in Electron |
| **Window Management** | Standard macOS window behaviour (tabs, full screen, Stage Manager) | App works in full screen, Split View, Stage Manager; multiple windows supported | Partial in Electron |
| **Dark Mode** | WKWebView respects system appearance; native chrome uses SwiftUI automatic colours | Toggle system dark mode → web content and native chrome both switch; no flash of wrong theme | Full Electron support |
| **Signing / Notarization** | Developer ID certificate; `codesign` + `notarytool`; stapled DMG | `spctl --assess --type execute Justime.app` returns accepted; DMG opens without Gatekeeper warning | Not production-ready (`hardenedRuntime: false`) |
| **Auto-Update** | Sparkle with signed appcast.xml | New version detected → download → verify signature → install → relaunch; user can defer | Not available in Electron |

## Risks And Rollback

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **WKWebView rendering differences** — subtle CSS/layout differences between WKWebView and Chrome/Electron Chromium | High | Medium | Maintain a visual regression test suite; compare screenshots between Electron and native WKWebView builds |
| **Apple Developer ID certificate expiry or revocation** | Low | Critical | Certificate renewal process documented; team calendar reminder 60 days before expiry; backup certificate enrolled |
| **macOS version fragmentation** — WKWebView features differ across macOS 12/13/14/15 | Medium | Medium | Phase 1 minimum target: macOS 13 (Ventura); CI tests on macOS 13 and latest |
| **SSE instability in WKWebView** — WKWebView may throttle or drop background SSE connections | Medium | High | Implement heartbeat monitoring in the bridge layer; fall back to polling if SSE fails 3 times consecutively; integration tests for SSE resume |
| **Bridge protocol drift** — web frontend and native shell evolve bridge schema independently | Medium | Medium | Bridge schema is a versioned JSON Schema file committed to the repo; CI validates both sides against it |
| **Sparkle update channel compromise** | Low | Critical | Appcast served over HTTPS with EdDSA signatures; update binary verified before install; public key pinned in Info.plist |
| **User confusion during Electron → native transition** | Medium | Low | Migration guide in release notes; first-launch onboarding in native app; both builds available during Phase 1 |
| **Rollback: native app ships with blocking bug** | Low | High | Electron DMG remains downloadable; rollback runbook: re-point download page to Electron DMG, push Electron hotfix if needed, target 24-hour recovery |
