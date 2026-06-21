# Justime macOS Desktop Application

This directory contains the Electron-based macOS desktop application scaffolding for Justime.

## Technology Stack

- **Electron** — Cross-platform desktop framework (Chromium + Node.js)
- **electron-builder** — Packaging, code signing, and notarization
- **Next.js Standalone** — The existing Justime frontend runs as an embedded server (sidecar)

## Architecture

The Electron app launches the Next.js application as a child process:

- **Development**: Spawns `next dev`, loads `http://localhost:3456` in a `BrowserWindow`
- **Production**: Runs the pre-built Next.js standalone output (`.next/standalone/server.js`), loads the same URL in a `BrowserWindow`

This approach reuses 100% of the existing Next.js codebase, including:
- All API Routes (BFF proxy layer)
- SSE streaming for AI chat
- PWA service worker (disabled in Electron, but harmless)
- All UI components, themes, and routes

## Directory Structure

```
desktop/
├── electron/
│   ├── main.ts          # Electron main process (entry point)
│   └── preload.ts       # Preload script (context bridge)
├── scripts/
│   └── notarize.mjs     # Notarization placeholder (post-build hook)
├── entitlements.mac.plist # macOS hardened runtime entitlements
├── electron-builder.yml   # electron-builder configuration
└── README.md              # This file
```

## Prerequisites

- macOS (for building and running the .app)
- Node.js 20+
- Xcode Command Line Tools (`xcode-select --install`)
- For production builds: Apple Developer account with code signing certificates

## Development

```bash
# 1. Start the Next.js dev server (in a separate terminal)
npm run dev

# 2. In another terminal, start the Electron app (loads the dev server)
npm run desktop:dev
```

## Production Build

```bash
# Build unsigned DMG for local testing
npm run desktop:build:mac

# Build for Apple Silicon only (faster)
npm run desktop:build:mac:arm64

# Output location: desktop/release/
```

## Production Build (Signed & Notarized)

For distribution-ready builds, set the following environment variables:

```bash
export CSC_LINK="path/to/developer-certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"
export APPLE_ID="developer@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAM123456"

npm run desktop:build:mac
```

The notarization hook (`scripts/notarize.mjs`) automatically submits the signed app to Apple's notary service after a successful build.

## Entitlements

The `entitlements.mac.plist` grants the following permissions:
- **JIT compilation** and **unsigned executable memory** — required by V8/Chromium
- **Network client/server** — for the embedded Next.js server
- **File access** — user-selected read/write
- **Library validation disabled** — required for the Node.js runtime

## Future Enhancements

Planned but out of scope for the scaffold phase:
- Custom title bar with `-webkit-app-region: drag`
- System tray integration
- Global keyboard shortcuts (coordinate with the P1 shortcut system)
- Deep link handling (`justime://`)
- Auto-updater (`electron-updater`)
- Touch Bar support
- Window state persistence
