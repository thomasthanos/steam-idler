# Souvlatzidiko Unlocker

A modern Steam Achievement Manager & Game Idler built with **Electron**, **React 18**, and **TypeScript** — inspired by the classic SAM but with a sleek Steam-native UI, auto-updater, system tray support, and Steam account integration.

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
| 🏠 **Dashboard** | Playtime stats, achievement progress, top played games, Steam Store deals & "Idling Now" live widget |
| 🔍 **Game Search** | Search the Steam Store directly from the app |
| 🌙 **Dark / Light / System Theme** | Respects your OS preference |
| 🔔 **Desktop Notifications** | Instant feedback with optional sound |
| 🗂️ **System Tray** | Minimize to tray, manage idling games from the tray menu |
| 🚀 **Auto-Updater** | Silent background updates via GitHub Releases with splash screen |
| 🔒 **Secure IPC** | Context isolation, no `nodeIntegration` in renderer |
| 👁️ **Auto-Invisible** | Automatically set Steam status to Invisible while idling (via steam:// protocol) |
| 🔑 **Steam Account Login** | Login via QR code scan or `steamLoginSecure` cookie — auto-reconnects on launch |
| 🛑 **Stop Idle on Game Launch** | Detects when you launch a real game and stops all idling automatically |
| 📦 **App Collection** | Download & discover companion tools by ThomasThanos directly from the app |

---

## 🛠️ Tech Stack

| | |
|---|---|
| **Electron 28** | Cross-platform shell |
| **React 18 + React Router 6** | Renderer SPA |
| **TypeScript 5** | End-to-end types |
| **TailwindCSS 3 + Framer Motion** | Styling & animations |
| **steamworks.js** | Native Steamworks SDK bindings |
| **steam-user** | CM protocol — account login, game launch detection |
| **steam-session** | QR code & refresh-token auth |
| **Vite 5** | Renderer bundler (HMR in dev) |
| **electron-store** | Persistent settings & idle stats cache |
| **electron-updater** | Auto-update via GitHub Releases |
| **axios** | Steam Web API & Store calls |
| **qrcode** | QR image generation for Steam mobile login |
| **tree-kill** | Clean process termination for idle workers |

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

Runs all processes concurrently: TypeScript compiler (watch), worker bundle (esbuild watch), Vite dev server (HMR), and Electron.

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
| **Auto-Invisible when idling** | Switch Steam status to Invisible automatically when idling starts |
| **Stop idle on game launch** | Stop all idling if you launch a real Steam game |

Settings are stored locally via `electron-store`. No cloud sync, no telemetry.

---

## 🔑 Steam Account (Auto-Invisible)

The app supports optional Steam account login to enable automatic status management:

- **QR Code login** — scan with the Steam mobile app
- **Cookie login** — paste your `steamLoginSecure` cookie value (supports `steamId||<jwt>` format)
- **Auto-reconnect** — refresh token is saved (base64-obfuscated) and used on next launch
- **Invisible while idling** — reads your current persona state from `localconfig.vdf` before changing it, then restores it when idling stops
- Status changes use the `steam://friends/status/` protocol — no CM traffic, no session conflicts

> **Note:** The Steam account session (via steam-user) runs separately from the Steamworks SDK used for achievements. A `LoggedInElsewhere` disconnect is handled gracefully and does not affect idling.

---

## 📁 Project Structure

```
steam-idler/
├── src/
│   ├── main/                   # Electron main process (Node.js)
│   │   ├── index.ts            # App entry, window & tray creation, splash flow
│   │   ├── updater.ts          # Auto-updater + splash update/preload flow
│   │   ├── store.ts            # electron-store schema (settings, idleStats)
│   │   ├── trayIcons.ts        # Tray icon assets (base64 encoded)
│   │   ├── steam/
│   │   │   ├── client.ts       # steamworks.js wrapper + games cache
│   │   │   ├── idleManager.ts  # Multi-game idle process manager
│   │   │   ├── worker.ts       # Child process: steamworks idle worker
│   │   │   ├── steamPaths.ts   # Steam install path & ACF/VDF file helpers
│   │   │   └── steamUser.ts    # Steam account manager (QR/cookie login, invisible mode)
│   │   └── ipc/
│   │       └── handlers.ts     # All IPC channel registrations
│   ├── preload/
│   │   └── index.ts            # Secure contextBridge API
│   ├── renderer/               # React SPA (Vite)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/         # TitleBar, Sidebar, UpdateBanner, GameImage, SetupScreen, ErrorBoundary
│   │   ├── pages/              # Home, Games, Achievements, Settings, Idle, AutoIdle, Portfolio
│   │   ├── hooks/              # useAppContext, useTheme, useUpdater
│   │   └── styles/
│   │       └── global.css
│   └── shared/
│       └── types.ts            # Shared TypeScript types, IPC channel names & default settings
├── resources/                  # Icons, splash.html, installer.nsh
├── package.json
├── electron-builder.json
├── tsconfig.json               # Renderer tsconfig
├── tsconfig.main.json          # Main process tsconfig (CommonJS)
├── vite.config.ts
└── tailwind.config.js
```

---

## 📦 App Collection (Portfolio Page)

The built-in **App Collection** page lets you browse and download companion apps by ThomasThanos:

| App | Description |
|---|---|
| **Make Your Life Easier** | Password manager, system tools, notes & quick actions |
| **GitHub Build & Release** | GUI for build automation and GitHub release management |
| **Backup Projects** | Incremental backups with AES-256 encryption & cloud storage |
| **Discord Package Viewer** | Visualize your Discord data package with interactive analytics |

Downloads are fetched directly from GitHub Releases and saved to your Downloads folder. Progress is shown in real time.

---

## ⚠️ Disclaimer

Modifying Steam achievements may violate the [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/). Use this tool at your own risk. This project is intended for **personal and educational purposes only** and is not affiliated with or endorsed by Valve Corporation.

---

## 📄 License

MIT
