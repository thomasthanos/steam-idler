<div align="center">

<img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/banner.svg?v=980" alt="Souvlatzidiko Unlocker">

[![React 18](https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/badge-react.svg?v=1)](#)
[![TypeScript](https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/badge-ts.svg?v=1)](#)
[![Electron](https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/badge-electron.svg?v=1)](#)
[![Proprietary License](https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/badge-license.svg?v=1)](#-license)

<br>

A modern Steam Achievement Manager & Game Idler built with **Electron**, **React 18**, and **TypeScript**. 
For the achievements you earned emotionally but never quite managed technically.

<br>

<img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/divider.svg?v=1" alt="Divider">

</div>

## <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/icon-gamepad.svg?v=1" width="24" align="middle"> Features

- 🏆 **Achievement Manager** - unlock / lock individual achievements or all at once
- 🔄 **Stats Reset** - reset numeric game statistics
- 📚 **Game Library** - browse your full Steam library with playtime & achievement progress
- 🎮 **Game Idler** - idle any game to accumulate playtime hours
- ⚡ **Auto-Idle** - automatically idle a list of games on startup
- 👻 **Auto-Invisible** - set Steam status to Invisible while idling, restores on stop
- 🛑 **Game Launch Detection** - stops all idling if you launch a real Steam game
- 🔐 **Steam Account Login** - QR code or `steamLoginSecure` cookie, auto-reconnects on launch
- 📊 **Dashboard** - playtime stats, top played games, live "Idling Now" widget & Steam Store deals
- 🔍 **Game Search** - search the Steam Store directly from the app
- 🎨 **Dark / Light / System Theme** - respects your OS preference
- 🔔 **Desktop Notifications** - instant feedback with optional sound
- 🔽 **System Tray** - minimize to tray, manage idling from the tray menu
- 🔄 **Auto-Updater** - silent background updates via GitHub Releases
- 📦 **App Collection** - browse & download companion tools by Thomas Thanos

<br>

<div align="center">
  <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/divider.svg?v=1" alt="Divider">
</div>

## <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/icon-gamepad.svg?v=1" width="24" align="middle"> Settings

| Setting | Description |
|---|---|
| Steam API Key | Optional - enables full library fetching |
| Steam ID | Optional - used alongside API key |
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

<br>

<div align="center">
  <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/divider.svg?v=1" alt="Divider">
</div>

## <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/icon-gamepad.svg?v=1" width="24" align="middle"> Steam Account (Auto-Invisible)

Optional login to enable automatic status management:

- **QR Code** - scan with the Steam mobile app
- **Cookie** - paste your `steamLoginSecure` cookie (`steamId||<jwt>` format supported)
- Refresh token is saved (base64-obfuscated) and used for auto-reconnect on next launch
- Status changes use the `steam://friends/status/` protocol - no CM traffic, no session conflicts
- Current persona state is read from `localconfig.vdf` before switching to Invisible, then restored on stop

<br>

<div align="center">
  <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/divider.svg?v=1" alt="Divider">
</div>

## <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/icon-gamepad.svg?v=1" width="24" align="middle"> Project Structure

<div align="center">
  <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/tree.svg?v=980" width="100%" alt="Project Structure">
</div>

<br>

<div align="center">
  <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/divider.svg?v=1" alt="Divider">
</div>

## <img src="https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/icon-gamepad.svg?v=1" width="24" align="middle"> Disclaimer

Modifying Steam achievements may violate the [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/). Use at your own risk. Not affiliated with or endorsed by Valve Corporation.

<br>

## License

This project is proprietary.
© 2026 **Thomas Thanos**. All rights reserved.

<div align="center">

[![Thomas Thanos](https://raw.githubusercontent.com/thomasthanos/steam-idler/assets/.github/assets/footer-author.svg?v=1)](#)

</div>
