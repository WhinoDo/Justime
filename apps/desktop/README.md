# Justime Desktop

Minimal Electron shell for packaging Justime as a macOS `.dmg`.

This desktop app does not duplicate or rewrite the existing Next.js/FastAPI code. It loads the configured Justime Web frontend URL in a native macOS window.

## Development

Start the existing services first:

```bash
cd justime_backend
python start.py
```

```bash
cd justime_agent
npm run dev
```

Then run the desktop shell:

```bash
cd apps/desktop
npm install
npm run dev
```

By default the desktop shell loads `http://localhost:3000`. Override it with:

```bash
JUSTIME_DESKTOP_URL=https://your-justime.example.com npm run dev
```

Packaged apps launched from Finder do not inherit terminal environment
variables. For packaged builds, use the app menu:

`Justime` -> `Configure App URL`

This creates or reveals:

`~/Library/Application Support/Justime/config.json`

Example:

```json
{
  "appUrl": "https://your-justime.example.com"
}
```

## Build DMG

```bash
cd apps/desktop
npm install
npm run dist:dmg
```

Output is written to `apps/desktop/dist/`.

## Notes

- The first version expects the backend to be running separately or deployed remotely.
- This avoids bundling Python, MongoDB, and Redis into the DMG.
- A later fully local edition can add process management for FastAPI and a local data store.

## Desktop Runtime

The Electron preload injects:

- `window.justimeDesktop.isDesktop`
- `window.justimeDesktop.platform`
- `window.justimeDesktop.onCommand(callback)`
- `html[data-justime-runtime="desktop"]`

The Next.js app uses these signals to render the desktop workbench UI while keeping one shared business frontend.
