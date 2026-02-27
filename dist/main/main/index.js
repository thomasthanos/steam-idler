"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.idleManager = void 0;
exports.forceQuit = forceQuit;
const electron_1 = require("electron");
const trayIcons_1 = require("./trayIcons");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const handlers_1 = require("./ipc/handlers");
const updater_1 = require("./updater");
const client_1 = require("./steam/client");
const idleManager_1 = require("./steam/idleManager");
const store_1 = require("./store");
// ─── Set app identity FIRST — must be before any new Store() call ─────────────
electron_1.app.setName('Souvlatzidiko-Unlocker');
if (process.platform === 'win32') {
    electron_1.app.setAppUserModelId('com.ThomasThanos.SouvlatzidikoUnlocker');
}
electron_1.app.setPath('userData', path.join(electron_1.app.getPath('appData'), 'ThomasThanos', 'Souvlatzidiko-Unlocker'));
let mainWindow = null;
let tray = null;
let trayUpdateInterval = null;
let activateListenerRegistered = false;
const steamClient = new client_1.SteamClient();
exports.idleManager = new idleManager_1.IdleManager();
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// ─── Production logging ───────────────────────────────────────────────────────
if (!isDev) {
    const logFile = path.join(electron_1.app.getPath('userData'), 'debug.log');
    try {
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        console.log = (...args) => {
            logStream.write(`[LOG ${new Date().toISOString()}] ${args.join(' ')}\n`);
            originalLog.apply(console, args);
        };
        console.error = (...args) => {
            logStream.write(`[ERROR ${new Date().toISOString()}] ${args.join(' ')}\n`);
            originalError.apply(console, args);
        };
        console.warn = (...args) => {
            logStream.write(`[WARN ${new Date().toISOString()}] ${args.join(' ')}\n`);
            originalWarn.apply(console, args);
        };
        console.log(`[startup] App starting v${electron_1.app.getVersion()}, userData=${electron_1.app.getPath('userData')}`);
    }
    catch { /* ok */ }
}
// ─── Single instance lock ─────────────────────────────────────────────────
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
// ─── Helpers ──────────────────────────────────────────────────────────────
function getIconPath(size = '256') {
    const filename = size === 'png' ? 'steam.png'
        : 'all_steam_x256.ico';
    const candidates = [
        path.join(process.resourcesPath ?? '', filename),
        path.join(__dirname, '../../../resources', filename),
        path.join(electron_1.app.getAppPath(), 'resources', filename),
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p))
                return p;
        }
        catch { /* ok */ }
    }
    return candidates[1];
}
function getSplashHtmlPath() {
    const candidates = [
        path.join(__dirname, '../../../resources/splash.html'),
        path.join(electron_1.app.getAppPath(), 'resources/splash.html'),
        path.join(process.resourcesPath ?? '', 'splash.html'),
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p))
                return p;
        }
        catch { /* ok */ }
    }
    return candidates[1];
}
// ─── Splash window ────────────────────────────────────────────────────────
/**
 * Creates a small frameless splash window, runs the update check/download,
 * then calls `onReady` so the main window can be created. The splash closes
 * itself automatically when the main window is ready to show.
 */
async function runSplashFlow(onReady) {
    // Skip splash in dev so hot-reload stays snappy
    if (isDev) {
        onReady();
        return;
    }
    const splash = new electron_1.BrowserWindow({
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
    });
    splash.loadFile(getSplashHtmlPath());
    splash.once('ready-to-show', () => {
        splash.show();
        // Show the current app version in the bottom-right corner
        splash.webContents.executeJavaScript(`window._setVersion(${JSON.stringify(electron_1.app.getVersion())})`).catch(() => { });
    });
    // Helper: call a JS function defined in splash.html
    const call = (fn, ...args) => {
        if (splash.isDestroyed())
            return;
        const json = args.map(a => JSON.stringify(a)).join(', ');
        splash.webContents.executeJavaScript(`window.${fn}(${json})`).catch(() => { });
    };
    // Push updater events into the splash window
    const onSplashEvent = (evt) => {
        if (evt.type === 'status') {
            call('_setStatus', evt.text, evt.cls ?? '');
        }
        else if (evt.type === 'progress') {
            call('_setProgress', evt.percent);
        }
    };
    // Preload fn — runs IN PARALLEL with the update check.
    // Status messages here are the primary UI driver; update check only
    // overrides when it has something important to say (downloading, error).
    const preloadFn = async (emit) => {
        emit({ type: 'status', text: 'Connecting to Steam…' });
        emit({ type: 'progress', percent: 10 });
        try {
            const isRunning = await steamClient.isSteamRunning().catch(() => false);
            emit({ type: 'progress', percent: 25 });
            if (isRunning) {
                emit({ type: 'status', text: 'Loading profile…' });
                await steamClient.getUserInfo().catch(() => null);
                emit({ type: 'progress', percent: 50 });
                emit({ type: 'status', text: 'Loading library…' });
                await steamClient.getOwnedGames().catch(() => null);
                emit({ type: 'progress', percent: 92 });
            }
            else {
                emit({ type: 'status', text: 'Steam not running — launching anyway…' });
                emit({ type: 'progress', percent: 92 });
            }
        }
        catch { /* silent — splash will still close */ }
        emit({ type: 'progress', percent: 100 });
        emit({ type: 'status', text: 'Ready!' });
        // Brief pause so the user sees 100% before the window appears
        await new Promise(r => setTimeout(r, 250));
    };
    // Run update check — this resolves when the flow is complete
    await (0, updater_1.performStartupUpdateCheck)(onSplashEvent, preloadFn);
    // Transition: show status "Launching…", create main window, then close splash
    call('_setStatus', 'Launching…');
    call('_hideSpinner');
    // Create main window while splash is still visible
    onReady();
    // Close splash once main window has painted.
    // Safety fallback: if ready-to-show never fires (e.g. renderer crash during
    // load), close the splash after 8 s so it doesn't stay open forever.
    const closeSplash = () => {
        if (!splash.isDestroyed())
            splash.close();
    };
    const splashFallback = setTimeout(closeSplash, 8000);
    if (mainWindow) {
        mainWindow.once('ready-to-show', () => {
            clearTimeout(splashFallback);
            setTimeout(closeSplash, 200);
        });
    }
    else {
        clearTimeout(splashFallback);
        setTimeout(closeSplash, 1000);
    }
}
// ─── Tray ─────────────────────────────────────────────────────────────────
function createTray() {
    try {
        const iconPath = getIconPath('32');
        let icon;
        try {
            icon = electron_1.nativeImage.createFromPath(iconPath);
            if (icon.isEmpty())
                icon = electron_1.nativeImage.createFromPath(getIconPath('png'));
        }
        catch {
            icon = electron_1.nativeImage.createEmpty();
        }
        tray = new electron_1.Tray(icon);
        tray.setToolTip('Souvlatzidiko-Unlocker');
        const menuIcon = (name) => {
            const b64 = trayIcons_1.TRAY_ICONS[name];
            if (!b64)
                return undefined;
            try {
                const buf = Buffer.from(b64, 'base64');
                const img = electron_1.nativeImage.createFromBuffer(buf, { scaleFactor: 1 });
                return img.isEmpty() ? undefined : img;
            }
            catch {
                return undefined;
            }
        };
        const appIcon = icon.isEmpty() ? undefined : electron_1.nativeImage.createFromPath(getIconPath('32')).resize({ width: 16, height: 16 });
        const updateMenu = () => {
            const idlingGames = exports.idleManager.getIdlingGames();
            const idlingCount = idlingGames.length;
            const idleSection = idlingCount > 0
                ? [
                    {
                        label: `Idling  ${idlingCount} game${idlingCount > 1 ? 's' : ''}`,
                        icon: menuIcon('tray_idling'),
                        click: () => { mainWindow?.show(); mainWindow?.focus(); },
                    },
                    ...idlingGames.map(g => ({
                        label: g.name.length > 30 ? g.name.slice(0, 30) + '…' : g.name,
                        icon: menuIcon('tray_game'),
                        click: () => { mainWindow?.show(); mainWindow?.focus(); },
                    })),
                    { type: 'separator' },
                    {
                        label: 'Stop All Idling',
                        icon: menuIcon('tray_stop'),
                        click: () => {
                            exports.idleManager.stopAll();
                            mainWindow?.webContents.send('idle:changed');
                            updateMenu();
                        },
                    },
                ]
                : [
                    {
                        label: 'Not idling',
                        icon: menuIcon('tray_not_idling'),
                        click: () => { mainWindow?.show(); mainWindow?.focus(); },
                    },
                ];
            const contextMenu = electron_1.Menu.buildFromTemplate([
                { label: 'Souvlatzidiko-Unlocker', enabled: false, icon: appIcon },
                { type: 'separator' },
                { label: 'Show App', icon: menuIcon('tray_show'), click: () => { mainWindow?.show(); mainWindow?.focus(); } },
                { type: 'separator' },
                ...idleSection,
                { type: 'separator' },
                { label: 'Quit', icon: menuIcon('tray_quit'), click: () => forceQuit() },
            ]);
            tray?.setContextMenu(contextMenu);
        };
        updateMenu();
        tray.on('click', () => {
            if (mainWindow?.isVisible())
                mainWindow.focus();
            else {
                mainWindow?.show();
                mainWindow?.focus();
            }
        });
        // Store interval ID so we can clear it in forceQuit()
        if (trayUpdateInterval)
            clearInterval(trayUpdateInterval);
        trayUpdateInterval = setInterval(updateMenu, 5000);
    }
    catch (e) {
        console.error('[tray] Failed to create tray:', e);
    }
}
// ─── Main window ───────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    }
    else {
        // app.getAppPath() returns the root of the asar/app folder reliably in production
        mainWindow.loadFile(path.join(electron_1.app.getAppPath(), 'dist', 'renderer', 'index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        // Trigger a silent background update check so the renderer gets
        // the updater status after the window is ready (the startup check
        // runs before the window exists, so broadcast() has no target).
        setTimeout(() => (0, updater_1.triggerBackgroundCheck)(), 3000);
    });
    mainWindow.webContents.on('console-message', (_e, level, message) => {
        if (message.includes('cdn.cloudflare.steamstatic.com'))
            return;
        if (message.includes('store.steampowered.com') && message.includes('404'))
            return;
        if (message.includes('Content-Security-Policy'))
            return;
        if (message.includes('Electron Security Warning'))
            return;
        if (level === 0 || level === 1)
            return;
        if (level === 2)
            process.stdout.write(`[renderer:warn] ${message}\n`);
        if (level === 3)
            process.stderr.write(`[renderer:error] ${message}\n`);
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('close', (e) => {
        if (isQuitting)
            return; // let it close — we're quitting
        const settings = (0, store_1.getStore)().get('settings');
        if (settings.minimizeToTray) {
            e.preventDefault();
            mainWindow?.hide();
        }
        // minimizeToTray=false: let window close normally,
        // window-all-closed will call forceQuit().
    });
    mainWindow.on('closed', () => { mainWindow = null; });
    electron_1.nativeTheme.on('updated', () => {
        mainWindow?.webContents.send('theme:changed', electron_1.nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
    });
}
// ─── Window IPC (registered ONCE, not per window instance) ──────────────────
// Registering inside createWindow() adds duplicate listeners on macOS when
// the window is re-created after being closed (via app.on('activate')).
function setupWindowIpc() {
    electron_1.ipcMain.on('window:minimize', () => mainWindow?.minimize());
    electron_1.ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow?.maximize();
    });
    electron_1.ipcMain.on('window:close', () => {
        const settings = (0, store_1.getStore)().get('settings');
        if (settings.minimizeToTray) {
            mainWindow?.hide();
        }
        else {
            forceQuit();
        }
    });
}
// ─── App lifecycle ─────────────────────────────────────────────────────────
electron_1.app.whenReady().then(async () => {
    (0, handlers_1.setupIpcHandlers)(steamClient, exports.idleManager);
    setupWindowIpc(); // Register window IPC once at startup
    await runSplashFlow(() => {
        createWindow();
        createTray();
        // setupUpdater MUST be called after the splash flow so that
        // autoUpdater.removeAllListeners() doesn't clobber the splash listeners.
        (0, updater_1.setupUpdater)();
        const settings = (0, store_1.getStore)().get('settings');
        if (settings.autoIdleGames?.length) {
            for (const game of settings.autoIdleGames) {
                try {
                    exports.idleManager.startIdle(game.appId, game.name); // Fix: pass game.name
                }
                catch (e) {
                    console.error(`[auto-idle] Failed to start ${game.appId}:`, e);
                }
            }
        }
        // Guard against duplicate 'activate' listeners on macOS
        if (!activateListenerRegistered) {
            activateListenerRegistered = true;
            electron_1.app.on('activate', () => {
                if (electron_1.BrowserWindow.getAllWindows().length === 0)
                    createWindow();
            });
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform === 'darwin')
        return;
    const settings = (0, store_1.getStore)().get('settings');
    if (tray && settings.minimizeToTray)
        return;
    forceQuit();
});
let isQuitting = false;
function forceQuit() {
    if (isQuitting)
        return;
    isQuitting = true;
    // Close the main window immediately (isQuitting=true bypasses the hide logic).
    // If window is already closed/null this is a no-op.
    mainWindow?.close();
    if (trayUpdateInterval) {
        clearInterval(trayUpdateInterval);
        trayUpdateInterval = null;
    }
    tray?.destroy();
    tray = null;
    exports.idleManager.stopAll();
    const timeout = setTimeout(() => electron_1.app.exit(0), 3000);
    steamClient.destroy()
        .catch(() => { })
        .finally(() => {
        clearTimeout(timeout);
        electron_1.app.exit(0);
    });
}
// before-quit intentionally omitted: forceQuit() is triggered by
// window-all-closed (native close) or explicitly from the IPC/tray Quit handler.
// Hooking before-quit would double-invoke forceQuit() and conflicts with
// autoUpdater.quitAndInstall() which also calls app.quit() internally.
