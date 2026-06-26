# macOS Native Release Gates

> **Purpose** — document the gates that must pass before a native macOS build can ship to production.
> This runbook does not change CI, store credentials, or disable the existing Electron fallback.

---

## Current Electron Fallback

The current desktop distribution is an Electron shell (`apps/desktop/package.json`) that loads the web app via `BrowserWindow`.
The DMG produced by the existing pack/dmg scripts is **unsigned** and intended for internal smoke-test only.
`hardenedRuntime: false` in `package.json` confirms that no code signing is applied today.
As long as the native release gates below are not satisfied, the Electron fallback remains the production path.

---

## Required Native Release Inputs

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

---

## Signing And Notarization Gate

A native macOS build **cannot proceed to production release** until every item below is passing:

1. **Hardened runtime enabled** — the build is produced with `--hardened-runtime` (Electron: `hardenedRuntime: true` in pack config).
2. **Code signing** — the `.app` bundle is signed with a valid `Developer ID Application` certificate; `codesign --verify --deep --strict` exits 0.
3. **Notarization submission** — the signed artifact is submitted to Apple notarization service (`xcrun notarytool submit` or `altool`) and receives a `status: Accepted` response.
4. **Staple validation** — the notarization ticket is stapled to the artifact (`xcrun stapler staple`) and verified (`xcrun stapler validate` exits 0).
5. **Gatekeeper assessment** — `spctl --assess --type execute` passes on a clean macOS machine without any prior trust override.

If any of the above fails, the build is **not releasable**. Document the failure in the release issue and escalate to the release owner.

---

## Auto-Update Gate

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

This runbook is **documentation only**. The following actions are explicitly out of scope and must not be performed as part of this issue:

- **Do not modify CI workflows** (`.github/workflows/**`) — CI changes require a separate issue with platform-config review.
- **Do not store credentials** — no Apple Developer certificates, API keys, app-specific passwords, or notarization credentials may be added to this repository.
- **Do not disable the Electron fallback** — the Electron shell remains the production path until all gates above are satisfied and verified.
