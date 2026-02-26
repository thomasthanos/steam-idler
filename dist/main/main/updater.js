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
Object.defineProperty(exports, "__esModule", { value: true });
exports.performStartupUpdateCheck = performStartupUpdateCheck;
exports.triggerBackgroundCheck = triggerBackgroundCheck;
exports.setupUpdater = setupUpdater;
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const types_1 = require("../shared/types");
// ─── Configure ────────────────────────────────────────────────────────────────
// autoDownload = false globally: we call downloadUpdate() manually so we can
// show progress. The splash flow downloads on startup; the background check
// (after window is shown) also auto-downloads silently so the user only
// needs to approve the restart.
// autoInstallOnAppQuit ensures the update is applied when the user quits normally.
electron_updater_1.autoUpdater.autoDownload = false; // we call downloadUpdate() manually for control
electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
electron_updater_1.autoUpdater.allowPrerelease = false;
electron_updater_1.autoUpdater.logger = null;
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
function performStartupUpdateCheck(onEvent, preload) {
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
            // autoDownload = false globally, so we trigger the download manually here
            // (only during the splash flow — background checks require a user click)
            electron_updater_1.autoUpdater.downloadUpdate().catch((err) => onError(err));
        };
        const onNotAvailable = () => {
            onEvent({ type: 'status', text: 'Up to date.' });
            if (preload) {
                // Use the splash window time to preload data in the background
                preload(onEvent).catch(() => { }).finally(() => done());
            }
            else {
                setTimeout(done, 600);
            }
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
        // Auto-download silently — user only needs to confirm the restart
        electron_updater_1.autoUpdater.downloadUpdate().catch((err) => {
            broadcast({ status: 'error', message: cleanErrorMessage(err) });
        });
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
        // Fully automatic — restart & install after a 3-second grace period
        // so the user can see the "restarting" message before the app closes.
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
    // UPDATER_INSTALL is kept for IPC compatibility but is now a no-op.
    // The download is triggered automatically by the 'update-available' event.
    // Calling downloadUpdate() here again would cause a duplicate download.
    electron_1.ipcMain.handle(types_1.IPC.UPDATER_INSTALL, async () => {
        return { success: true };
    });
    electron_1.ipcMain.handle(types_1.IPC.UPDATER_RESTART, () => {
        electron_updater_1.autoUpdater.quitAndInstall(true, true);
    });
}
