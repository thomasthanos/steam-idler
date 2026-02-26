/**
 * updater.ts — Auto-updater using electron-updater + GitHub Releases
 *
 * Publish flow:
 *   1. Bump version in package.json
 *   2. npm run package   →  creates installer in /release
 *   3. Push a GitHub Release tag (e.g. v1.2.0) and attach the files
 *      electron-builder does this automatically with:  --publish always
 *
 * Config in electron-builder.json:
 *   "publish": { "provider": "github", "owner": "ThomasThanos", "repo": "steam-idler" }
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { IPC, UpdaterState } from '../shared/types'

// ─── Configure ────────────────────────────────────────────────────────────────
autoUpdater.autoDownload         = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease      = false
autoUpdater.logger               = null as any
// Store downloaded update installers under Roaming\ThomasThanos\Souvlatzidiko-Unlocker\updater
(autoUpdater as any).cachePath = path.join(app.getPath('appData'), 'ThomasThanos', 'Souvlatzidiko-Unlocker', 'updater')

// ─── SplashEvent — sent from updater → splash window ──────────────────────────
export type SplashEvent =
  | { type: 'status';   text: string; cls?: string }
  | { type: 'progress'; percent: number }

// ─── Broadcast to all renderer windows (used after app loads) ─────────────────
function broadcast(state: UpdaterState) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.UPDATER_STATUS, state)
    }
  }
}

// ─── performStartupUpdateCheck ────────────────────────────────────────────────
export function performStartupUpdateCheck(
  onEvent: (evt: SplashEvent) => void
): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve()

    onEvent({ type: 'status', text: 'Checking for updates…' })

    const cleanup = () => {
      autoUpdater.removeListener('update-available',     onAvailable)
      autoUpdater.removeListener('update-not-available', onNotAvailable)
      autoUpdater.removeListener('download-progress',    onProgress)
      autoUpdater.removeListener('update-downloaded',    onDownloaded)
      autoUpdater.removeListener('error',                onError)
    }

    const onAvailable = (info: UpdateInfo) => {
      onEvent({ type: 'status', text: `Downloading v${info.version}…` })
      autoUpdater.downloadUpdate().catch(() => { cleanup(); done() })
    }

    const onNotAvailable = () => {
      onEvent({ type: 'status', text: 'Up to date.' })
      cleanup()
      setTimeout(done, 600)
    }

    const onProgress = (p: ProgressInfo) => {
      const pct = Math.round(p.percent)
      onEvent({ type: 'progress', percent: pct })
      onEvent({ type: 'status', text: `Downloading… ${pct}%` })
    }

    const onDownloaded = (info: UpdateInfo) => {
      onEvent({ type: 'status', text: `v${info.version} ready — restarting…`, cls: 'success' })
      onEvent({ type: 'progress', percent: 100 })
      cleanup()
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 1500)
      // resolve never called — app will restart
    }

    const onError = (err: Error) => {
      const msg = err?.message ?? String(err)
      const isNetwork = msg.includes('net::ERR') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')
      onEvent({
        type: 'status',
        text: isNetwork ? 'No internet — skipping update.' : 'Update check failed.',
        cls: 'warn',
      })
      cleanup()
      setTimeout(done, 800)
    }

    autoUpdater.on('update-available',     onAvailable)
    autoUpdater.on('update-not-available', onNotAvailable)
    autoUpdater.on('download-progress',    onProgress)
    autoUpdater.on('update-downloaded',    onDownloaded)
    autoUpdater.on('error',                onError)

    autoUpdater.checkForUpdates().catch((err: Error) => onError(err))
  })
}

// ─── setupUpdater — wires IPC + broadcast for the main app window ─────────────
export function setupUpdater(): void {
  autoUpdater.removeAllListeners()

  autoUpdater.on('checking-for-update', () => broadcast({ status: 'checking' }))

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const notes = Array.isArray(info.releaseNotes)
      ? info.releaseNotes.map((n: any) => (typeof n === 'string' ? n : n?.note ?? '')).join('\n')
      : typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    broadcast({ status: 'available', version: info.version, releaseNotes: notes })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    broadcast({ status: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    const version = (autoUpdater as any).updateInfo?.version ?? '…'
    broadcast({ status: 'downloading', percent: Math.round(p.percent), version })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    broadcast({ status: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err: Error) => {
    const msg = err?.message ?? String(err)
    if (msg.includes('net::ERR') || msg.includes('ENOTFOUND')) {
      broadcast({ status: 'error', message: 'Could not reach update server.' })
    } else {
      broadcast({ status: 'error', message: msg })
    }
  })

  ipcMain.handle(IPC.UPDATER_CHECK, async () => {
    try { await autoUpdater.checkForUpdates(); return { success: true } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle(IPC.UPDATER_INSTALL, async () => {
    try { await autoUpdater.downloadUpdate(); return { success: true } }
    catch (e: any) { return { success: false, error: e.message } }
  })
}
