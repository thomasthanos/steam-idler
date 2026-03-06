import { app, BrowserWindow, ipcMain, nativeTheme, shell, Tray, Menu, nativeImage, Notification } from 'electron'
import { TRAY_ICONS } from './trayIcons'
import * as path from 'path'
import * as fs from 'fs'
import { setupIpcHandlers } from './ipc/handlers'
import { performStartupUpdateCheck, setupUpdater, triggerBackgroundCheck, willUpdateInstall, SplashEvent, PreloadFn } from './updater'
import { SteamClient } from './steam/client'
import { IdleManager } from './steam/idleManager'
import { SteamAccountManager } from './steam/steamUser'
import { getStore } from './store'

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
function showIdleNotification(title: string, body: string): void {
  try {
    if (!Notification.isSupported()) return
    const iconCandidates = [
      path.join(process.resourcesPath ?? '', 'notify.png'),
      path.join(__dirname, '../../../resources/notify.png'),
      path.join(app.getAppPath(), 'resources/notify.png'),
      path.join(__dirname, '../../../resources/steam.png'),
    ]
    const icon = iconCandidates.find(p => { try { return fs.existsSync(p) } catch { return false } })
    const n = new Notification({ title, body, silent: false, icon })
    n.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
      }
    })
    n.show()
  } catch (e) {
    console.error('[notification] Failed:', e)
  }
}

// Notify when a manual game launch stops all idling
idleManager.on('manual-game-detected', (appId: number) => {
  showIdleNotification(
    'Idling Stopped',
    `A Steam game was launched (AppID: ${appId}). All idling has been stopped and your status has been restored.`,
  )
  // Also send in-app notification (toast) for when OS notifications are disabled
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('idle:warning', { type: 'manual-game-detected', appId })
  }
})

// Notify when starting idle while a game is already running
idleManager.on('game-already-running', (appId: number) => {
  showIdleNotification(
    'Game Already Running',
    `A Steam game is currently running (AppID: ${appId}). Idling will start, but it may conflict with the running game.`,
  )
  // Also send in-app notification (toast) for when OS notifications are disabled
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('idle:warning', { type: 'game-already-running', appId })
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
    path.join(__dirname, '../../../resources', filename),
    path.join(app.getAppPath(), 'resources', filename),
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch { /* ok */ }
  }
  return candidates[1]
}

function getSplashHtmlPath(): string {
  const candidates = [
    path.join(__dirname, '../../../resources/splash.html'),
    path.join(app.getAppPath(), 'resources/splash.html'),
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
      for (const game of settings.autoIdleGames) {
        try {
          idleManager.startIdle(game.appId, game.name)  // Fix: pass game.name
        } catch (e) {
          console.error(`[auto-idle] Failed to start ${game.appId}:`, e)
        }
      }
    }

    // Auto-reconnect Steam account if a refresh token is stored
    if (settings.steamRefreshToken) {
      setTimeout(() => {
        try {
          const token = Buffer.from(settings.steamRefreshToken!, 'base64').toString('utf8')
          steamAccountManager.loginWithRefreshToken(token).catch(e => {
            console.warn('[steam-account] Auto-reconnect failed (will retry on next launch):', e?.message ?? e)
          })
        } catch { /* ok */ }
      }, 2000)
    }

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
  // skipRestore=true: don't open steam:// URLs while the app is shutting down
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

