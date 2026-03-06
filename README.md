# Souvlatzidiko Unlocker

A modern Steam Achievement Manager & Game Idler built with **Electron**, **React 18**, and **TypeScript**.

---

## ✨ Features

- 🏆 **Achievement Manager** — unlock / lock individual achievements or all at once
- 📊 **Stats Reset** — reset numeric game statistics
- 🎮 **Game Library** — browse your full Steam library with playtime & achievement progress
- ⚡ **Game Idler** — idle any game to accumulate playtime hours
- 🔄 **Auto-Idle** — automatically idle a list of games on startup
- 👁️ **Auto-Invisible** — set Steam status to Invisible while idling, restores on stop
- 🛑 **Game Launch Detection** — stops all idling if you launch a real Steam game
- 🔑 **Steam Account Login** — QR code or `steamLoginSecure` cookie, auto-reconnects on launch
- 🏠 **Dashboard** — playtime stats, top played games, live "Idling Now" widget & Steam Store deals
- 🔍 **Game Search** — search the Steam Store directly from the app
- 🌙 **Dark / Light / System Theme** — respects your OS preference
- 🔔 **Desktop Notifications** — instant feedback with optional sound
- 🗂️ **System Tray** — minimize to tray, manage idling from the tray menu
- 🚀 **Auto-Updater** — silent background updates via GitHub Releases
- 📦 **App Collection** — browse & download companion tools by ThomasThanos

---

## 🛠️ Tech Stack

| | |
|---|---|
| **Electron 28** | Cross-platform shell |
| **React 18 + React Router 6** | Renderer SPA |
| **TypeScript 5** | End-to-end types |
| **TailwindCSS 3 + Framer Motion** | Styling & animations |
| **steamworks.js** | Native Steamworks SDK bindings |
| **steam-user + steam-session** | CM protocol, QR/token auth, game launch events |
| **Vite 5** | Renderer bundler with HMR |
| **electron-store** | Persistent settings & idle stats |
| **electron-updater** | Auto-update via GitHub Releases |
| **axios** | Steam Web API & Store calls |

---

## 🚀 Getting Started

**Prerequisites:** Node.js ≥ 18, npm ≥ 9, Steam running & logged in.

> `steamworks.js` is a native addon — Steam must be running before Electron starts.

```bash
npm install
npm run dev        # development (HMR)
npm run build      # compile only
npm run release    # build + installer (output: release/)
```

---

## ⚙️ Settings

| Setting | Description |
|---|---|
| Steam API Key | Optional — enables full library fetching |
| Steam ID | Optional — used alongside API key |
| Custom App IDs | Manually add game IDs not in your library |
| Theme | Dark / Light / System |
| Show global % | % of players who have each achievement |
| Show hidden achievements | Reveal hidden names & descriptions |
| Confirm bulk actions | Dialog before unlock-all / lock-all |
| Minimize to tray | Keep app alive on close |
| Launch on startup | Start automatically with Windows |
| Notifications | Desktop notifications + sound toggle |
| Auto-Idle list | Games to idle automatically on launch |
| Auto-Invisible when idling | Switch status to Invisible while idling |
| Stop idle on game launch | Stop all idling if a real game is launched |

Settings are stored locally via `electron-store`. No cloud sync, no telemetry.

---

## 🔑 Steam Account (Auto-Invisible)

Optional login to enable automatic status management:

- **QR Code** — scan with the Steam mobile app
- **Cookie** — paste your `steamLoginSecure` cookie (`steamId||<jwt>` format supported)
- Refresh token is saved (base64-obfuscated) and used for auto-reconnect on next launch
- Status changes use the `steam://friends/status/` protocol — no CM traffic, no session conflicts
- Current persona state is read from `localconfig.vdf` before switching to Invisible, then restored on stop

---

## 📁 Project Structure

```
src/
├── main/
│   ├── index.ts            # App entry, window, tray, splash flow
│   ├── updater.ts          # Auto-updater + splash preload
│   ├── store.ts            # electron-store schema
│   ├── trayIcons.ts        # Base64 tray icon assets
│   ├── steam/
│   │   ├── client.ts       # steamworks.js wrapper + games cache
│   │   ├── idleManager.ts  # Multi-game idle process manager
│   │   ├── worker.ts       # Child process: steamworks idle worker
│   │   ├── steamPaths.ts   # Steam install path & VDF helpers
│   │   └── steamUser.ts    # Account manager (QR/cookie login, invisible mode)
│   └── ipc/handlers.ts     # All IPC channel registrations
├── preload/index.ts        # Secure contextBridge API
├── renderer/
│   ├── components/         # TitleBar, Sidebar, UpdateBanner, GameImage, SetupScreen
│   ├── pages/              # Home, Games, Achievements, Settings, Idle, AutoIdle, Portfolio
│   ├── hooks/              # useAppContext, useTheme, useUpdater
│   └── styles/global.css
└── shared/types.ts         # Shared types, IPC channels & default settings
```

---

## ⚠️ Disclaimer

Modifying Steam achievements may violate the [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/). Use at your own risk. Not affiliated with or endorsed by Valve Corporation.

---

## 📄 License

MIT
