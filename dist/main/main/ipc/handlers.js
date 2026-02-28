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
exports.setupIpcHandlers = setupIpcHandlers;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const axios_1 = __importDefault(require("axios"));
const types_1 = require("../../shared/types");
const store_1 = require("../store");
function wrap(fn) {
    return fn()
        .then((data) => ({ success: true, data }))
        .catch((error) => ({ success: false, error: error.message }));
}
function setupIpcHandlers(steam, idle) {
    // ── Steam status ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle(types_1.IPC.CHECK_STEAM_RUNNING, () => wrap(() => steam.isSteamRunning()));
    electron_1.ipcMain.handle(types_1.IPC.GET_USER_INFO, () => wrap(() => steam.getUserInfo()));
    // ── Games ─────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle(types_1.IPC.GET_OWNED_GAMES, (_e, force) => wrap(() => steam.getOwnedGames(force)));
    electron_1.ipcMain.handle(types_1.IPC.GET_RECENT_GAMES, () => wrap(() => steam.getRecentGames()));
    // ── Achievements ──────────────────────────────────────────────────────────
    electron_1.ipcMain.handle(types_1.IPC.GET_ACHIEVEMENTS, (_e, appId) => wrap(() => steam.getAchievements(appId)));
    electron_1.ipcMain.handle(types_1.IPC.UNLOCK_ACHIEVEMENT, (_e, appId, apiName) => wrap(() => steam.setAchievement(appId, apiName, true)));
    electron_1.ipcMain.handle(types_1.IPC.LOCK_ACHIEVEMENT, (_e, appId, apiName) => wrap(() => steam.setAchievement(appId, apiName, false)));
    electron_1.ipcMain.handle(types_1.IPC.UNLOCK_ALL_ACHIEVEMENTS, (_e, appId) => wrap(() => steam.setAllAchievements(appId, true)));
    electron_1.ipcMain.handle(types_1.IPC.LOCK_ALL_ACHIEVEMENTS, (_e, appId) => wrap(() => steam.setAllAchievements(appId, false)));
    electron_1.ipcMain.handle(types_1.IPC.RESET_STATS, (_e, appId) => wrap(() => steam.resetAllStats(appId)));
    electron_1.ipcMain.handle(types_1.IPC.STOP_GAME, (_e, appId) => wrap(() => steam.stopGame(appId)));
    // ── Settings ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle(types_1.IPC.GET_SETTINGS, () => {
        try {
            return { success: true, data: (0, store_1.getStore)().get('settings') };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.SET_SETTINGS, (_e, settings) => {
        try {
            const current = (0, store_1.getStore)().get('settings');
            const merged = { ...current, ...settings };
            (0, store_1.getStore)().set('settings', merged);
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // ── Idle ──────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle(types_1.IPC.IDLE_START, (_e, appId, name) => {
        try {
            idle.startIdle(appId, name);
            return { success: true, data: idle.getIdlingAppIds() };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.IDLE_STOP, (_e, appId) => {
        try {
            idle.stopIdle(appId);
            return { success: true, data: idle.getIdlingAppIds() };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.IDLE_STATUS, () => {
        try {
            return { success: true, data: idle.getIdlingAppIds() };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // ── Notifications ────────────────────────────────────────────────────────
    electron_1.ipcMain.handle(types_1.IPC.SEND_NOTIFICATION, (_e, title, body, silent) => {
        try {
            if (!electron_1.Notification.isSupported())
                return { success: false, error: 'Not supported' };
            // Strip emoji on Windows — Segoe UI Emoji font isn’t always available in toast
            const stripEmoji = (s) => s.replace(/(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26ff]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g, '').replace(/\s{2,}/g, ' ').trim();
            const isWin = process.platform === 'win32';
            if (isWin) {
                title = stripEmoji(title);
                body = stripEmoji(body);
            }
            const iconCandidates = [
                path.join(__dirname, '../../../resources/notify.png'),
                path.join(electron_1.app.getAppPath(), 'resources/notify.png'),
                path.join(process.resourcesPath ?? '', 'notify.png'),
                // fallback to steam.png if notify.png not found
                path.join(__dirname, '../../../resources/steam.png'),
                path.join(electron_1.app.getAppPath(), 'resources/steam.png'),
            ];
            const iconPath = iconCandidates.find(p => { try {
                return fs.existsSync(p);
            }
            catch {
                return false;
            } }) ?? iconCandidates[0];
            const n = new electron_1.Notification({
                title,
                body,
                silent,
                icon: iconPath,
                // Windows-specific: show the notification for longer
                ...(isWin ? { timeoutType: 'default' } : {}),
            });
            n.show();
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // ── Steam Store Featured / Deals (proxied from main to avoid CORS) ────────
    electron_1.ipcMain.handle(types_1.IPC.GET_STEAM_FEATURED, async () => {
        try {
            const [catRes, featRes] = await Promise.allSettled([
                axios_1.default.get('https://store.steampowered.com/api/featuredcategories/?cc=us&l=english', { timeout: 8000 }),
                axios_1.default.get('https://store.steampowered.com/api/featured/?cc=us&l=english', { timeout: 8000 }),
            ]);
            const deals = [];
            const featured = [];
            const freeGames = [];
            const seen = new Set();
            const toGame = (item, type) => ({
                id: item.id,
                name: item.name,
                header_image: item.header_image ||
                    `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.id}/header.jpg`,
                discount_percent: item.discount_percent ?? 0,
                final_price: item.final_price ?? 0,
                original_price: item.original_price ?? 0,
                type: (item.final_price === 0 && item.original_price === 0) ? 'free'
                    : (item.discount_percent ?? 0) > 0 ? 'sale' : type,
                url: `https://store.steampowered.com/app/${item.id}`,
            });
            if (catRes.status === 'fulfilled') {
                // Weekly specials / deals
                const specials = catRes.value.data?.specials?.items ?? [];
                for (const item of specials.slice(0, 8)) {
                    if (!item.id || seen.has(item.id))
                        continue;
                    seen.add(item.id);
                    deals.push(toGame(item, 'sale'));
                }
                // Free This Week: free-to-play + free weekend promos
                const freePool = [
                    ...(catRes.value.data?.free_to_play?.items ?? []),
                    ...(catRes.value.data?.free_weekend?.items ?? []),
                ];
                for (const item of freePool.slice(0, 6)) {
                    if (!item.id || seen.has(item.id))
                        continue;
                    seen.add(item.id);
                    freeGames.push(toGame(item, 'free'));
                }
            }
            if (featRes.status === 'fulfilled') {
                for (const cat of ['large_capsules', 'featured_win', 'featured_mac']) {
                    const items = featRes.value.data?.[cat] ?? [];
                    for (const item of items) {
                        if (!item.id || seen.has(item.id))
                            continue;
                        seen.add(item.id);
                        featured.push(toGame(item, 'featured'));
                    }
                }
            }
            return { success: true, data: { deals: deals.slice(0, 8), featured: featured.slice(0, 6), freeGames: freeGames.slice(0, 6) } };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.SEARCH_GAMES, async (_e, term) => {
        try {
            const res = await axios_1.default.get(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=us`, { timeout: 6000 });
            const items = res.data?.items ?? [];
            const results = items
                .filter(i => i.type === 'app')
                .slice(0, 8)
                .map(i => ({
                appId: i.id,
                name: i.name,
                headerImageUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${i.id}/header.jpg`,
                tiny_image: i.tiny_image,
                price: i.price,
            }));
            return { success: true, data: results };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.RESOLVE_APP_NAME, async (_e, appId) => {
        try {
            const res = await axios_1.default.get(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`, { timeout: 6000 });
            const data = res.data?.[appId];
            if (data?.success && data?.data?.name) {
                return { success: true, data: { name: data.data.name } };
            }
            return { success: true, data: { name: `App ${appId}` } };
        }
        catch (e) {
            return { success: true, data: { name: `App ${appId}` } };
        }
    });
    // ── Autostart ─────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle(types_1.IPC.AUTOSTART_GET, () => {
        try {
            return { success: true, data: electron_1.app.getLoginItemSettings().openAtLogin };
        }
        catch {
            return { success: true, data: false };
        }
    });
    electron_1.ipcMain.handle(types_1.IPC.AUTOSTART_SET, (_e, enabled) => {
        try {
            electron_1.app.setLoginItemSettings({
                openAtLogin: enabled,
                openAsHidden: true,
            });
            return { success: true, data: enabled };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // ── Partner Apps ──────────────────────────────────────────────────────────
    const PARTNER_APPS = [
        { key: 'myle', owner: 'thomasthanos', repo: 'Make_Your_Life_Easier.A.E' },
        { key: 'gbr', owner: 'thomasthanos', repo: 'Github-Build-Release' },
        { key: 'backup', owner: 'thomasthanos', repo: 'backup_projects' },
        { key: 'discordviewer', owner: 'thomasthanos', repo: 'discord_package_viewer' },
    ];
    // Fetch latest release info for both partner apps from GitHub API
    electron_1.ipcMain.handle(types_1.IPC.GET_PARTNER_APP_RELEASES, async () => {
        try {
            const results = await Promise.all(PARTNER_APPS.map(async ({ key, owner, repo }) => {
                const res = await axios_1.default.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { timeout: 8000, headers: { Accept: 'application/vnd.github+json' } });
                const release = res.data;
                const asset = release.assets.find((a) => a.name.endsWith('.exe'));
                if (!asset)
                    throw new Error(`No .exe asset found in ${repo} latest release`);
                const version = release.tag_name.replace(/^v/, '');
                return {
                    key,
                    version,
                    downloadUrl: asset.browser_download_url,
                    fileName: asset.name,
                    sizeBytes: asset.size,
                };
            }));
            return { success: true, data: results };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // Download a partner app installer to the user's Downloads folder
    electron_1.ipcMain.handle(types_1.IPC.DOWNLOAD_PARTNER_APP, async (_e, key, url, fileName) => {
        const pushProgress = (p) => {
            for (const win of electron_1.BrowserWindow.getAllWindows()) {
                if (!win.isDestroyed())
                    win.webContents.send(types_1.IPC.PARTNER_APP_DOWNLOAD_PROGRESS, p);
            }
        };
        const destPath = path.join(electron_1.app.getPath('downloads'), fileName);
        try {
            const res = await axios_1.default.get(url, {
                responseType: 'stream',
                timeout: 0,
                headers: { Accept: 'application/octet-stream' },
                maxRedirects: 5,
            });
            const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10);
            let downloaded = 0;
            let lastPercent = -1;
            const writer = fs.createWriteStream(destPath);
            res.data.on('data', (chunk) => {
                downloaded += chunk.length;
                if (totalBytes > 0) {
                    const pct = Math.round((downloaded / totalBytes) * 100);
                    if (pct !== lastPercent) {
                        lastPercent = pct;
                        pushProgress({ key, percent: pct, done: false });
                    }
                }
            });
            await new Promise((resolve, reject) => {
                res.data.pipe(writer);
                // Use 'close' (not 'finish') — 'close' fires after the OS releases the file handle
                writer.on('close', resolve);
                writer.on('error', reject);
                res.data.on('error', reject);
            });
            pushProgress({ key, percent: 100, done: true, filePath: destPath });
            // Small grace period to ensure Windows fully releases the handle before launching
            await new Promise(r => setTimeout(r, 300));
            await electron_1.shell.openPath(destPath);
            return { success: true };
        }
        catch (e) {
            try {
                if (fs.existsSync(destPath))
                    fs.unlinkSync(destPath);
            }
            catch { }
            pushProgress({ key, percent: 0, done: true, error: e.message });
            return { success: false, error: e.message };
        }
    });
}
