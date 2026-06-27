# JustimeNative — macOS SwiftUI Shell

Phase 1 app bundle foundation for the Justime macOS native client.

## Status

**Phase 1 — SwiftPM bundle foundation.** SwiftPM remains the current build and test path. Bundle metadata and entitlements are placeholders for local development; they are not production-signed.

This phase does not include:

- Code signing with a real Apple Developer certificate
- Notarization or stapling
- Auto-update (Sparkle or equivalent)
- Deep linking or URL scheme handling
- Native menu actions

The existing Electron desktop app (`apps/desktop/`) remains the production shell until the native client completes its release gates.

## Build & Test

```bash
cd apps/macos-native
swift build
swift test
swift run   # launches the app directly via SwiftPM
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

| Key | Value | Notes |
|-----|-------|-------|
| `CFBundleIdentifier` | `com.justime.native` | Placeholder; must be updated before signing |
| `CFBundleName` | `Justime` | |
| `CFBundleExecutable` | `JustimeNative` | |
| `CFBundlePackageType` | `APPL` | |
| `LSMinimumSystemVersion` | `13.0` | Matches Package.swift macOS deployment target |

## Entitlements

The sandbox profile is the minimum required for a WKWebView client that connects to `localhost` and HTTPS during development:

- `com.apple.security.app-sandbox` — enabled
- `com.apple.security.network.client` — outbound connections
- `com.apple.security.network.server` — localhost listener

Broad file-access entitlements are intentionally excluded.

## Pending (Out of Scope)

- Apple Developer Team ID and signing certificate configuration
- Notarization credentials and CI integration
- Sparkle framework integration
- Release-mode entitlements hardening
