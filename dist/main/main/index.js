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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.idleManager = void 0;
const electron_1 = require("electron");
const trayIcons_1 = require("./trayIcons");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const handlers_1 = require("./ipc/handlers");
const updater_1 = require("./updater");
const client_1 = require("./steam/client");
const idleManager_1 = require("./steam/idleManager");
const electron_store_1 = __importDefault(require("electron-store"));
const types_1 = require("../shared/types");
// ─── Set app identity FIRST — must be before any new Store() call ─────────────
electron_1.app.setName('Souvlatzidiko-Unlocker');
if (process.platform === 'win32') {
    electron_1.app.setAppUserModelId('com.steamachievementmanager.app');
}
electron_1.app.setPath('userData', path.join(electron_1.app.getPath('appData'), 'ThomasThanos', 'Souvlatzidiko-Unlocker'));
let mainWindow = null;
let tray = null;
const steamClient = new client_1.SteamClient();
exports.idleManager = new idleManager_1.IdleManager();
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// ─── Settings store ────────────────────────────────────────────────────────
const store = new electron_store_1.default({ defaults: { settings: types_1.DEFAULT_SETTINGS } });
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
        : size === '32' ? 'steam_x32.ico'
            : 'steam_x256.ico';
    const candidates = [
        path.join(__dirname, '../../../resources', filename),
        path.join(electron_1.app.getAppPath(), 'resources', filename),
        path.join(process.resourcesPath ?? '', filename),
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
    splash.once('ready-to-show', () => splash.show());
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
    // Run update check — this resolves when the flow is complete
    await (0, updater_1.performStartupUpdateCheck)(onSplashEvent);
    // Transition: show status "Launching…", create main window, then close splash
    call('_setStatus', 'Launching…');
    call('_hideSpinner');
    // Create main window while splash is still visible
    onReady();
    // Close splash once main window has painted (or after a short delay)
    const closeSplash = () => {
        if (!splash.isDestroyed()) {
            splash.close();
        }
    };
    if (mainWindow) {
        mainWindow.once('ready-to-show', () => {
            setTimeout(closeSplash, 200);
        });
    }
    else {
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
                { label: 'Quit', icon: menuIcon('tray_quit'), click: () => { tray?.destroy(); exports.idleManager.stopAll(); electron_1.app.exit(0); } },
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
        setInterval(updateMenu, 5000);
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
        const settings = store.get('settings');
        if (settings.minimizeToTray) {
            e.preventDefault();
            mainWindow?.hide();
        }
    });
    mainWindow.on('closed', () => { mainWindow = null; });
    electron_1.ipcMain.on('window:minimize', () => mainWindow?.minimize());
    electron_1.ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow?.maximize();
    });
    electron_1.ipcMain.on('window:close', () => {
        const settings = store.get('settings');
        if (settings.minimizeToTray)
            mainWindow?.hide();
        else
            mainWindow?.close();
    });
    electron_1.nativeTheme.on('updated', () => {
        mainWindow?.webContents.send('theme:changed', electron_1.nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
    });
}
// ─── App lifecycle ─────────────────────────────────────────────────────────
electron_1.app.whenReady().then(async () => {
    (0, handlers_1.setupIpcHandlers)(steamClient, exports.idleManager);
    (0, updater_1.setupUpdater)();
    await runSplashFlow(() => {
        createWindow();
        createTray();
        const settings = store.get('settings');
        if (settings.autoIdleGames?.length) {
            for (const game of settings.autoIdleGames) {
                try {
                    exports.idleManager.startIdle(game.appId);
                }
                catch (e) {
                    console.error(`[auto-idle] Failed to start ${game.appId}:`, e);
                }
            }
        }
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0)
                createWindow();
        });
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform === 'darwin')
        return;
    const settings = store.get('settings');
    if (tray && settings.minimizeToTray)
        return;
    forceQuit();
});
let isQuitting = false;
function forceQuit() {
    if (isQuitting)
        return;
    isQuitting = true;
    exports.idleManager.stopAll();
    // destroy with timeout so we never hang
    const timeout = setTimeout(() => electron_1.app.exit(0), 3000);
    steamClient.destroy()
        .catch(() => { })
        .finally(() => {
        clearTimeout(timeout);
        electron_1.app.exit(0);
    });
}
electron_1.app.on('before-quit', () => {
    forceQuit();
});
