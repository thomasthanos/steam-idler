"use strict";
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
exports.performStartupUpdateCheck = performStartupUpdateCheck;
exports.triggerBackgroundCheck = triggerBackgroundCheck;
exports.setupUpdater = setupUpdater;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const electron_updater_1 = require("electron-updater");
const types_1 = require("../shared/types");
// ─── Configure ────────────────────────────────────────────────────────────────
electron_updater_1.autoUpdater.autoDownload = true;
electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
electron_updater_1.autoUpdater.allowPrerelease = false;
electron_updater_1.autoUpdater.logger = null;
// Store downloaded update installers under Roaming\ThomasThanos\Souvlatzidiko-Unlocker\updater
electron_updater_1.autoUpdater.cachePath = path.join(electron_1.app.getPath('appData'), 'ThomasThanos', 'Souvlatzidiko-Unlocker', 'updater');
// ─── Clean error messages (strip HTML bodies, truncate) ─────────────────────
function cleanErrorMessage(err) {
    const raw = err?.message ?? String(err);
    // If it contains HTML (e.g. GitHub 504 page), just return a clean message
    if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
        const statusMatch = raw.match(/(\d{3})/);
        const code = statusMatch ? statusMatch[1] : '';
        if (code === '504' || code === '502' || code === '503')
            return `GitHub servers unavailable (${code}). Try again later.`;
        return 'Update server returned an unexpected response.';
    }
    if (raw.includes('net::ERR') || raw.includes('ENOTFOUND') || raw.includes('ETIMEDOUT'))
        return 'No internet connection.';
    if (raw.includes('ECONNREFUSED') || raw.includes('EAI_AGAIN'))
        return 'Could not reach update server.';
    // Truncate long messages
    return raw.length > 120 ? raw.slice(0, 120) + '…' : raw;
}
// ─── Broadcast to all renderer windows (used after app loads) ─────────────────
function broadcast(state) {
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send(types_1.IPC.UPDATER_STATUS, state);
        }
    }
}
// ─── performStartupUpdateCheck ────────────────────────────────────────────────
function performStartupUpdateCheck(onEvent) {
    return new Promise((resolve) => {
        let finished = false;
        let timeoutHandle = null;
        const done = () => {
            if (finished)
                return;
            finished = true;
            if (timeoutHandle)
                clearTimeout(timeoutHandle);
            cleanup();
            resolve();
        };
        const cleanup = () => {
            electron_updater_1.autoUpdater.removeListener('update-available', onAvailable);
            electron_updater_1.autoUpdater.removeListener('update-not-available', onNotAvailable);
            electron_updater_1.autoUpdater.removeListener('download-progress', onProgress);
            electron_updater_1.autoUpdater.removeListener('update-downloaded', onDownloaded);
            electron_updater_1.autoUpdater.removeListener('error', onError);
        };
        const onAvailable = (info) => {
            if (timeoutHandle)
                clearTimeout(timeoutHandle);
            onEvent({ type: 'status', text: `Downloading v${info.version}…` });
            electron_updater_1.autoUpdater.downloadUpdate().catch(() => done());
        };
        const onNotAvailable = () => {
            onEvent({ type: 'status', text: 'Up to date.' });
            setTimeout(done, 600);
        };
        const onProgress = (p) => {
            const pct = Math.round(p.percent);
            onEvent({ type: 'progress', percent: pct });
            onEvent({ type: 'status', text: `Downloading… ${pct}%` });
        };
        const onDownloaded = (info) => {
            onEvent({ type: 'status', text: `v${info.version} ready — restarting…`, cls: 'success' });
            onEvent({ type: 'progress', percent: 100 });
            cleanup();
            setTimeout(() => electron_updater_1.autoUpdater.quitAndInstall(true, true), 1500);
            // resolve never called — app will restart
        };
        const onError = (err) => {
            const msg = cleanErrorMessage(err);
            const isNetwork = msg.includes('No internet') || msg.includes('unavailable') || msg.includes('unexpected response');
            onEvent({
                type: 'status',
                text: isNetwork ? 'No internet — skipping update.' : `Update check failed: ${msg}`,
                cls: 'warn',
            });
            setTimeout(done, 800);
        };
        electron_updater_1.autoUpdater.on('update-available', onAvailable);
        electron_updater_1.autoUpdater.on('update-not-available', onNotAvailable);
        electron_updater_1.autoUpdater.on('download-progress', onProgress);
        electron_updater_1.autoUpdater.on('update-downloaded', onDownloaded);
        electron_updater_1.autoUpdater.on('error', onError);
        // Safety timeout — if no event fires within 8s, continue anyway
        timeoutHandle = setTimeout(() => {
            onEvent({ type: 'status', text: 'Update check timed out.', cls: 'warn' });
            done();
        }, 8000);
        onEvent({ type: 'status', text: 'Checking for updates…' });
        electron_updater_1.autoUpdater.checkForUpdates().catch((err) => onError(err));
    });
}
// ─── triggerBackgroundCheck — silent re-check after main window is ready ────────
function triggerBackgroundCheck() {
    electron_updater_1.autoUpdater.checkForUpdates().catch(() => { });
}
// ─── setupUpdater — wires IPC + broadcast for the main app window ─────────────
function setupUpdater() {
    electron_updater_1.autoUpdater.removeAllListeners();
    electron_updater_1.autoUpdater.on('checking-for-update', () => broadcast({ status: 'checking' }));
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        const notes = Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map((n) => (typeof n === 'string' ? n : n?.note ?? '')).join('\n')
            : typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined;
        broadcast({ status: 'available', version: info.version, releaseNotes: notes });
    });
    electron_updater_1.autoUpdater.on('update-not-available', (info) => {
        broadcast({ status: 'not-available', version: info.version });
    });
    electron_updater_1.autoUpdater.on('download-progress', (p) => {
        const version = electron_updater_1.autoUpdater.updateInfo?.version ?? '…';
        broadcast({ status: 'downloading', percent: Math.round(p.percent), version });
    });
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        broadcast({ status: 'downloaded', version: info.version });
        // Auto-install 3 seconds after download completes
        setTimeout(() => electron_updater_1.autoUpdater.quitAndInstall(true, true), 3000);
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        broadcast({ status: 'error', message: cleanErrorMessage(err) });
    });
    electron_1.ipcMain.handle(types_1.IPC.UPDATER_CHECK, async () => {
        try {
            await electron_updater_1.autoUpdater.checkForUpdates();
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.UPDATER_INSTALL, async () => {
        try {
            await electron_updater_1.autoUpdater.downloadUpdate();
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.UPDATER_RESTART, () => {
        electron_updater_1.autoUpdater.quitAndInstall(true, true);
    });
}
