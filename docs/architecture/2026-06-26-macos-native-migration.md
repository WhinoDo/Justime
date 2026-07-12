# ADR: Native macOS Migration

## Decision

Choose a phased **SwiftUI/AppKit + WKWebView** native shell for the Justime macOS desktop app. The native shell hosts the existing Next.js web frontend inside a `WKWebView` while progressively exposing native macOS capabilities (file system, notifications, menu bar, window management, signing/notarization, auto-update).

Keep the existing `apps/desktop` Electron shell as a **supported fallback** until the signed native application passes all acceptance gates: auth, SSE streaming, task workspace, signing/notarization, and auto-update.

Explicitly **reject** the following for Phase 1:

- **Full SwiftUI rewrite** — too costly; the web frontend is mature and the team's primary investment. A ground-up rewrite defers delivery by many months with no incremental value.
- **Tauri** — introduces a Rust toolchain dependency and a new WebView runtime (WebKitGTK on Linux / WebView2 on Windows). Tauri's macOS story is viable but its Rust-based plugin model raises the barrier for the existing TypeScript/Python team. Revisit in Phase 3 if cross-platform unification becomes a priority.

For Phase 2, adopt an **incremental screen-by-screen SwiftUI replacement** strategy:

- Migrate individual screens from WKWebView to native SwiftUI one capability at a time, starting with Chat and Calendar.
- Keep WKWebView as an in-app fallback for all screens until each migrated SwiftUI screen passes its parity acceptance gates.
- Keep the Electron shell as a production fallback until release gates and production stability gates pass across all migrated screens.
- Do **not** attempt a wholesale SwiftUI rewrite; each screen migrates independently with its own parity criteria.

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

### Phase 2 — Local Backend & Native SwiftUI Migration

Phase 2 has two parallel workstreams: local backend embedding and the native SwiftUI migration lane. The migration lane replaces web screens with native SwiftUI screens incrementally, using WKWebView as an in-app fallback until each screen passes parity.

#### Native SwiftUI Migration Lane

Each sub-phase is a self-contained deliverable with its own acceptance gates. A sub-phase is not started until its predecessor gates pass.

| Sub-phase | Scope | Exit criteria |
|---|---|---|
| **2A — Typed Native API Client** | Build a Swift `JustimeAPI` client that calls FastAPI `/api/v1/*` endpoints directly (auth, chat, calendar, knowledge). The client uses `URLSession` with cookie-based auth and typed request/response models matching the Pydantic schemas. | Client compiles; unit tests pass against mock server; auth flow (login → refresh → authenticated call) works end-to-end. |
| **2B — Native Route Registry** | Introduce a `NativeRouteRegistry` that decides per-route whether to render a SwiftUI screen or fall back to WKWebView. Routes are registered with a priority and capability flag. The registry exposes a single `View(for: URL)` resolution used by the main window. | Registry correctly selects SwiftUI for migrated routes and WKWebView for all others; adding a new SwiftUI screen requires only one registry entry. |
| **2C — Chat & Calendar MVP Screens** | Build native SwiftUI screens for Chat (message list, input, SSE streaming) and Calendar (event list, day/week views, CRUD). These screens call the typed native API client (2A) and are registered in the route registry (2B). | Chat: send message → receive SSE stream → display tokens → persist session. Calendar: create/edit/delete event → list refreshes → day/week views render. Both screens pass the same acceptance tests as the WKWebView versions. |
| **2D — WKWebView Fallback Removal per Screen** | Remove WKWebView fallback for a specific screen only when that screen has passed parity acceptance tests and has been stable in pre-release testing for ≥ 1 release cycle. Rollback criteria: if a SwiftUI screen fails in production, re-enable WKWebView fallback for that screen within one release. | Per-screen removal is gated on: parity acceptance pass, ≥ 1 release-cycle stability, rollback runbook updated. WKWebView is never fully removed until all screens are migrated. |

#### Routing Contract: SwiftUI vs WKWebView

The routing contract for native screens is:

- **Migrated SwiftUI screens** call FastAPI `/api/v1/*` through the typed native `JustimeAPI` client built in Phase 2A. They do **not** load the Next.js app or use the BFF proxy.
- **Non-migrated screens** continue to run inside WKWebView, loading the existing Next.js app and routing API calls through the BFF proxy as before.
- **No screen is removed from WKWebView** until it has a registered SwiftUI counterpart in the `NativeRouteRegistry` (Phase 2B) that passes all parity acceptance tests.

#### Authoritative Chat and Calendar Route Ownership

The production owner for both Chat and Calendar is the Web implementation rendered through the native shell's WKWebView. `NativeScreenRegistry` therefore resolves `.chat` to `.webFallback(path: "/chat")` and `.calendar` to `.webFallback(path: "/calendar")`. Existing native SwiftUI views, models, or services are parity candidates only; their presence does not grant route ownership and they must not be activated implicitly.

| Route | Current production owner | Native candidate status |
|---|---|---|
| Chat (`/chat`) | WKWebView `webFallback` | Default off; not eligible to become primary until the Chat gates below pass and a separate promotion issue is approved. |
| Calendar (`/calendar`) | WKWebView `webFallback` | Default off; not eligible to become primary until the Calendar gates below pass and a separate promotion issue is approved. |

Promotion is decided independently per route. Chat parity does not promote Calendar, and Calendar parity does not promote Chat. The future promotion issue must attach evidence for every applicable gate:

| Gate | Required evidence before promotion |
|---|---|
| **Auth and session** | Automated tests cover login, refresh, logout, expired credentials, and app restart for the candidate route with 100% pass rate; cookie names, expiry handling, and user identity match the Web route. |
| **API and BFF equivalence** | Contract tests exercise every endpoint and request/response field used by the Web route, including validation and authorization failures, with no undocumented native-only endpoint or schema. Any intentional direct FastAPI use must prove response and error-semantic parity with the Web/BFF flow. |
| **SSE reconnect (Chat)** | Deterministic tests inject a disconnect after `start`, during `token`, and before `done`; each case resumes from `Last-Event-ID` with no missing or duplicate token and preserves the session. Calendar records this gate as not applicable. |
| **Accessibility** | Keyboard-only navigation completes every primary workflow; VoiceOver announces controls, labels, focus changes, errors, and streamed Chat updates; the accessibility audit has zero critical or high-severity findings. |
| **Offline and error handling** | Tests cover startup offline, mid-request loss, timeout, 401/403, 429, and 5xx responses; the candidate shows a recoverable state, does not lose confirmed user data, and succeeds after retry or re-authentication. |
| **Telemetry** | Route entry, selected implementation, success, fallback, error class, latency, and rollback-switch state are emitted for 100% of parity scenarios without message content, calendar content, credentials, or tokens. Dashboards distinguish Web and native outcomes for the route. |
| **Build and signing** | The exact promotion HEAD passes Swift build, unit/integration tests, warning-as-error checks, smoke tests, and all non-credentialed macOS CI jobs. The signed release candidate passes `codesign` verification, notarization, and Gatekeeper assessment before production rollout. |
| **Rollback readiness** | An automated test proves that setting the route's rollout switch to off resolves the next route entry to the original WKWebView path without data migration or app reinstall. The runbook names the owner, command/configuration change, verification query, and communication steps. |

Promotion requires a new, independently reviewed code issue. That issue must introduce or use a route-scoped rollout switch evaluated by `NativeScreenRegistry`; the native value is default off and the off state resolves to the existing `webFallback` path. The issue must identify the exact candidate HEAD, gate evidence, telemetry dashboard, rollback runbook, and release owner. It must not remove or rename the Web route.

Rollout proceeds in this fixed order for each route:

1. Keep native default off in production and enable it only for internal/pre-release users after all parity gates pass.
2. Complete one full pre-release cycle with no unresolved critical or high-severity route defect, no authentication/session data loss, and no rollback trigger below.
3. Make native primary only in a subsequent reviewed release change. Keep the route switch and WKWebView path available for at least one additional production release cycle.
4. Disable native immediately if any authentication/session data loss occurs, the route cannot complete its primary workflow, the native crash/error rate exceeds the Web baseline by more than 1 percentage point over at least 100 route entries, or the rollback owner declares a release blocker. The switch returns ownership to `webFallback`; remediation and re-promotion require another reviewed issue.

Rejected routing options:

- **Implicit native activation.** Adding a SwiftUI view, service, test, or registry capability must never change the production owner without the promotion issue and rollout switch.
- **Permanent dual-primary routing.** A route has exactly one production owner for a given rollout-switch state; Web and native must not both claim primary ownership or make nondeterministic ownership decisions.
- **Removing fallback before parity.** The WKWebView path must remain intact through parity validation, staged rollout, and the required rollback window.

#### Local Backend Embedding

- Embed Python runtime; launch/manage FastAPI as a child process.
- Local-only mode: app works offline with bundled backend + SQLite/MongoDB Lite.
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

The current production routes **consume** these contracts through WKWebView and the BFF proxy. A separately promoted native route may consume the same FastAPI contracts through the typed `JustimeAPI` client only after proving the API/BFF equivalence gate above. Neither path may introduce parallel endpoints or modify request/response shapes. Any proposed contract change follows the normal backend change process and is independent of this ADR.

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
| **Chat (native SwiftUI parity)** | Native SwiftUI Chat screen (Phase 2C): message list, text input, SSE streaming via `JustimeAPI` typed client; per-route registry entry in `NativeRouteRegistry` | Send a message → SSE stream returns tokens → message list renders incrementally; session persists across app restart; parity with WKWebView Chat on all acceptance tests | WKWebView fallback via `NativeRouteRegistry` until parity pass; Electron fallback until Phase 3 deletion |
| **Calendar (native SwiftUI parity)** | Native SwiftUI Calendar screen (Phase 2C): day/week views, event CRUD via `JustimeAPI` typed client; per-route registry entry in `NativeRouteRegistry` | Create/edit/delete event → calendar refreshes; day and week views render correctly; parity with WKWebView Calendar on all acceptance tests | WKWebView fallback via `NativeRouteRegistry` until parity pass; Electron fallback until Phase 3 deletion |

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
