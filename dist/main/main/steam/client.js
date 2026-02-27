"use strict";
/**
 * client.ts  –  Main process Steam client
 *
 * Architecture (same as SAM):
 *  ┌─────────────────────────────┐
 *  │  Main Process (this file)   │
 *  │  - reads local Steam files  │
 *  │  - manages worker process   │
 *  └──────────┬──────────────────┘
 *             │ stdin/stdout JSON-lines
 *  ┌──────────▼──────────────────┐
 *  │  Worker Process             │  ← separate child process per game
 *  │  SteamAppId = <appId>       │    (mirrors SAM.Game.exe concept)
 *  │  sw.init(appId)             │
 *  │  sw.achievement.*           │
 *  │  sw.stats.*                 │
 *  └─────────────────────────────┘
 *
 * Game list comes from local steamapps/*.acf files — no Web API key needed.
 * Achievement schema comes from the free public Steam Web API endpoint.
 *
 * NOTE: We deliberately avoid sw.init(480) in the main process to prevent
 * Steam from showing "Spacewar" as currently playing.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SteamClient = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const axios_1 = __importDefault(require("axios"));
const steamPaths_1 = require("./steamPaths");
const store_1 = require("../store");
// ─── Persistent settings ───────────────────────────────────────────────────
// Uses the shared lazy singleton from store.ts so that app.setPath('userData')
// in index.ts is guaranteed to have run before the store is first opened.
// A local `new Store()` at module-level would be created during the import
// phase — before app.setPath() executes — and would therefore resolve to the
// wrong (default Electron) userData directory.
function getSettings() { return (0, store_1.getStore)().get('settings'); }
// ─── Games cache ────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
// Bump this whenever the shape of cached data changes so stale caches are
// automatically invalidated on the next launch instead of showing wrong data.
const CACHE_VERSION = 2;
function getCachedGames() {
    const cached = (0, store_1.getStore)().get('gamesCache');
    if (!cached)
        return null;
    if (cached.version !== CACHE_VERSION)
        return null; // schema changed
    if (Date.now() - cached.timestamp > CACHE_TTL_MS)
        return null;
    return cached.data;
}
function setCachedGames(data) {
    (0, store_1.getStore)().set('gamesCache', { data, timestamp: Date.now(), version: CACHE_VERSION });
}
function clearGamesCache() {
    (0, store_1.getStore)().delete('gamesCache');
}
class WorkerBridge {
    constructor() {
        this.proc = null;
        this.pending = new Map();
        this.msgId = 0;
        this.buffer = '';
        this.currentAppId = 0;
        this.lastApiKey = '';
        // Mutex: prevents concurrent ensure() calls from spawning two workers
        this.initPromise = null;
    }
    get workerPath() {
        // In a packaged app, worker.js is extracted from app.asar into
        // app.asar.unpacked so it can be spawned as a child process.
        // In dev, __dirname does not contain 'app.asar' so the replace is a no-op.
        return path.join(__dirname, 'worker.js')
            .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
    }
    async ensure(appId) {
        // If an init is already in-flight, wait for it to complete before checking
        if (this.initPromise)
            await this.initPromise;
        const settings = getSettings();
        const apiKey = settings.steamApiKey ?? '';
        if (this.proc && this.currentAppId === appId && this.lastApiKey === apiKey)
            return;
        // Wrap the actual spawn work in a promise and store it so concurrent
        // callers wait instead of spawning a second worker.
        this.initPromise = this._doEnsure(appId, apiKey);
        try {
            await this.initPromise;
        }
        finally {
            this.initPromise = null;
        }
    }
    async _doEnsure(appId, apiKey) {
        await this.kill();
        const proc = (0, child_process_1.spawn)(process.execPath, [this.workerPath], {
            env: { ...process.env, SteamAppId: String(appId), ELECTRON_RUN_AS_NODE: '1', ELECTRON_NO_ASAR: '1' },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.proc = proc;
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (chunk) => {
            console.error(`[worker stderr] ${chunk.trim()}`);
        });
        this.currentAppId = appId;
        this.lastApiKey = apiKey;
        this.buffer = '';
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (chunk) => {
            this.buffer += chunk;
            const lines = this.buffer.split('\n');
            this.buffer = lines.pop() ?? '';
            for (const line of lines) {
                const t = line.trim();
                if (!t)
                    continue;
                try {
                    const msg = JSON.parse(t);
                    const cb = this.pending.get(msg.id);
                    if (!cb)
                        continue;
                    this.pending.delete(msg.id);
                    if (msg.ok)
                        cb.resolve(msg.data);
                    else
                        cb.reject(new Error(msg.error ?? 'Worker error'));
                }
                catch { /* ignore malformed */ }
            }
        });
        proc.on('exit', (code, signal) => {
            console.error(`[worker] exited with code=${code} signal=${signal}`);
            // Only clean up if this proc is still the active one (kill() may have already nulled it)
            if (this.proc === proc) {
                this.proc = null;
                this.currentAppId = 0;
                this.lastApiKey = '';
                for (const [, cb] of this.pending) {
                    cb.reject(new Error('Steam worker process exited unexpectedly'));
                }
                this.pending.clear();
            }
        });
        const INIT_TIMEOUT_MS = 25000;
        let initTimeoutHandle = null;
        try {
            await Promise.race([
                this.send({ type: 'INIT', appId, apiKey: apiKey || undefined }, proc),
                new Promise((_, reject) => {
                    initTimeoutHandle = setTimeout(() => {
                        initTimeoutHandle = null;
                        try {
                            proc.kill();
                        }
                        catch { /* ok */ }
                        reject(new Error('Steam initialization timed out. Make sure Steam is running.'));
                    }, INIT_TIMEOUT_MS);
                }),
            ]);
        }
        finally {
            // CRITICAL: always clear the kill-timer when INIT finishes — whether it
            // succeeded or failed. Without this, the setTimeout fires 25 s after a
            // *successful* INIT and sends SIGTERM to an otherwise healthy worker.
            if (initTimeoutHandle !== null) {
                clearTimeout(initTimeoutHandle);
                initTimeoutHandle = null;
            }
        }
    }
    send(msg, targetProc) {
        return new Promise((resolve, reject) => {
            const p = targetProc ?? this.proc;
            if (!p) {
                reject(new Error('Worker not running'));
                return;
            }
            // Guard: stdin may be closed if kill() was called concurrently
            if (!p.stdin || !p.stdin.writable) {
                reject(new Error('Worker stdin is closed'));
                return;
            }
            const id = ++this.msgId;
            this.pending.set(id, { resolve, reject });
            try {
                p.stdin.write(JSON.stringify({ ...msg, id }) + '\n');
            }
            catch (err) {
                this.pending.delete(id);
                reject(err);
            }
        });
    }
    async kill() {
        if (!this.proc)
            return;
        const proc = this.proc;
        // Null out immediately so any concurrent send() sees no proc
        this.proc = null;
        this.currentAppId = 0;
        this.lastApiKey = '';
        // Reject all pending calls
        for (const [, cb] of this.pending) {
            cb.reject(new Error('Worker stopped'));
        }
        this.pending.clear();
        try {
            proc.stdin.end();
        }
        catch { /* ok */ }
        await new Promise((r) => {
            const t = setTimeout(() => { proc.kill(); r(); }, 3000);
            proc.once('exit', () => { clearTimeout(t); r(); });
        });
    }
}
const worker = new WorkerBridge();
// ─── Helpers ────────────────────────────────────────────────────────────────
/** Parse comma-separated customAppIds setting → number[] */
function parseCustomAppIds(raw) {
    if (!raw?.trim())
        return [];
    return raw.split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => Number.isFinite(n) && n > 0);
}
/** Try to resolve a game name from the Steam Store API. Returns null on failure. */
async function fetchStoreName(appId) {
    try {
        const res = await axios_1.default.get(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`, { timeout: 5000 });
        const data = res?.data?.[appId];
        if (data?.success && data?.data?.name)
            return data.data.name;
    }
    catch { /* network/timeout */ }
    return null;
}
/** Check if Steam is running via OS process list (avoids steamworks init / Spacewar) */
function detectSteamProcess() {
    try {
        if (process.platform === 'win32') {
            const out = (0, child_process_1.execSync)('tasklist /FI "IMAGENAME eq steam.exe" /NH', {
                timeout: 3000,
                windowsHide: true,
            }).toString();
            return out.toLowerCase().includes('steam.exe');
        }
        else if (process.platform === 'darwin') {
            const out = (0, child_process_1.execSync)('pgrep -x steam || pgrep -x Steam', { timeout: 3000 }).toString();
            return out.trim().length > 0;
        }
        else {
            const out = (0, child_process_1.execSync)('pgrep -x steam', { timeout: 3000 }).toString();
            return out.trim().length > 0;
        }
    }
    catch {
        return false;
    }
}
// ─── SteamClient (main-process API) ────────────────────────────────────────
class SteamClient {
    // ── Steam Running ─────────────────────────────────────────────────────────
    // Uses process detection instead of sw.init(480) to avoid "Spacewar" appearing.
    async isSteamRunning() {
        return detectSteamProcess();
    }
    // ── User Info ─────────────────────────────────────────────────────────────
    async getUserInfo() {
        const settings = getSettings();
        let steamId64 = settings.steamId || '';
        let personaName = 'Steam User';
        let level = 0;
        // Try to get steamId from login users file (no steamworks init needed)
        if (!steamId64) {
            try {
                const users = (0, steamPaths_1.readLoginUsers)((0, steamPaths_1.getSteamPath)());
                const recent = users[0];
                if (recent) {
                    steamId64 = recent.steamId64;
                    personaName = recent.personaName;
                }
            }
            catch { /* ok */ }
        }
        let avatarUrl = '';
        // Use Steam Web API if key available
        if (settings.steamApiKey && steamId64) {
            try {
                const res = await axios_1.default.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${settings.steamApiKey}&steamids=${steamId64}`, { timeout: 5000 });
                const player = res?.data?.response?.players?.[0];
                if (player?.avatarfull)
                    avatarUrl = player.avatarfull;
                if (player?.personaname)
                    personaName = player.personaname;
            }
            catch { /* keep defaults */ }
        }
        // Always ensure we have a fallback avatar — even if no steamId was found
        if (!avatarUrl) {
            const initials = personaName.slice(0, 2).toUpperCase() || 'ST';
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1a9fff&color=fff&size=128&bold=true`;
        }
        return {
            steamId: steamId64,
            personaName,
            avatarUrl,
            profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
            level,
        };
    }
    // ── Owned Games ───────────────────────────────────────────────────────────
    async getOwnedGames(force = false) {
        if (!force) {
            const cached = getCachedGames();
            if (cached)
                return cached;
        }
        const steamPath = (0, steamPaths_1.getSteamPath)();
        const settings = getSettings();
        const customAppIds = parseCustomAppIds(settings.customAppIds);
        // ── 1. Read locally installed games from ACF files ──────────────────────
        let installed = [];
        try {
            installed = (0, steamPaths_1.readInstalledApps)(steamPath);
        }
        catch (e) {
            console.warn('[getOwnedGames] Failed to read installed apps:', e);
        }
        const gamesMap = new Map();
        const SKIP_NAMES = /redistributable|soundtrack|dedicated server|obs studio|wallpaper engine|desktop mate|proton|steamworks/i;
        const SKIP_APPIDS = new Set([228980, 1826330, 2434870, 1905180, 431960, 3301060]);
        const addGame = (appId, name, playtime = 0, lastPlayed = 0, forceShow = false) => {
            if (!forceShow && (SKIP_APPIDS.has(appId) || SKIP_NAMES.test(name)))
                return;
            if (!gamesMap.has(appId)) {
                gamesMap.set(appId, {
                    appId, name,
                    iconUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
                    headerImageUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
                    playtimeForever: playtime,
                    achievementCount: 0, achievementsUnlocked: 0, achievementPercentage: 0,
                    lastPlayed,
                });
            }
        };
        for (const app of installed) {
            addGame(app.appId, app.name, 0, app.lastPlayed);
        }
        // ── 2. Force-add custom AppIDs ──────────────────────────────────────────
        const customToResolve = customAppIds.filter(id => !gamesMap.has(id));
        await Promise.allSettled(customToResolve.map(async (id) => {
            const name = (await fetchStoreName(id)) ?? `App ${id}`;
            addGame(id, name, 0, 0, true);
        }));
        // ── 3. Fetch full owned games list from Steam Web API ───────────────────
        let steamId64 = settings.steamId || '';
        const webApiAppIds = new Set();
        if (settings.steamApiKey) {
            try {
                if (!steamId64) {
                    const users = (0, steamPaths_1.readLoginUsers)(steamPath);
                    if (users[0])
                        steamId64 = users[0].steamId64;
                }
                if (!steamId64)
                    throw new Error('No Steam ID found');
                const res = await axios_1.default.get(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${settings.steamApiKey}&steamid=${steamId64}&include_appinfo=1&include_played_free_games=1`, { timeout: 10000 });
                const webGames = res?.data?.response?.games ?? [];
                for (const wg of webGames) {
                    addGame(wg.appid, wg.name, wg.playtime_forever, wg.rtime_last_played);
                    webApiAppIds.add(wg.appid);
                }
                // ── 4. Fetch achievement counts ─────────────────────────────────────
                //
                // Strategy:
                //   Pass B — GetPlayerAchievements for played/installed/custom games.
                //     Fast, accurate unlock counts. Fails on private profiles.
                //   Pass A — GetSchemaForGame ONLY for games still showing 0 after Pass B.
                //     Catches private-profile games and games with 0 playtime.
                //     Smaller set = no rate-limit issues.
                const allGameIds = Array.from(gamesMap.keys());
                // Pass B first: player unlock state for played/installed games
                const playedIds = allGameIds.filter(id => customAppIds.includes(id) ||
                    (gamesMap.get(id).playtimeForever > 0) ||
                    installed.some(ia => ia.appId === id));
                for (let i = 0; i < playedIds.length; i += 10) {
                    const chunk = playedIds.slice(i, i + 10);
                    await Promise.allSettled(chunk.map(async (appid) => {
                        try {
                            const achRes = await axios_1.default.get(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${settings.steamApiKey}&steamid=${steamId64}&appid=${appid}`, { timeout: 5000 });
                            const achs = achRes?.data?.playerstats?.achievements ?? [];
                            if (achs.length > 0) {
                                const game = gamesMap.get(appid);
                                if (game) {
                                    game.achievementCount = achs.length;
                                    game.achievementsUnlocked = achs.filter(a => a.achieved === 1).length;
                                    game.achievementPercentage = Math.round((game.achievementsUnlocked / game.achievementCount) * 100);
                                }
                            }
                        }
                        catch { /* private profile or no stats — Pass A will cover these */ }
                    }));
                }
                // Pass A: schema fallback for any played/installed game still showing 0
                // (private profile, API error, etc). NOT run for unplayed games to
                // avoid hammering the API with hundreds of requests.
                const stillZeroIds = playedIds.filter(id => gamesMap.get(id).achievementCount === 0);
                for (let i = 0; i < stillZeroIds.length; i += 10) {
                    const chunk = stillZeroIds.slice(i, i + 10);
                    await Promise.allSettled(chunk.map(async (appid) => {
                        try {
                            const schRes = await axios_1.default.get(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${settings.steamApiKey}&appid=${appid}&l=english`, { timeout: 6000 });
                            const achs = schRes?.data?.game?.availableGameStats?.achievements ?? [];
                            if (achs.length > 0) {
                                const game = gamesMap.get(appid);
                                if (game)
                                    game.achievementCount = achs.length;
                            }
                        }
                        catch { /* game genuinely has no achievements */ }
                    }));
                }
            }
            catch (e) {
                console.warn('[getOwnedGames] Steam Web API error:', e);
            }
        }
        // ── 5. Final filter ─────────────────────────────────────────────────────
        let finalGames = Array.from(gamesMap.values());
        // Only show games that have achievements, or are explicitly added via
        // customAppIds (user may want to idle a game with no achievements).
        const hasAnyStats = finalGames.some(g => g.achievementCount > 0);
        if (hasAnyStats) {
            finalGames = finalGames.filter(g => g.achievementCount > 0 || customAppIds.includes(g.appId));
        }
        const result = finalGames.sort((a, b) => a.name.localeCompare(b.name));
        setCachedGames(result);
        return result;
    }
    // ── Achievements ──────────────────────────────────────────────────────────
    async getAchievements(appId) {
        await worker.ensure(appId);
        return worker.send({ type: 'GET_ACHIEVEMENTS' });
    }
    async setAchievement(appId, apiName, unlocked) {
        await worker.ensure(appId);
        let result;
        try {
            result = await worker.send({ type: 'SET_ACHIEVEMENT', apiName, unlocked });
        }
        catch (firstErr) {
            const msg = firstErr.message ?? '';
            // The worker sends STATS_NOT_RECEIVED_SENTINEL when activate() returns
            // false on every attempt, meaning UserStatsReceived never fired for this
            // session (e.g. Steam didn't ack the initial RequestCurrentStats). Kill
            // the worker and respawn it — the fresh init triggers a new stats request
            // which typically succeeds on the second try.
            if (msg === 'STATS_NOT_RECEIVED') {
                console.error('[client] Worker reported stats not received — restarting worker for retry');
                await worker.kill();
                // Brief pause lets Steam fully deregister the previous session before
                // we open a new one for the same appId.
                await new Promise(r => setTimeout(r, 800));
                await worker.ensure(appId);
                result = await worker.send({ type: 'SET_ACHIEVEMENT', apiName, unlocked });
            }
            else {
                throw firstErr;
            }
        }
        return (result ?? {});
    }
    async setAllAchievements(appId, unlocked) {
        await worker.ensure(appId);
        await worker.send({ type: 'SET_ALL_ACHIEVEMENTS', unlocked });
    }
    async resetAllStats(appId) {
        await worker.ensure(appId);
        await worker.send({ type: 'RESET_STATS' });
    }
    // ── Stop current game (kill worker) ────────────────────────────────────────
    // Accepts an optional appId — if provided, only kills the worker if it is
    // still running *that* game. This prevents a delayed cleanup from a
    // previously-viewed game from killing the worker that was just spawned for
    // the new game the user navigated to.
    async stopGame(appId) {
        if (appId !== undefined && worker.currentAppId !== appId)
            return;
        await worker.kill();
    }
    // ── Cleanup ───────────────────────────────────────────────────────────────
    async destroy() {
        await worker.kill();
    }
}
exports.SteamClient = SteamClient;
