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

## Bundle Metadata

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
