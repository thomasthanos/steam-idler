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
//
// Update check and data preload run IN PARALLEL from t=0.
// The splash closes (resolve) only when BOTH are complete.
// If an update is found and downloaded, the app restarts instead.
//
function performStartupUpdateCheck(onEvent, preload) {
    return new Promise((resolve) => {
        let resolved = false; // guard: resolve() called at most once
        let willInstall = false; // update downloaded — app will restart, never resolve
        let updateDone = false; // update check finished (ok / no-update / error)
        let preloadDone = !preload; // if no preload fn treat it as already done
        let safetyTimer = null;
        const cleanup = () => {
            if (safetyTimer) {
                clearTimeout(safetyTimer);
                safetyTimer = null;
            }
            electron_updater_1.autoUpdater.removeListener('update-available', onAvailable);
            electron_updater_1.autoUpdater.removeListener('update-not-available', onNotAvailable);
            electron_updater_1.autoUpdater.removeListener('download-progress', onProgress);
            electron_updater_1.autoUpdater.removeListener('update-downloaded', onDownloaded);
            electron_updater_1.autoUpdater.removeListener('error', onError);
        };
        // Resolve only when BOTH update check and preload have finished.
        const tryResolve = () => {
            if (resolved || willInstall || !updateDone || !preloadDone)
                return;
            resolved = true;
            cleanup();
            resolve();
        };
        // ── Preload starts IMMEDIATELY at t=0, parallel with update check ────────
        if (preload) {
            preload(onEvent)
                .catch(() => { })
                .finally(() => { preloadDone = true; tryResolve(); });
        }
        // ── Update check event handlers ──────────────────────────────────
        const onAvailable = (info) => {
            onEvent({ type: 'status', text: `Update v${info.version} found — downloading…` });
            electron_updater_1.autoUpdater.downloadUpdate().catch((err) => onError(err));
            // updateDone intentionally NOT set — we wait for onDownloaded or error
        };
        const onNotAvailable = () => {
            // No update — update side is done, wait for preload if still running
            updateDone = true;
            tryResolve();
        };
        const onProgress = (p) => {
            const pct = Math.round(p.percent);
            onEvent({ type: 'progress', percent: pct });
            onEvent({ type: 'status', text: `Downloading update… ${pct}%` });
        };
        const onDownloaded = (info) => {
            willInstall = true;
            onEvent({ type: 'status', text: `v${info.version} ready — restarting…`, cls: 'success' });
            onEvent({ type: 'progress', percent: 100 });
            cleanup();
            setTimeout(() => electron_updater_1.autoUpdater.quitAndInstall(true, true), 1500);
            // resolve() is intentionally never called — app will restart
        };
        const onError = (err) => {
            const msg = cleanErrorMessage(err);
            const isNetwork = msg.includes('No internet') || msg.includes('unavailable') || msg.includes('unexpected response');
            onEvent({
                type: 'status',
                text: isNetwork ? 'No internet — skipping update check.' : `Update check failed: ${msg}`,
                cls: 'warn',
            });
            updateDone = true;
            tryResolve();
        };
        electron_updater_1.autoUpdater.on('update-available', onAvailable);
        electron_updater_1.autoUpdater.on('update-not-available', onNotAvailable);
        electron_updater_1.autoUpdater.on('download-progress', onProgress);
        electron_updater_1.autoUpdater.on('update-downloaded', onDownloaded);
        electron_updater_1.autoUpdater.on('error', onError);
        // Safety timeout — if either side hangs, open the app anyway after 12 s
        safetyTimer = setTimeout(() => {
            safetyTimer = null;
            onEvent({ type: 'status', text: 'Loading timed out — opening app.', cls: 'warn' });
            updateDone = true;
            preloadDone = true;
            tryResolve();
        }, 12000);
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
