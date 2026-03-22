import { app, BrowserWindow, ipcMain, nativeTheme, shell, Tray, Menu, nativeImage } from 'electron'
import { showNotification } from './managers/notificationManager'
import { TRAY_ICONS } from './managers/trayIcons'
import * as path from 'path'
import * as fs from 'fs'
import { setupIpcHandlers } from './ipc/handlers'
import { performStartupUpdateCheck, setupUpdater, triggerBackgroundCheck, willUpdateInstall, SplashEvent, PreloadFn } from './managers/updater'
import { SteamClient } from './steam/client'
import { IdleManager } from './steam/idleManager'
import { SteamAccountManager } from './steam/steamUser'
import { getStore } from './managers/store'

// ─── Set app identity FIRST — must be before any new Store() call ─────────────
app.setName('Souvlatzidiko-Unlocker')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.ThomasThanos.SouvlatzidikoUnlocker')
}
app.setPath('userData', path.join(app.getPath('appData'), 'ThomasThanos', 'Souvlatzidiko-Unlocker'))

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trayUpdateInterval: ReturnType<typeof setInterval> | null = null
let isQuitting = false
const steamClient = new SteamClient()
export const idleManager = new IdleManager()
export const steamAccountManager = new SteamAccountManager()
idleManager.setSteamAccountManager(steamAccountManager)

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── Idle notification helper ─────────────────────────────────────────────
function showIdleNotification(title: string, body: string, variant: 'warning' | 'error' | 'success' | 'info' = 'info'): void {
  try {
    showNotification({
      title,
      body,
      variant,
      duration: 5000,
      onClick: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    })
  } catch (e) {
    console.error('[notification] Failed:', e)
  }
}

// Helper: is the main window currently visible to the user (not hidden in tray)?
function isWindowVisible(): boolean {
  return !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized())
}

// Notify when a manual game launch stops all idling
idleManager.on('manual-game-detected', (appId: number) => {
  // Always show native overlay notification (visible even when app is in tray)
  showIdleNotification(
    'Idling Stopped',
    `A Steam game was launched (AppID: ${appId}). All idling has been stopped.`,
    'error',
  )
  // In-app toast ONLY when the window is open and visible
  if (isWindowVisible()) {
    mainWindow!.webContents.send('idle:warning', { type: 'manual-game-detected', appId })
  }
})

// Notify when the manually launched game quits and idle resumes
idleManager.on('manual-game-quit', () => {
  // Always show native overlay notification
  showIdleNotification(
    'Auto-Idle Resumed',
    'Your game has ended. Auto-idle has been resumed.',
    'success',
  )
  // In-app toast ONLY when the window is open and visible
  if (isWindowVisible()) {
    mainWindow!.webContents.send('idle:warning', { type: 'auto-idle-resumed' })
  }
})

// Notify when Steam quits while idle is running
idleManager.on('steam-disappeared', () => {
  showIdleNotification(
    'Steam Closed',
    'Steam is no longer running. All idling has been stopped.',
    'error',
  )
  if (isWindowVisible()) {
    mainWindow!.webContents.send('idle:warning', { type: 'steam-disappeared' })
  }
})

// Notify when starting idle while a game is already running
idleManager.on('game-already-running', (appId: number) => {
  // Always show native overlay notification
  showIdleNotification(
    'Game Conflict Detected',
    `A Steam game is currently running (AppID: ${appId}). Idling may conflict.`,
    'warning',
  )
  // In-app toast ONLY when the window is open and visible
  if (isWindowVisible()) {
    mainWindow!.webContents.send('idle:warning', { type: 'game-already-running', appId })
  }
})

// ─── Production logging ───────────────────────────────────────────────────────
if (!isDev) {
  const logFile = path.join(app.getPath('userData'), 'debug.log')
  try {
    // Truncate log file if over 5 MB to prevent unbounded growth
    try {
      const stat = fs.statSync(logFile)
      if (stat.size > 5 * 1024 * 1024) fs.writeFileSync(logFile, '')
    } catch { /* file may not exist yet */ }
    const logStream = fs.createWriteStream(logFile, { flags: 'a' })
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn
    console.log = (...args: unknown[]) => {
      logStream.write(`[LOG ${new Date().toISOString()}] ${args.join(' ')}\n`)
      originalLog.apply(console, args)
    }
    console.error = (...args: unknown[]) => {
      logStream.write(`[ERROR ${new Date().toISOString()}] ${args.join(' ')}\n`)
      originalError.apply(console, args)
    }
    console.warn = (...args: unknown[]) => {
      logStream.write(`[WARN ${new Date().toISOString()}] ${args.join(' ')}\n`)
      originalWarn.apply(console, args)
    }
    console.log(`[startup] App starting v${app.getVersion()}, userData=${app.getPath('userData')}`)
  } catch { /* ok */ }
}


// ─── Single instance lock ─────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function getIconPath(size: '256' | '32' | 'png' = '256'): string {
  const filename = size === 'png' ? 'steam.png'
    : 'all_steam_x256.ico'

  const candidates = [
    path.join(process.resourcesPath ?? '', filename),
    path.join(__dirname, '../../../src/assets/icons', filename),
    path.join(app.getAppPath(), 'src/assets/icons', filename),
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch { /* ok */ }
  }
  return candidates[1]
}

function getSplashHtmlPath(): string {
  const candidates = [
    path.join(__dirname, '../../../src/assets/splash.html'),
    path.join(app.getAppPath(), 'src/assets/splash.html'),
    path.join(process.resourcesPath ?? '', 'splash.html'),
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch { /* ok */ }
  }
  return candidates[1]
}

// ─── Splash window ────────────────────────────────────────────────────────
/**
 * Creates a small frameless splash window, runs the update check/download,
 * then calls `onReady` so the main window can be created. The splash closes
 * itself automatically when the main window is ready to show.
 */
async function runSplashFlow(onReady: () => void): Promise<void> {
  // Skip splash in dev so hot-reload stays snappy
  if (isDev) {
    onReady()
    return
  }

  const splash = new BrowserWindow({
    width: 480,
    height: 180,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    backgroundColor: '#0a0a0b',
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  splash.loadFile(getSplashHtmlPath()).catch((err: Error) => {
    console.error('[splash] Failed to load splash HTML:', err)
  })

  // Wait for the splash to be ready before starting work so early status
  // messages (e.g. "Connecting to Steam…") are not lost.
  await new Promise<void>(resolve => {
    splash.once('ready-to-show', () => {
      splash.show()
      splash.webContents.executeJavaScript(
        `window._setVersion(${JSON.stringify(app.getVersion())})`
      ).catch(() => {})
      resolve()
    })
  })

  // Helper: call a JS function defined in splash.html
  const call = (fn: string, ...args: unknown[]) => {
    if (splash.isDestroyed()) return
    const json = args.map(a => JSON.stringify(a)).join(', ')
    splash.webContents.executeJavaScript(`window.${fn}(${json})`).catch(() => { /* ignore */ })
  }

  // Push updater events into the splash window
  const onSplashEvent = (evt: SplashEvent) => {
    if (evt.type === 'status') {
      call('_setStatus', evt.text, evt.cls ?? '')
    } else if (evt.type === 'progress') {
      call('_setProgress', evt.percent)
    }
  }

  // Preload fn — runs IN PARALLEL with the update check.
  // Status messages here are the primary UI driver; update check only
  // overrides when it has something important to say (downloading, error).
  const preloadFn: PreloadFn = async (emit) => {
    emit({ type: 'status',   text: 'Connecting to Steam…' })
    emit({ type: 'progress', percent: 10 })

    try {
      const isRunning = await steamClient.isSteamRunning().catch(() => false)
      emit({ type: 'progress', percent: 25 })

      if (isRunning) {
        emit({ type: 'status',   text: 'Loading profile…' })
        await steamClient.getUserInfo().catch(() => null)
        emit({ type: 'progress', percent: 50 })

        emit({ type: 'status',   text: 'Loading library…' })
        await steamClient.getOwnedGames().catch(() => null)
        emit({ type: 'progress', percent: 75 })

        emit({ type: 'status',   text: 'Loading recent games…' })
        await steamClient.getRecentGames().catch(() => null)
        emit({ type: 'progress', percent: 88 })

        emit({ type: 'status',   text: 'Loading store data…' })
        await steamClient.getSteamFeatured().catch(() => null)
        emit({ type: 'progress', percent: 96 })
      } else {
        emit({ type: 'status',   text: 'Steam not running — launching anyway…' })
        emit({ type: 'progress', percent: 92 })
      }
    } catch { /* silent — splash will still close */ }

    emit({ type: 'progress', percent: 100 })
    emit({ type: 'status',   text: 'Ready!' })
    // Brief pause so the user sees 100% before the window appears
    await new Promise(r => setTimeout(r, 250))
  }

  // Run update check — this resolves when the flow is complete
  await performStartupUpdateCheck(onSplashEvent, preloadFn)

  // Transition: show status "Launching…", create main window, then close splash
  call('_setStatus', 'Launching…')
  call('_hideSpinner')

  // Create main window while splash is still visible
  onReady()

  // Close splash once main window has painted.
  // Safety fallback: if ready-to-show never fires (e.g. renderer crash during
  // load), close the splash after 8 s so it doesn't stay open forever.
  const closeSplash = () => {
    if (!splash.isDestroyed()) splash.close()
  }

  const splashFallback = setTimeout(closeSplash, 8000)

  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      clearTimeout(splashFallback)
      setTimeout(closeSplash, 200)
    })
  } else {
    clearTimeout(splashFallback)
    setTimeout(closeSplash, 1000)
  }
}

// ─── Tray ─────────────────────────────────────────────────────────────────
function createTray(): void {
  try {
    const iconPath = getIconPath('32')
    let icon: Electron.NativeImage
    try {
      icon = nativeImage.createFromPath(iconPath)
      if (icon.isEmpty()) icon = nativeImage.createFromPath(getIconPath('png'))
    } catch {
      icon = nativeImage.createEmpty()
    }

    tray = new Tray(icon)
    tray.setToolTip('Souvlatzidiko-Unlocker')

    const menuIcon = (name: string): Electron.NativeImage | undefined => {
      const b64 = TRAY_ICONS[name]
      if (!b64) return undefined
      try {
        const buf = Buffer.from(b64, 'base64')
        const img = nativeImage.createFromBuffer(buf, { scaleFactor: 1 })
        return img.isEmpty() ? undefined : img
      } catch { return undefined }
    }

    const appIcon = icon.isEmpty() ? undefined : icon.resize({ width: 16, height: 16 })

    const updateMenu = () => {
      const idlingGames = idleManager.getIdlingGames()
      const idlingCount = idlingGames.length

      const idleSection: Electron.MenuItemConstructorOptions[] = idlingCount > 0
        ? [
            {
              label: `Idling  ${idlingCount} game${idlingCount > 1 ? 's' : ''}`,
              icon: menuIcon('tray_idling'),
              click: () => { mainWindow?.show(); mainWindow?.focus() },
            },
            ...idlingGames.map(g => ({
              label: g.name.length > 30 ? g.name.slice(0, 30) + '…' : g.name,
              icon: menuIcon('tray_game'),
              click: () => { mainWindow?.show(); mainWindow?.focus() },
            } as Electron.MenuItemConstructorOptions)),
            { type: 'separator' as const },
            {
              label: 'Stop All Idling',
              icon: menuIcon('tray_stop'),
              click: () => {
                idleManager.stopAll()
                // updateMenu + idle:changed broadcast handled by 'changed' event listener
              },
            },
          ]
        : [
            {
              label: 'Not idling',
              icon: menuIcon('tray_not_idling'),
              click: () => { mainWindow?.show(); mainWindow?.focus() },
            },
          ]

      const contextMenu = Menu.buildFromTemplate([
        { label: 'Souvlatzidiko-Unlocker', enabled: false, icon: appIcon },
        { type: 'separator' },
        { label: 'Show App', icon: menuIcon('tray_show'), click: () => { mainWindow?.show(); mainWindow?.focus() } },
        { type: 'separator' },
        ...idleSection,
        { type: 'separator' },
        { label: 'Quit', icon: menuIcon('tray_quit'), click: () => forceQuit() },
      ])

      tray?.setContextMenu(contextMenu)
    }

    updateMenu()
    tray.on('click', () => {
      if (mainWindow?.isVisible()) mainWindow.focus()
      else { mainWindow?.show(); mainWindow?.focus() }
    })

    // Fix #10 – update the tray AND renderer immediately whenever idle
    // state changes (e.g. a game starts, stops, or a worker exits).
    idleManager.on('changed', () => {
      updateMenu()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('idle:changed')
      }
    })

    // Keep a slower poll as a safety net (handles edge-cases like process crashes
    // where the 'exit' event may arrive after a delay).
    if (trayUpdateInterval) clearInterval(trayUpdateInterval)
    trayUpdateInterval = setInterval(updateMenu, 10_000)
  } catch (e) {
    console.error('[tray] Failed to create tray:', e)
  }
}

// ─── Main window ───────────────────────────────────────────────────────────
function createWindow(startMinimized = false): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 820,
    minWidth: 1000,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0b',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    show: false,
    icon: getIconPath('256'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
  } else {
    // app.getAppPath() returns the root of the asar/app folder reliably in production
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (!startMinimized) {
      mainWindow?.show()
    }
    // Trigger a silent background update check so the renderer gets
    // the updater status after the window is ready (the startup check
    // runs before the window exists, so broadcast() has no target).
    setTimeout(() => triggerBackgroundCheck(), 3000)
  })

  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (message.includes('cdn.cloudflare.steamstatic.com')) return
    if (message.includes('store.steampowered.com') && message.includes('404')) return
    if (message.includes('Content-Security-Policy')) return
    if (message.includes('Electron Security Warning')) return
    if (level === 0 || level === 1) return
    if (level === 2) process.stdout.write(`[renderer:warn] ${message}\n`)
    if (level === 3) process.stderr.write(`[renderer:error] ${message}\n`)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (e) => {
    if (isQuitting) return  // let it close — we're quitting
    const settings = getStore().get('settings')
    if (settings.minimizeToTray) {
      e.preventDefault()
      mainWindow?.hide()
    }
    // minimizeToTray=false: let window close normally,
    // window-all-closed will call forceQuit().
  })

  mainWindow.on('closed', () => { mainWindow = null })

}

function setupNativeThemeListener(): void {
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send(
      'theme:changed',
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    )
  })
}

// ─── Window IPC (registered ONCE, not per window instance) ──────────────────
function setupWindowIpc(): void {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => {
    mainWindow?.close()
  })
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  setupIpcHandlers(steamClient, idleManager, steamAccountManager)
  setupWindowIpc()        // Register window IPC once at startup
  setupNativeThemeListener() // Register once — avoids duplicate listeners on macOS window recreate

  await runSplashFlow(() => {
    const settings = getStore().get('settings')
    const startMinimized = settings.minimizeToTray
    createWindow(startMinimized)
    createTray()
    // setupUpdater MUST be called after the splash flow so that
    // autoUpdater.removeAllListeners() doesn't clobber the splash listeners.
    setupUpdater()

    if (settings.autoIdleGames?.length) {
      // Wait for Steam to be fully running before starting auto-idle.
      // On cold boot, Steam may not be ready yet even though the app
      // launched (e.g. via Windows startup). Poll for up to 60 seconds.
      const autoIdleGames = [...settings.autoIdleGames]
      idleManager.waitForSteam(12, 5000).then((steamReady) => {
        if (!steamReady) {
          console.warn('[auto-idle] Steam not detected — skipping auto-idle')
          showIdleNotification(
            'Auto-Idle Skipped',
            'Steam is not running. Auto-idle could not start.',
            'warning',
          )
          return
        }
        for (const game of autoIdleGames) {
          try {
            idleManager.startIdle(game.appId, game.name)
          } catch (e) {
            console.error(`[auto-idle] Failed to start ${game.appId}:`, e)
          }
        }
      })
    }

    // Auto-reconnect Steam account if a refresh token is stored
    if (settings.steamRefreshToken) {
      setTimeout(() => {
        try {
          const token = Buffer.from(settings.steamRefreshToken!, 'base64').toString('utf8')
          steamAccountManager.loginWithRefreshToken(token)
            .then(() => {
              // After successful reconnect, check for orphaned pre-idle status
              // from a previous session that crashed while idling.
              steamAccountManager.restoreOrphanedStatus()
            })
            .catch(e => {
              console.warn('[steam-account] Auto-reconnect failed (will retry on next launch):', e?.message ?? e)
              // Even without a CM session, try to restore orphaned status via
              // steam:// protocol (works as long as Steam client is running).
              // _accountId won't be set so this is a best-effort attempt.
              steamAccountManager.restoreOrphanedStatus()
            })
        } catch { /* ok */ }
      }, 2000)
    } else {
      // No steam account configured, but still check for orphaned status.
      // This handles the edge case where the user logged out of the steam
      // account but the app crashed before restoring status.
      // Delayed slightly to let Steam client fully start if launching together.
      setTimeout(() => steamAccountManager.restoreOrphanedStatus(), 3000)
    }

    // Mid-session reconnect: when steam-user loses its CM connection (network
    // drop, Steam restart, session expiry), try once with the stored token.
    // A 10-second delay avoids hammering Steam if it momentarily drops the
    // connection during a restart/update.
    let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
    steamAccountManager.on('auto-reconnect-needed', () => {
      if (_reconnectTimer) return // already scheduled
      _reconnectTimer = setTimeout(() => {
        _reconnectTimer = null
        const current = getStore().get('settings')
        if (!current.steamRefreshToken) return
        console.log('[steam-account] Attempting mid-session reconnect…')
        try {
          const token = Buffer.from(current.steamRefreshToken, 'base64').toString('utf8')
          steamAccountManager.loginWithRefreshToken(token).catch(e => {
            console.warn('[steam-account] Mid-session reconnect failed:', e?.message ?? e)
          })
        } catch { /* ok */ }
      }, 10_000)
    })

  })
})

// Set isQuitting=true before window close events fire so the mainWindow
// close handler doesn't call e.preventDefault() (minimizeToTray path)
// or let forceQuit() call app.exit(0) — both of which would prevent
// autoUpdater.quitAndInstall() from running the installer.
app.on('before-quit', () => { isQuitting = true })

app.on('window-all-closed', () => {
  const settings = getStore().get('settings')
  if (tray && settings.minimizeToTray) return
  forceQuit()
})

export function forceQuit() {
  if (isQuitting) return
  isQuitting = true

  // If an update has been downloaded and is about to install, let
  // autoUpdater.quitAndInstall() handle the exit — don't call app.exit().
  if (willUpdateInstall()) return

  // Close the main window immediately (isQuitting=true bypasses the hide logic).
  mainWindow?.close()
  if (trayUpdateInterval) { clearInterval(trayUpdateInterval); trayUpdateInterval = null }
  idleManager.removeAllListeners('changed')
  tray?.destroy()
  tray = null
  // Restore Steam persona state before stopping idle workers.
  // Do it FIRST (before workers exit) so Steam has time to process the
  // status change while the CM session is still alive.
  // restoreStatus() also clears the persisted preIdleStatus from disk.
  if (idleManager.getIdlingAppIds().length > 0) {
    steamAccountManager.restoreStatus()
  } else {
    // Not idling, but still clean up any stale persisted status
    try { getStore().delete('preIdleStatus') } catch { /* ok */ }
  }
  // skipRestore=true: restoreStatus() already called above
  idleManager.stopAll({ skipRestore: true })
  steamAccountManager.destroy()
  const timeout = setTimeout(() => app.exit(0), 3000)
  steamClient.destroy()
    .catch(() => {})
    .finally(() => {
      clearTimeout(timeout)
      app.exit(0)
    })
}

