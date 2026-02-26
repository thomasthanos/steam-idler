import { app, BrowserWindow, ipcMain, nativeTheme, shell, Tray, Menu, nativeImage } from 'electron'
import { TRAY_ICONS } from './trayIcons'
import * as path from 'path'
import * as fs from 'fs'
import { setupIpcHandlers } from './ipc/handlers'
import { performStartupUpdateCheck, setupUpdater, triggerBackgroundCheck, SplashEvent } from './updater'
import { SteamClient } from './steam/client'
import { IdleManager } from './steam/idleManager'
import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types'

// ─── Set app identity FIRST — must be before any new Store() call ─────────────
app.setName('Souvlatzidiko-Unlocker')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.ThomasThanos.SouvlatzidikoUnlocker')
}
app.setPath('userData', path.join(app.getPath('appData'), 'ThomasThanos', 'Souvlatzidiko-Unlocker'))

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const steamClient = new SteamClient()
export const idleManager = new IdleManager()

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── Settings store ────────────────────────────────────────────────────────
const store = new Store<{ settings: AppSettings }>({ defaults: { settings: DEFAULT_SETTINGS } })

// ─── Single instance lock ─────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function getIconPath(size: '256' | '32' | 'png' = '256'): string {
  const filename = size === 'png' ? 'steam.png'
    : size === '32' ? 'steam_x32.ico'
    : 'steam_x256.ico'

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

  splash.loadFile(getSplashHtmlPath())

  splash.once('ready-to-show', () => splash.show())

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

  // Run update check — this resolves when the flow is complete
  await performStartupUpdateCheck(onSplashEvent)

  // Transition: show status "Launching…", create main window, then close splash
  call('_setStatus', 'Launching…')
  call('_hideSpinner')

  // Create main window while splash is still visible
  onReady()

  // Close splash once main window has painted (or after a short delay)
  const closeSplash = () => {
    if (!splash.isDestroyed()) {
      splash.close()
    }
  }

  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      setTimeout(closeSplash, 200)
    })
  } else {
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

    const appIcon = icon.isEmpty() ? undefined : nativeImage.createFromPath(getIconPath('32')).resize({ width: 16, height: 16 })

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
                mainWindow?.webContents.send('idle:changed')
                updateMenu()
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
        { label: 'Quit', icon: menuIcon('tray_quit'), click: () => { tray?.destroy(); idleManager.stopAll(); app.exit(0) } },
      ])

      tray?.setContextMenu(contextMenu)
    }

    updateMenu()
    tray.on('click', () => {
      if (mainWindow?.isVisible()) mainWindow.focus()
      else { mainWindow?.show(); mainWindow?.focus() }
    })
    setInterval(updateMenu, 5000)
  } catch (e) {
    console.error('[tray] Failed to create tray:', e)
  }
}

// ─── Main window ───────────────────────────────────────────────────────────
function createWindow(): void {
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
    mainWindow?.show()
    // Trigger a silent background update check so the renderer gets
    // the updater status after the window is ready (the startup check
    // runs before the window exists, so broadcast() has no target).
    setTimeout(() => triggerBackgroundCheck(), 3000)
  })

  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (message.includes('cdn.cloudflare.steamstatic.com')) return
    if (message.includes('store.steampowered.com') && message.includes('404')) return
    if (level === 0 || level === 1) return
    if (level === 2) process.stdout.write(`[renderer:warn] ${message}\n`)
    if (level === 3) process.stderr.write(`[renderer:error] ${message}\n`)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (e) => {
    const settings = store.get('settings')
    if (settings.minimizeToTray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => {
    const settings = store.get('settings')
    if (settings.minimizeToTray) mainWindow?.hide()
    else mainWindow?.close()
  })

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send(
      'theme:changed',
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    )
  })
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  setupIpcHandlers(steamClient, idleManager)
  setupUpdater()

  await runSplashFlow(() => {
    createWindow()
    createTray()

    const settings = store.get('settings')
    if (settings.autoIdleGames?.length) {
      for (const game of settings.autoIdleGames) {
        try {
          idleManager.startIdle(game.appId)
        } catch (e) {
          console.error(`[auto-idle] Failed to start ${game.appId}:`, e)
        }
      }
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  const settings = store.get('settings')
  if (tray && settings.minimizeToTray) return
  forceQuit()
})

let isQuitting = false
function forceQuit() {
  if (isQuitting) return
  isQuitting = true
  idleManager.stopAll()
  // destroy with timeout so we never hang
  const timeout = setTimeout(() => app.exit(0), 3000)
  steamClient.destroy()
    .catch(() => {})
    .finally(() => {
      clearTimeout(timeout)
      app.exit(0)
    })
}

app.on('before-quit', () => {
  forceQuit()
})
