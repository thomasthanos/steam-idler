# Steam Achievement Manager

A modern, desktop Steam Achievement Manager built with **Electron**, **React 18**, and **TypeScript** — inspired by the classic SAM but with a sleek Steam-native dark UI.

![screenshot placeholder](resources/screenshot.png)

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎮 **Game Library** | Browse all your games that support achievements |
| 🏆 **Achievement Manager** | Unlock / lock individual or all achievements |
| 📊 **Game Stats** | View and modify numeric game statistics |
| 👤 **User Profile** | Displays avatar, name, and Steam level from your active session |
| 🌙 **Dark / Light / System Theme** | Respects your OS preference |
| 🔔 **Toast Notifications** | Instant feedback for every action |
| 🔒 **Secure IPC** | Context isolation + no `nodeIntegration` in renderer |

---

## 🛠️ Tech Stack

- **Electron 28** — cross-platform shell
- **React 18 + React Router 6** — renderer SPA
- **TypeScript 5** — end-to-end types
- **TailwindCSS 3 + Framer Motion** — styling & animations
- **steamworks.js** — native Steamworks SDK bindings
- **Vite 5** — renderer bundler (HMR in dev)
- **electron-store** — persistent settings
- **axios** — Steam Web API calls (schema, global %)

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 LTS |
| npm | ≥ 9 |
| Steam | Running & logged in |

### Install

```bash
cd steam-achievement-manager
npm install
```

> **Note:** `steamworks.js` is a native addon and requires Steam to be running before the Electron process starts.

### Development

```bash
# Terminal 1 – compile main process (watch mode)
npm run dev:main

# Terminal 2 – start Vite dev server (renderer, HMR)
npm run dev:renderer

# Terminal 3 – launch Electron (after both above are ready)
npm run electron
```

Or use the convenience script (runs all three concurrently):

```bash
npm run dev
```

### Production Build

```bash
npm run build       # compile main + build renderer
npm run package     # create distributable with electron-builder
```

Output is placed in `release/`.

---

## ⚙️ Configuration

| Setting | Description |
|---|---|
| **Steam API Key** | Optional — enables richer game data. Get yours at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) |
| **Theme** | Dark / Light / System |
| **Confirm bulk actions** | Show a dialog before unlock-all / lock-all |
| **Show global %** | Display how many players have each achievement |
| **Show hidden achievements** | Reveal hidden achievement names & descriptions |
| **Minimize to tray** | Keep the app alive in the system tray |

Settings are stored locally via `electron-store` (no cloud sync).

---

## 📁 Project Structure

```
steam-achievement-manager/
├── src/
│   ├── main/               # Electron main process (Node.js)
│   │   ├── index.ts        # App entry, window creation
│   │   ├── steam/
│   │   │   └── client.ts   # steamworks.js wrapper
│   │   └── ipc/
│   │       └── handlers.ts # All IPC channel registrations
│   ├── preload/
│   │   └── index.ts        # Secure bridge (contextBridge)
│   ├── renderer/           # React SPA (Vite)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/     # TitleBar, Sidebar
│   │   ├── pages/          # Home, Games, Achievements, Settings
│   │   ├── hooks/          # useAppContext, useTheme
│   │   └── styles/
│   │       └── global.css
│   └── shared/
│       └── types.ts        # Shared TypeScript types & IPC channel names
├── resources/              # Icons
├── package.json
├── tsconfig.json           # Renderer tsconfig
├── tsconfig.main.json      # Main process tsconfig (CommonJS)
├── vite.config.ts
├── tailwind.config.js
└── electron-builder.json
```

---

## ⚠️ Disclaimer

Modifying Steam achievements may violate the [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/). Use this tool at your own risk. This project is intended for **personal and educational purposes only** and is not affiliated with or endorsed by Valve Corporation.

---

## 📄 License

MIT
