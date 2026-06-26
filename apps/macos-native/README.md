# JustimeNative — macOS SwiftUI Shell Spike

This is a **non-production spike** that wraps the existing Justime Web URL in a native macOS SwiftUI app using `WKWebView`.

## Purpose

- Proves a native macOS app can compile and load the Justime Web URL without changing any Web or backend code.
- Establishes the `apps/macos-native/` package layout for future native development.

## Status

**Spike only.** The existing Electron desktop app (`apps/desktop/`) remains the supported shell. This spike does not include:

- Code signing or notarization
- Auto-update (Sparkle or equivalent)
- Deep linking or URL scheme handling
- Native menu actions (menu items are disabled placeholders)
- Any Web ↔ native bridge calls

## Build & Test

```bash
cd apps/macos-native
swift build
swift test
```

Requires macOS 13+ and Swift 5.9+ (Xcode 15+).

## Local Smoke Test

After building and testing, launch the native shell and verify:

1. App loads the local Justime web URL (default: `http://localhost:3000`).
2. Log in with a test account, relaunch — session persists.
3. Trigger **New Chat**, **Focus Chat Input**, and **Open Tasks** — all respond without crash.

## Release Gates

See [`docs/runbooks/macos-native-release-gates.md`](../../docs/runbooks/macos-native-release-gates.md) for the full release gate plan:

- **Phase 1 (no secrets)** — local `swift build`, `swift test`, and manual smoke. These can run today.
- **Phase 2 (credentialed)** — signing, notarization, Sparkle update feed, Gatekeeper. All are Pending.
- **Fallback** — `apps/desktop` Electron remains the production path until all Phase 2 gates pass.

## URL Resolution

The app resolves the target URL from environment variables in this order:

1. `JUSTIME_NATIVE_APP_URL`
2. `JUSTIME_DESKTOP_URL`
3. `NEXT_PUBLIC_APP_URL`
4. Default: `http://localhost:3000`

HTTPS URLs are always allowed. HTTP is restricted to `localhost`, `127.0.0.1`, and `[::1]`.
