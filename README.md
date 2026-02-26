# Souvlatzidiko Unlocker

A modern Steam Achievement Manager & Game Idler built with **Electron**, **React 18**, and **TypeScript** — inspired by the classic SAM but with a sleek Steam-native UI, auto-updater, and system tray support.

![screenshot placeholder](resources/screenshot.png)

---

## ✨ Features

| Feature | Details |
|---|---|
| 🏆 **Achievement Manager** | Unlock / lock individual achievements or all at once |
| 📊 **Stats Reset** | Reset numeric game statistics |
| 🎮 **Game Library** | Browse your full Steam library with playtime & achievement progress |
| ⚡ **Game Idler** | Idle any game to accumulate playtime hours |
| 🔄 **Auto-Idle** | Automatically idle a list of games on startup |
| 👤 **User Profile** | Avatar, display name, Steam level, and connection status |
| 🏠 **Dashboard** | Playtime stats, achievement progress, top played games & Steam Store deals |
| 🔍 **Game Search** | Search the Steam Store directly from the app |
| 🌙 **Dark / Light / System Theme** | Respects your OS preference |
| 🔔 **Desktop Notifications** | Instant feedback with optional sound |
| 🗂️ **System Tray** | Minimize to tray, manage idling games from the tray menu |
| 🚀 **Auto-Updater** | Silent background updates via GitHub Releases |
| 🔒 **Secure IPC** | Context isolation, no `nodeIntegration` in renderer |

---

## 🛠️ Tech Stack

| | |
|---|---|
| **Electron 28** | Cross-platform shell |
| **React 18 + React Router 6** | Renderer SPA |
| **TypeScript 5** | End-to-end types |
| **TailwindCSS 3 + Framer Motion** | Styling & animations |
| **steamworks.js** | Native Steamworks SDK bindings |
| **Vite 5** | Renderer bundler (HMR in dev) |
| **electron-store** | Persistent settings & games cache |
| **electron-updater** | Auto-update via GitHub Releases |
| **axios** | Steam Web API calls |

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 LTS |
| npm | ≥ 9 |
| Steam | Running & logged in |

> **Note:** `steamworks.js` is a native addon — Steam must be running before the Electron process starts.

### Install

```bash
cd steam-idler
npm install
```

### Development

```bash
npm run dev
```

Runs all three concurrently: main process (watch), Vite dev server (HMR), and Electron.

### Build & Release

```bash
npm run build     # compile main + build renderer (no installer)
npm run release   # build + create installer with electron-builder
```

Output installer is placed in `release/`.

---

## ⚙️ Settings

| Setting | Description |
|---|---|
| **Steam API Key** | Optional — enables full library fetching. Get yours at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) |
| **Steam ID** | Optional — used alongside API key for library lookup |
| **Custom App IDs** | Manually add game IDs not in your library |
| **Theme** | Dark / Light / System |
| **Show global %** | Display what % of players have each achievement |
| **Show hidden achievements** | Reveal hidden achievement names & descriptions |
| **Confirm bulk actions** | Show a dialog before unlock-all / lock-all |
| **Minimize to tray** | Keep app alive in the system tray on close |
| **Launch on startup** | Start the app automatically with Windows |
| **Notifications** | Enable / disable desktop notifications and sound |
| **Auto-Idle list** | Games to start idling automatically on launch |

Settings are stored locally via `electron-store`. No cloud sync, no telemetry.

---

## 📁 Project Structure

```
steam-idler/
├── src/
│   ├── main/                   # Electron main process (Node.js)
│   │   ├── index.ts            # App entry, window & tray creation, splash flow
│   │   ├── updater.ts          # Auto-updater + splash update/preload flow
│   │   ├── trayIcons.ts        # Tray icon assets (base64)
│   │   ├── steam/
│   │   │   ├── client.ts       # steamworks.js wrapper + games cache
│   │   │   ├── idleManager.ts  # Multi-game idle process manager
│   │   │   ├── worker.ts       # Child process: steamworks worker
│   │   │   └── steamPaths.ts   # Steam install path & ACF file helpers
│   │   └── ipc/
│   │       └── handlers.ts     # All IPC channel registrations
│   ├── preload/
│   │   └── index.ts            # Secure contextBridge API
│   ├── renderer/               # React SPA (Vite)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/         # TitleBar, Sidebar, UpdateBanner, GameImage
│   │   ├── pages/              # Home, Games, Achievements, Settings, Idle, AutoIdle
│   │   ├── hooks/              # useAppContext, useTheme, useUpdater
│   │   └── styles/
│   │       └── global.css
│   └── shared/
│       └── types.ts            # Shared TypeScript types & IPC channel names
├── resources/                  # Icons, splash.html, installer.nsh
├── package.json
├── electron-builder.json
├── tsconfig.json               # Renderer tsconfig
├── tsconfig.main.json          # Main process tsconfig (CommonJS)
├── vite.config.ts
└── tailwind.config.js
```

---

## ⚠️ Disclaimer

Modifying Steam achievements may violate the [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/). Use this tool at your own risk. This project is intended for **personal and educational purposes only** and is not affiliated with or endorsed by Valve Corporation.

---

## 📄 License

MIT
