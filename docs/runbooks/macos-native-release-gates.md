# macOS Native Release Gates

> **Purpose** — document the gates that must pass before a native macOS build can ship to production.
> This runbook does not change CI, store credentials, or disable the existing Electron fallback.

---

## Fallback Statement

`apps/desktop` Electron remains the **production fallback** until every native release gate in this runbook passes and the release owner approves replacement. No native build may ship to end users until the credentialed release gates below are satisfied.

---

## Phase 1 — Local Build, Test, and Smoke (No Secrets)

These gates verify the native codebase compiles, tests pass, and the app shell functions correctly. They require **no Apple credentials, signing certificates, or CI secrets** and can be run by any developer on a macOS machine with Xcode installed.

### 1.1 Build

```bash
cd apps/macos-native
swift build
```

Must exit 0. Confirms the Swift package resolves dependencies and compiles all targets.

### 1.2 Test

```bash
cd apps/macos-native
swift test
```

Must exit 0 with all tests passing. Covers unit tests for NavigationPolicy, NativeBridge, SSEStreamParser, SessionCookiePolicy, and AppConfig.

### 1.3 Manual Smoke

After building and testing, verify the native shell against a **local** Justime web URL:

1. Launch the native shell app.
2. Confirm it loads the local Justime web URL (default: `http://localhost:3000`).
3. Log in with a test account.
4. Relaunch the app — verify the authenticated session persists.
5. Trigger **New Chat** — confirm a new conversation starts.
6. Trigger **Focus Chat Input** — confirm the input field receives focus.
7. Trigger **Open Tasks** — confirm the task list opens (once merged).

All steps must complete without crash or blank screen.

### 1.4 CI Gate (GitHub Actions)

The `.github/workflows/macos-native.yml` workflow runs `swift build` and `swift test` on a macOS runner. It contains **no signing, notarization, or credential steps**. This provides automated Phase 1 verification on every push and PR.

---

## Phase 2 — Credentialed Release Gates (Pending)

Every item below is **Pending** and represents a release blocker. None of these may be bypassed or silently resolved — each requires explicit owner approval.

### Required Native Release Inputs

Before any native production release can be attempted, all of the following must be resolved and documented:

| # | Input | Status |
|---|-------|--------|
| 1 | **Apple Developer Team ID** — the 10-character team identifier used for signing | Pending |
| 2 | **Developer ID Application certificate** — installed in the build keychain and available to CI | Pending |
| 3 | **Notarization credentials** — App Store Connect API key or Apple ID + app-specific password, stored in CI secrets (not in this repo) | Pending |
| 4 | **Bundle identifier decision** — final `CFBundleIdentifier` (e.g. `com.justime.desktop`) registered in the Apple Developer portal | Pending |
| 5 | **Hardened runtime entitlements** — entitlements plist specifying any exceptions the app requires (e.g. JIT, unsigned memory) | Pending |
| 6 | **Update feed host** — HTTPS endpoint serving a Sparkle-compatible `appcast.xml` (or equivalent) for auto-update | Pending |
| 7 | **Release owner** — named individual responsible for cutting the release and responding to Gate/notarization failures | Pending |

### Signing And Notarization Gate

A native macOS build **cannot proceed to production release** until every item below is passing:

1. **Hardened runtime enabled** — the build is produced with `--hardened-runtime` (Electron: `hardenedRuntime: true` in pack config).
2. **Code signing** — the `.app` bundle is signed with a valid `Developer ID Application` certificate; `codesign --verify --deep --strict` exits 0.
3. **Notarization submission** — the signed artifact is submitted to Apple notarization service (`xcrun notarytool submit` or `altool`) and receives a `status: Accepted` response.
4. **Staple validation** — the notarization ticket is stapled to the artifact (`xcrun stapler staple`) and verified (`xcrun stapler validate` exits 0).
5. **Gatekeeper assessment** — `spctl --assess --type execute` passes on a clean macOS machine without any prior trust override.

If any of the above fails, the build is **not releasable**. Document the failure in the release issue and escalate to the release owner.

### Auto-Update Gate

Auto-update (e.g. via Sparkle) is **not enabled** in production until both conditions below are met:

1. **Signed update feed** — the `appcast.xml` (or equivalent) is served over HTTPS, and each entry's enclosure is signed with the same Developer ID Application certificate used for the build.
2. **Rollback feed behavior** — the update mechanism is documented and tested for rollback: when a new version is pulled, the feed still contains the previous release so affected users can be downgraded or the feed can be reverted.

Until both are verified, auto-update remains disabled and releases are distributed manually.

---

## Smoke Test Matrix

Before any release (Electron or native), the following smoke tests must pass:

| Test | macOS version | Architecture | Pass criteria |
|------|---------------|--------------|---------------|
| App launches without crash | macOS 13 (Ventura) | Apple Silicon | Window appears, main UI renders |
| App launches without crash | macOS 13 (Ventura) | Intel (Rosetta) | Window appears, main UI renders |
| Gatekeeper does not block (native only) | macOS 14 (Sonoma) | Apple Silicon | App opens without "unidentified developer" prompt |
| Core chat flow | macOS 14 (Sonoma) | Any | Send message, receive response |
| Auto-update applies (when gate enabled) | macOS 14+ | Any | Update notification appears, new version installs cleanly |

---

## Rollback

If a native release causes critical regressions:

1. **Disable the update feed** — remove or replace the current `appcast.xml` entry so no further updates are served.
2. **Revert to Electron fallback** — communicate to affected users that they should use the Electron build while the issue is triaged.
3. **File a release incident issue** — document what failed (signing, notarization, runtime crash), which macOS versions were affected, and the remediation plan.

---

## Explicit Non-Actions

This runbook is **documentation only**. The following actions are explicitly out of scope:

- **Do not store credentials** — no Apple Developer certificates, API keys, app-specific passwords, or notarization credentials may be added to this repository.
- **Do not disable the Electron fallback** — the Electron shell (`apps/desktop`) remains the production path until all Phase 2 gates above are satisfied and the release owner approves replacement.
- **Do not add signing or notarization steps to CI** — the `.github/workflows/macos-native.yml` workflow is limited to build and test only.
