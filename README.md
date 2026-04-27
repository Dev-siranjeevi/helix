# Helix — ARINC 424 File Monitor

Desktop tool for decoding, inspecting and diffing CIFP procedure files.

## Requirements

- **Node.js ≥ 20.19** (check: `node --version`)
- **Windows x64** (packaging target; dev runs on any OS)

## Quick start — development

```bash
npm install
npm run dev
```

This starts the Vite dev server on port 5173 and launches Electron via electronmon.
Changes to `electron/` restart Electron automatically.
Changes to `src/` require a manual Electron restart (HMR is disabled in Electron's sandbox).

## Build — production installer

```bash
npm run dist
```

Output: `release/Helix-Setup-1.0.0.exe`

## Build — unpacked folder (faster, no installer)

```bash
npm run dist:dir
```

Output: `release/win-unpacked/Helix.exe` — run directly, no install needed.

## Project structure

```
helix-desktop/
├── electron/                 Main process
│   ├── main.js               Entry — window, IPC, watcher
│   ├── preload.js            contextBridge API surface
│   ├── store.js              electron-store wrapper
│   ├── fileProcessor.js      statFile + openFile (decode on demand)
│   ├── decoders/
│   │   ├── constants.js      ARINC 424 column offsets
│   │   ├── procedureDecoder.js
│   │   └── additional/
│   │       └── procedureContributor.js  Waypoint/runway/navaid parsers
│   └── processors/
│       ├── merger.js         SAV merge
│       ├── validator.js      Post-decode validation
│       └── comparator.js     File diff engine
├── src/                      Renderer (React + Vite)
│   ├── App.jsx               Root — state, routing, watcher wiring
│   ├── index.css             Design system + component styles
│   ├── pages/                FilesPage, Compare, GuidePage, SettingsPage
│   ├── components/
│   │   ├── tables/           HeaderTable, ProcedureTable, WaypointTable, NavaidsTable
│   │   └── compare/          CompareHeaderTable, CompareLegTable, etc.
│   ├── hooks/                useStore, useElectron
│   └── context/              ThemeContext
├── build/icons/              Application icons
├── index.html
├── vite.config.js
└── package.json
```

## Notes

- **electron-store is pinned to v8** — v9+ is ESM-only and breaks CommonJS.
- **HMR is always disabled** — Electron's renderer sandbox blocks the WebSocket connection Vite uses for hot-reload. Restart `npm run dev` to pick up src/ changes.
- Files named `*resort*.ari` and all `.sav` files are excluded from the sidebar (processed silently as patches).
