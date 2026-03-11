/**
 * updater.ts — Auto-updater using electron-updater + GitHub Releases
 *
 * Publish flow:
 *   1. Bump version in package.json
 *   2. npm run release  →  builds + packages + uploads to GitHub
 *      (electron-builder --publish always)
 *
 * Config in electron-builder.json:
 *   "publish": { "provider": "github", "owner": "ThomasThanos", "repo": "steam-idler" }
 */

import { BrowserWindow, ipcMain, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { IPC, UpdaterState } from '../../shared/types'

// ─── Update-will-install flag ─────────────────────────────────────────────────
let _updateWillInstall = false
export function setUpdateWillInstall(): void { _updateWillInstall = true }
export function willUpdateInstall(): boolean  { return _updateWillInstall }

// ─── Pre-quit cleanup callback ────────────────────────────────────────────────
// Set by index.ts after idleManager is created so we stop idle workers before
// the NSIS installer overwrites the exe — avoids a circular import.
let _preQuitCleanup: (() => void) | null = null
export function setPreQuitCleanup(fn: () => void): void { _preQuitCleanup = fn }

// ─── Configure ───────────────────────────────────────────────────────────────
autoUpdater.autoDownload         = false  // we call downloadUpdate() manually
autoUpdater.autoInstallOnAppQuit = true   // fallback when user quits normally
autoUpdater.allowPrerelease      = false

// Log to userData/debug.log so update errors are diagnosable in production.
// Wrapped in try/catch in case app isn't ready yet at module-load time.
try {
  const logFile = path.join(app.getPath('userData'), 'debug.log')
  const stamp   = () => new Date().toISOString()
  autoUpdater.logger = {
    info:  (...a: unknown[]) => fs.appendFileSync(logFile, `[UPDATER INFO  ${stamp()}] ${a.join(' ')}\n`),
    warn:  (...a: unknown[]) => fs.appendFileSync(logFile, `[UPDATER WARN  ${stamp()}] ${a.join(' ')}\n`),
    error: (...a: unknown[]) => fs.appendFileSync(logFile, `[UPDATER ERROR ${stamp()}] ${a.join(' ')}\n`),
    debug: (...a: unknown[]) => fs.appendFileSync(logFile, `[UPDATER DEBUG ${stamp()}] ${a.join(' ')}\n`),
  } as any
} catch {
  autoUpdater.logger = null as any
}

// ─── SplashEvent ──────────────────────────────────────────────────────────────
export type SplashEvent =
  | { type: 'status';   text: string; cls?: string }
  | { type: 'progress'; percent: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cleanErrorMessage(err: Error): string {
  const raw = err?.message ?? String(err)
  if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
    const code = raw.match(/(\d{3})/)?.[1] ?? ''
    if (['502', '503', '504'].includes(code)) return `GitHub servers unavailable (${code}). Try again later.`
    return 'Update server returned an unexpected response.'
  }
  if (raw.includes('net::ERR') || raw.includes('ENOTFOUND') || raw.includes('ETIMEDOUT'))
    return 'No internet connection.'
  if (raw.includes('ECONNREFUSED') || raw.includes('EAI_AGAIN'))
    return 'Could not reach update server.'
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw
}

function broadcast(state: UpdaterState) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.UPDATER_STATUS, state)
  }
}

// Stops idle workers and restores Steam status before handing off to the
// NSIS installer. Called from both the splash restart and the in-app restart.
function doQuitAndInstall(): void {
  try { _preQuitCleanup?.() } catch { /* ignore */ }
  autoUpdater.quitAndInstall(true, true)
}

// ─── PreloadFn ────────────────────────────────────────────────────────────────
export type PreloadFn = (onEvent: (evt: SplashEvent) => void) => Promise<void>

// ─── performStartupUpdateCheck ────────────────────────────────────────────────
// Update check and preload run IN PARALLEL from t=0.
// The splash closes only when BOTH finish. If an update downloads, the app
// restarts immediately instead of opening the main window.
export function performStartupUpdateCheck(
  onEvent: (evt: SplashEvent) => void,
  preload?: PreloadFn
): Promise<void> {
  return new Promise((resolve) => {
    let resolved    = false
    let willInstall = false
    let updateDone  = false
    let preloadDone = !preload

    let safetyTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null }
      autoUpdater.removeListener('update-available',     onAvailable)
      autoUpdater.removeListener('update-not-available', onNotAvailable)
      autoUpdater.removeListener('download-progress',    onProgress)
      autoUpdater.removeListener('update-downloaded',    onDownloaded)
      autoUpdater.removeListener('error',                onError)
    }

    const tryResolve = () => {
      if (resolved || willInstall || !updateDone || !preloadDone) return
      resolved = true
      cleanup()
      resolve()
    }

    if (preload) {
      preload(onEvent)
        .catch(() => {})
        .finally(() => { preloadDone = true; tryResolve() })
    }

    const onAvailable = (info: UpdateInfo) => {
      // Cancel safety timer — we now wait for the download to finish.
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null }
      onEvent({ type: 'status', text: `Update v${info.version} found — downloading…` })
      autoUpdater.downloadUpdate().catch((err: Error) => onError(err))
    }

    const onNotAvailable = () => {
      updateDone = true
      tryResolve()
    }

    const onProgress = (p: ProgressInfo) => {
      const pct = Math.round(p.percent)
      onEvent({ type: 'progress', percent: pct })
      onEvent({ type: 'status',   text: `Downloading update… ${pct}%` })
    }

    const onDownloaded = (info: UpdateInfo) => {
      willInstall = true
      setUpdateWillInstall()
      onEvent({ type: 'status',   text: `v${info.version} ready — restarting…`, cls: 'success' })
      onEvent({ type: 'progress', percent: 100 })
      cleanup()
      setTimeout(() => doQuitAndInstall(), 1500)
      // resolve() intentionally never called — app will restart
    }

    const onError = (err: Error) => {
      const msg       = cleanErrorMessage(err)
      const isNetwork = msg.includes('No internet') || msg.includes('unavailable') || msg.includes('unexpected response')
      onEvent({
        type: 'status',
        text: isNetwork ? 'No internet — skipping update check.' : `Update check failed: ${msg}`,
        cls:  'warn',
      })
      updateDone = true
      tryResolve()
    }

    autoUpdater.on('update-available',     onAvailable)
    autoUpdater.on('update-not-available', onNotAvailable)
    autoUpdater.on('download-progress',    onProgress)
    autoUpdater.on('update-downloaded',    onDownloaded)
    autoUpdater.on('error',                onError)

    // Safety net: if anything hangs, open the app after 12 s anyway.
    safetyTimer = setTimeout(() => {
      safetyTimer = null
      onEvent({ type: 'status', text: 'Loading timed out — opening app.', cls: 'warn' })
      updateDone  = true
      preloadDone = true
      tryResolve()
    }, 12_000)

    autoUpdater.checkForUpdates().catch((err: Error) => onError(err))
  })
}

// ─── triggerBackgroundCheck ───────────────────────────────────────────────────
export function triggerBackgroundCheck(): void {
  autoUpdater.checkForUpdates().catch(() => {})
}

// ─── setupUpdater ─────────────────────────────────────────────────────────────
// Wires IPC handlers and broadcasts update state to the main app window.
export function setupUpdater(): void {
  autoUpdater.removeAllListeners()

  // Capture the version from update-available so download-progress events can
  // use it without touching the private (autoUpdater as any).updateInfo field.
  let pendingVersion = ''

  // Auto-restart timer started after download completes (30 s grace period).
  // Stored so UPDATER_RESTART IPC can cancel it and restart immediately.
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  autoUpdater.on('checking-for-update', () => {
    broadcast({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    pendingVersion = info.version
    const notes = Array.isArray(info.releaseNotes)
      ? info.releaseNotes.map((n: any) => (typeof n === 'string' ? n : n?.note ?? '')).join('\n')
      : typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    broadcast({ status: 'available', version: info.version, releaseNotes: notes })
    // Start download immediately — user only needs to approve the restart.
    autoUpdater.downloadUpdate().catch((err: Error) => {
      broadcast({ status: 'error', message: cleanErrorMessage(err) })
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    broadcast({ status: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    // FIX: use captured pendingVersion instead of private autoUpdater.updateInfo
    broadcast({ status: 'downloading', percent: Math.round(p.percent), version: pendingVersion || '…' })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setUpdateWillInstall()
    broadcast({ status: 'downloaded', version: info.version })
    // Short delay so the "ready — restarting automatically" banner is visible
    // before the app closes. Fully automatic — no user action needed.
    if (!restartTimer) {
      restartTimer = setTimeout(() => {
        restartTimer = null
        doQuitAndInstall()
      }, 3_000)
    }
  })

  autoUpdater.on('error', (err: Error) => {
    broadcast({ status: 'error', message: cleanErrorMessage(err) })
  })

  ipcMain.handle(IPC.UPDATER_CHECK, async () => {
    try   { await autoUpdater.checkForUpdates(); return { success: true } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  // No-op: download is triggered automatically on update-available.
  ipcMain.handle(IPC.UPDATER_INSTALL, async () => ({ success: true }))

  // FIX: previously did nothing if the timer was already running (race condition).
  // Now correctly cancels the auto-restart and triggers an immediate install.
  ipcMain.handle(IPC.UPDATER_RESTART, () => {
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null }
    doQuitAndInstall()
  })
}
