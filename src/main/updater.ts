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

import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { IPC, UpdaterState } from '../shared/types'

// ─── Configure ────────────────────────────────────────────────────────────────
// autoDownload = false globally: we call downloadUpdate() manually so we can
// show progress. The splash flow downloads on startup; the background check
// (after window is shown) also auto-downloads silently so the user only
// needs to approve the restart.
// autoInstallOnAppQuit ensures the update is applied when the user quits normally.
autoUpdater.autoDownload         = false   // we call downloadUpdate() manually for control
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease      = false
autoUpdater.logger               = null as any

// ─── SplashEvent — sent from updater → splash window ──────────────────────────
export type SplashEvent =
  | { type: 'status';   text: string; cls?: string }
  | { type: 'progress'; percent: number }

// ─── Clean error messages (strip HTML bodies, truncate) ─────────────────────
function cleanErrorMessage(err: Error): string {
  const raw = err?.message ?? String(err)
  // If it contains HTML (e.g. GitHub 504 page), just return a clean message
  if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
    const statusMatch = raw.match(/(\d{3})/)
    const code = statusMatch ? statusMatch[1] : ''
    if (code === '504' || code === '502' || code === '503') return `GitHub servers unavailable (${code}). Try again later.`
    return 'Update server returned an unexpected response.'
  }
  if (raw.includes('net::ERR') || raw.includes('ENOTFOUND') || raw.includes('ETIMEDOUT')) return 'No internet connection.'
  if (raw.includes('ECONNREFUSED') || raw.includes('EAI_AGAIN')) return 'Could not reach update server.'
  // Truncate long messages
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw
}

// ─── Broadcast to all renderer windows (used after app loads) ─────────────────
function broadcast(state: UpdaterState) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.UPDATER_STATUS, state)
    }
  }
}

// ─── PreloadFn — optional warm-up that runs when no update is found ────────────
export type PreloadFn = (onEvent: (evt: SplashEvent) => void) => Promise<void>

// ─── performStartupUpdateCheck ────────────────────────────────────────────────
export function performStartupUpdateCheck(
  onEvent: (evt: SplashEvent) => void,
  preload?: PreloadFn
): Promise<void> {
  return new Promise((resolve) => {
    let finished = false
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null

    const done = () => {
      if (finished) return
      finished = true
      if (timeoutHandle) clearTimeout(timeoutHandle)
      cleanup()
      resolve()
    }

    const cleanup = () => {
      autoUpdater.removeListener('update-available',     onAvailable)
      autoUpdater.removeListener('update-not-available', onNotAvailable)
      autoUpdater.removeListener('download-progress',    onProgress)
      autoUpdater.removeListener('update-downloaded',    onDownloaded)
      autoUpdater.removeListener('error',                onError)
    }

    // Clear the safety timeout as soon as ANY update event fires.
    // Without this, if the preload takes a while the timeout could fire
    // mid-preload and call runPreloadThenDone() a second time.
    const clearSafetyTimeout = () => {
      if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null }
    }

    const onAvailable = (info: UpdateInfo) => {
      clearSafetyTimeout()
      onEvent({ type: 'status', text: `Downloading v${info.version}…` })
      // autoDownload = false globally, so we trigger the download manually here
      // (only during the splash flow — background checks require a user click)
      autoUpdater.downloadUpdate().catch((err: Error) => onError(err))
    }

    const runPreloadThenDone = () => {
      clearSafetyTimeout()
      if (preload) {
        preload(onEvent).catch(() => {}).finally(() => done())
      } else {
        done()
      }
    }

    const onNotAvailable = () => {
      onEvent({ type: 'status', text: 'Up to date.' })
      runPreloadThenDone()
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
      const msg = cleanErrorMessage(err)
      const isNetwork = msg.includes('No internet') || msg.includes('unavailable') || msg.includes('unexpected response')
      onEvent({
        type: 'status',
        text: isNetwork ? 'No internet — skipping update.' : `Update check failed: ${msg}`,
        cls: 'warn',
      })
      // Still run the preload even if the update check failed — the splash
      // window is already open so we use the time to warm the data cache.
      runPreloadThenDone()
    }

    autoUpdater.on('update-available',     onAvailable)
    autoUpdater.on('update-not-available', onNotAvailable)
    autoUpdater.on('download-progress',    onProgress)
    autoUpdater.on('update-downloaded',    onDownloaded)
    autoUpdater.on('error',                onError)

    // Safety timeout — if no event fires within 8s, run preload anyway
    timeoutHandle = setTimeout(() => {
      onEvent({ type: 'status', text: 'Update check timed out.', cls: 'warn' })
      runPreloadThenDone()
    }, 8000)

    onEvent({ type: 'status', text: 'Checking for updates…' })
    autoUpdater.checkForUpdates().catch((err: Error) => onError(err))
  })
}

// ─── triggerBackgroundCheck — silent re-check after main window is ready ────────
export function triggerBackgroundCheck(): void {
  autoUpdater.checkForUpdates().catch(() => { /* ignore */ })
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
    // Auto-download silently — user only needs to confirm the restart
    autoUpdater.downloadUpdate().catch((err: Error) => {
      broadcast({ status: 'error', message: cleanErrorMessage(err) })
    })
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
    // Fully automatic — restart & install after a 3-second grace period
    // so the user can see the "restarting" message before the app closes.
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 3000)
  })

  autoUpdater.on('error', (err: Error) => {
    broadcast({ status: 'error', message: cleanErrorMessage(err) })
  })

  ipcMain.handle(IPC.UPDATER_CHECK, async () => {
    try { await autoUpdater.checkForUpdates(); return { success: true } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  // UPDATER_INSTALL is kept for IPC compatibility but is now a no-op.
  // The download is triggered automatically by the 'update-available' event.
  // Calling downloadUpdate() here again would cause a duplicate download.
  ipcMain.handle(IPC.UPDATER_INSTALL, async () => {
    return { success: true }
  })

  ipcMain.handle(IPC.UPDATER_RESTART, () => {
    autoUpdater.quitAndInstall(true, true)
  })
}
