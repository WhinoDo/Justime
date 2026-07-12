# macOS Native Release Gates

> **Purpose** — document the gates that must pass before a native macOS build can ship to production.
> This runbook does not change CI, store credentials, or disable the existing Electron fallback.

---

## Fallback Statement

`apps/desktop` Electron remains the **production fallback** until every native release gate in this runbook passes and the release owner approves replacement. No native build may ship to end users until the credentialed release gates below are satisfied.

---

## Phase 1 — Local Build, Test, and Smoke (No Secrets)

These gates verify the native codebase compiles, tests pass, and the app shell functions correctly. They require **no Apple credentials, signing certificates, or CI secrets** and can be run by any developer on a macOS machine with Xcode installed.

### JUS-498 Evidence Snapshot

The JUS-498 release-gate implementation was reviewed at commit `fad1e33e57c0b086c756abbf32ddbe63bc29ae69` and merged to `dev` as `d290cd73fe2611e62ac6c45a8a7fb112b6cfcc96`.

GitHub Actions run [`29196643876`](https://github.com/WhinoDo/Justime/actions/runs/29196643876) executed against merge SHA `d290cd73fe2611e62ac6c45a8a7fb112b6cfcc96` with these results:

| Job | Result | Release meaning |
|-----|--------|-----------------|
| `Swift Build & Test` | Passed | The non-credentialed Swift build and test gate passed. |
| `Smoke Test` | Passed | The non-credentialed automated smoke gate passed. |
| `Sign, Notarize & Package DMG` | Failed at `Import certificate into keychain` | The credentialed release gate remains blocked. The log showed empty `DEVELOPER_CERTIFICATE_BASE64` and `DEVELOPER_CERTIFICATE_PASSWORD`; signed DMG creation, notarization, and upload were skipped. |

This evidence establishes only the non-credentialed gates. It does **not** establish that the app is production-signed, notarized, stapled, Gatekeeper-approved, or releasable.

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

The `.github/workflows/macos-native.yml` workflow runs `Swift Build & Test` and `Smoke Test` as non-credentialed jobs on a macOS runner. These jobs do not consume Apple credentials and provide automated Phase 1 verification on relevant pushes and pull requests. On pushes, the separate downstream `Sign, Notarize & Package DMG` job is the credentialed Phase 2 gate and must not be counted as part of the Phase 1 result.

---

## Phase 2 — Credentialed Release Gates (Blocked)

Every item below is **Blocked** until the release owner configures and validates real release inputs. None of these may be bypassed or silently resolved. Missing or empty credentials must fail closed, and a non-credentialed gate result must never be used to assert a production release.

### Required Credentialed CI Inputs

The `sign-and-notarize` job requires all five repository secrets below. Secret values must be configured by the release owner in GitHub and must never be committed, copied into issue comments, or printed in logs.

| Input | Used for | Current evidence |
|-------|----------|------------------|
| `DEVELOPER_CERTIFICATE_BASE64` | Base64-encoded Developer ID Application `.p12` certificate imported into the CI keychain | **Blocked:** empty in run `29196643876`; certificate import failed. |
| `DEVELOPER_CERTIFICATE_PASSWORD` | Password for the Developer ID `.p12` certificate | **Blocked:** empty in run `29196643876`; certificate import failed. |
| `APPLE_ID` | Apple Developer account used by `notarytool` | **Blocked:** notarization did not run after certificate import failed; a real value has not been validated by this run. |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password used by `notarytool` | **Blocked:** notarization did not run after certificate import failed; a real value has not been validated by this run. |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID used by `notarytool` | **Blocked:** notarization did not run after certificate import failed; a real value has not been validated by this run. |

After certificate import, the workflow derives `CODESIGN_IDENTITY` from the imported Developer ID certificate. If no valid identity is available, `scripts/build-dmg.sh` and `scripts/codesign.sh` exit non-zero. If any notarization input is missing, `scripts/notarize.sh` exits non-zero. This fail-closed behavior is required and must not be weakened.

### Required Native Release Decisions

Before any native production release can be attempted, all of the following must be resolved and documented:

| # | Input | Status |
|---|-------|--------|
| 1 | **Apple Developer Team ID** — the 10-character team identifier used for signing | Blocked |
| 2 | **Developer ID Application certificate** — installed in the build keychain and available to CI | Blocked |
| 3 | **Notarization credentials** — Apple ID + app-specific password for the current scripts, stored in CI secrets (not in this repo) | Blocked |
| 4 | **Bundle identifier decision** — final `CFBundleIdentifier` registered in the Apple Developer portal | Blocked |
| 5 | **Hardened runtime entitlements** — release entitlements reviewed for the app's required capabilities | Blocked |
| 6 | **Sparkle EdDSA signing key** — private update-signing key stored outside the repo; matching public key replaces the `SUPublicEDKey` placeholder | Blocked |
| 7 | **Update feed host and signed entries** — production HTTPS endpoint serving an `appcast.xml` whose enclosure signatures and artifact metadata are real, not placeholders | Blocked |
| 8 | **Release owner** — named individual responsible for cutting the release and responding to gate/notarization failures | Blocked |

### Signing And Notarization Gate

A native macOS build **cannot proceed to production release** until every item below is passing:

1. **Hardened runtime enabled** — the build is produced with `--hardened-runtime` (Electron: `hardenedRuntime: true` in pack config).
2. **Code signing** — the `.app` bundle is signed with a valid `Developer ID Application` certificate; `codesign --verify --deep --strict` exits 0.
3. **Notarization submission** — the signed artifact is submitted to Apple notarization service (`xcrun notarytool submit` or `altool`) and receives a `status: Accepted` response.
4. **Staple validation** — the notarization ticket is stapled to the artifact (`xcrun stapler staple`) and verified (`xcrun stapler validate` exits 0).
5. **Gatekeeper assessment** — `spctl --assess --type execute` passes on a clean macOS machine without any prior trust override.

If any of the above fails, the build is **not releasable**. Document the failure in the release issue and escalate to the release owner.

For the JUS-498 merge evidence, certificate import, code signing, DMG signing, notarization, stapling, and Gatekeeper assessment are all still blocked. No production release status may be inferred from the successful build, test, or smoke jobs.

### Auto-Update Gate

Auto-update via Sparkle is **not enabled** in production until all conditions below are met:

1. **Production EdDSA key configured** — the private Sparkle signing key is protected outside the repository, and its public key replaces the `REPLACE_WITH_EDDSA_PUBLIC_KEY` placeholder in `BundleInfo.plist`.
2. **Signed update feed** — the `appcast.xml` is served over HTTPS, each enclosure has a real Sparkle EdDSA signature, and no placeholder signature or zero-length artifact metadata remains.
3. **Rollback feed behavior** — the update mechanism is documented and tested for rollback: when a new version is pulled, the feed still contains the previous release so affected users can be downgraded or the feed can be reverted.

Until all three are verified, auto-update remains disabled and releases are distributed manually.

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
- **Do not change signing or notarization behavior through this runbook** — the existing `.github/workflows/macos-native.yml` credentialed job and `apps/macos-native/scripts/` remain authoritative and fail closed when required inputs are absent.
