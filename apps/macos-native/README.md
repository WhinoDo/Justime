# JustimeNative — macOS SwiftUI Shell

Phase 1 app bundle foundation for the Justime macOS native client.

## Status

**Phase 1 foundation is present on `dev`.** The SwiftPM bundle, entitlements, auth bridge, SSE bridge skeleton, release-gates runbook, navigation policy, and menu/shortcuts are merged. Bundle metadata and entitlements remain placeholders for local development; they are not production-signed.

**Phase 2 — Native SwiftUI migration is pending child work.** Phase 2A (typed native API client), 2B (route registry), 2C (Chat and Calendar SwiftUI screens), and 2D (per-screen WKWebView fallback removal) each have their own tracking issues. See `docs/architecture/2026-06-26-macos-native-migration.md` for the full migration lane and acceptance gates.

**WKWebView remains the fallback.** No web screen is removed from WKWebView until its native SwiftUI counterpart passes parity acceptance tests. The Electron shell (`apps/desktop/`) remains the production path until all release gates pass.

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

- **Phase 1 (no secrets)** — local `swift build`, `swift test`, and smoke gates. JUS-498 merge run `29196643876` passed `Swift Build & Test` and `Smoke Test`.
- **Phase 2 (credentialed)** — blocked until the release owner configures and validates the required certificate and notarization secrets. Run `29196643876` failed closed at certificate import; it did not produce a production-signed or notarized artifact.
- **Sparkle release gate** — update feed signing, hosting, and rollback behavior remain blocked pending release-owner configuration and validation.
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

## Code Signing & Notarization

The repo includes scripts for local and CI signing:

| Script | Purpose |
|--------|---------|
| `scripts/build-dmg.sh` | Creates `.app` bundle from SwiftPM binary, signs it, and packages a signed DMG |
| `scripts/codesign.sh` | Signs an existing `.app` bundle with a Developer ID certificate (standalone use) |
| `scripts/notarize.sh` | Submits the DMG for Apple notarization and staples the ticket |

### Local signing

```bash
cd apps/macos-native
swift build -c release
bash scripts/build-dmg.sh --identity "Developer ID Application: Name (TeamID)"
bash scripts/notarize.sh Justime.dmg --apple-id <id> --password <app-pw> --team-id <team>
```

`build-dmg.sh` creates `JustimeNative.app` (a proper `.app` bundle with `Contents/MacOS/`, `Contents/Resources/`, and `Info.plist` from `BundleInfo.plist`), signs it with hardened runtime and entitlements, then packages it into a signed DMG.

`codesign.sh` is available for standalone re-signing of the `.app` bundle without rebuilding the DMG.

All scripts accept `--identity` / credential flags or read from env vars (`CODESIGN_IDENTITY`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).

### CI signing

The `sign-and-notarize` job in `.github/workflows/macos-native.yml` runs on `macos-14` and requires these repository secrets:

- `DEVELOPER_CERTIFICATE_BASE64` — base64-encoded `.p12` Developer ID certificate
- `DEVELOPER_CERTIFICATE_PASSWORD` — password for the `.p12`
- `APPLE_ID` — Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password for notarytool
- `APPLE_TEAM_ID` — 10-character Apple Developer Team ID

Missing or empty secrets must fail closed. Successful non-credentialed build, test, or smoke jobs do not mean that a production-signed, notarized, or releasable DMG exists; use the linked release-gates runbook as the status source.

## Pending (Out of Scope)

- Production Sparkle feed hosting, EdDSA public key/signatures, and rollback validation
- Release-mode entitlements hardening
