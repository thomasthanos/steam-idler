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
exports.STATS_NOT_RECEIVED_SENTINEL = void 0;
const sw = __importStar(require("steamworks.js"));
const axios_1 = __importDefault(require("axios"));
// runCallbacks is typed via src/main/steam/steamworks-types.d.ts (module augmentation).
// That file is a compile-time-only .d.ts — no runtime import needed or possible.
const { runCallbacks } = sw;
// ─── State ──────────────────────────────────────────────────────────────────
let client = null;
let currentAppId = 0;
let storedApiKey = '';
// Set to true once UserStatsReceived has been observed (activate/isActivated
// work correctly). Used to gate achievement writes without blind time waits.
let statsReady = false;
function send(id, ok, data, error) {
    process.stdout.write(JSON.stringify({ id, ok, data, error }) + '\n');
}
// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchSchema(appId, apiKey) {
    const url = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}&l=english`;
    const res = await axios_1.default.get(url, { timeout: 10000 });
    const stats = res?.data?.game?.availableGameStats;
    return {
        achievements: (stats?.achievements ?? []),
        stats: (stats?.stats ?? []),
    };
}
// ─── Handlers ────────────────────────────────────────────────────────────────
function handleInit(id, appId, apiKey) {
    try {
        console.error(`[worker] INIT appId=${appId}, pid=${process.pid}`);
        process.env['SteamAppId'] = String(appId);
        client = sw.init(appId);
        currentAppId = appId;
        if (apiKey)
            storedApiKey = apiKey;
        try {
            const steamId = client.localplayer.getSteamId().steamId64.toString();
            console.error(`[worker] Steam OK, SteamID=${steamId}`);
        }
        catch (e) {
            console.error(`[worker] localplayer check failed:`, e);
        }
        // Probe for UserStatsReceived by watching whether isActivated() stops
        // throwing / starts returning a stable boolean. sw.init() already starts
        // its own 30 fps runCallbacks interval internally, so we don't need to
        // pump manually — we just poll the result.
        //
        // Detection strategy:
        //   • Call client.stats.getInt() with a dummy name. Returns null when
        //     stats haven't arrived AND for genuinely missing stat names. Not
        //     enough on its own.
        //   • Call client.achievement.isActivated() with a dummy name. After
        //     UserStatsReceived fires it returns false (unknown name) without
        //     throwing. Before that, it may throw or behave erratically in some
        //     SDK versions. Catching and counting stable-false runs works.
        //   • Hard timeout of MAX_WAIT_MS: declare ready anyway so callers can
        //     attempt their operation (they have their own retry loop).
        statsReady = false;
        const MAX_WAIT_MS = 6000;
        const TICK_MS = 150;
        const started = Date.now();
        let stableCount = 0; // consecutive stable (non-throw) probe results
        const STABLE_NEEDED = 3; // need 3 stable ticks in a row ≈ 450 ms stable
        const waitForStats = () => {
            const elapsed = Date.now() - started;
            // Probe: isActivated on a known-invalid name throws before stats are
            // ready on some games; returns false once ready.
            let probeOk = false;
            try {
                client.achievement.isActivated('__sw_probe__');
                probeOk = true;
            }
            catch {
                probeOk = false;
            }
            if (probeOk) {
                stableCount++;
            }
            else {
                stableCount = 0;
            }
            if (stableCount >= STABLE_NEEDED || elapsed >= MAX_WAIT_MS) {
                statsReady = true;
                console.error(`[worker] Stats ready after ${elapsed}ms (stable=${stableCount}, timeout=${elapsed >= MAX_WAIT_MS})`);
                startCallbackLoop();
                send(id, true, { appId });
                return;
            }
            setTimeout(waitForStats, TICK_MS);
        };
        setTimeout(waitForStats, TICK_MS);
    }
    catch (e) {
        console.error(`[worker] INIT failed:`, e);
        send(id, false, undefined, e.message);
    }
}
async function handleGetAchievements(id) {
    if (!client) {
        send(id, false, undefined, 'Not initialised');
        return;
    }
    if (!storedApiKey) {
        send(id, false, undefined, 'Steam API key required to load achievements. Add one in Settings.');
        return;
    }
    try {
        const schema = await fetchSchema(currentAppId, storedApiKey);
        if (schema.achievements.length === 0) {
            send(id, true, []);
            return;
        }
        // Global percentages
        let globalPct = {};
        try {
            const url = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${currentAppId}`;
            const res = await axios_1.default.get(url, { timeout: 6000 });
            const list = res?.data?.achievementpercentages?.achievements ?? [];
            globalPct = Object.fromEntries(list.map((a) => [a.name, a.percent]));
        }
        catch { /* optional */ }
        // Per-player unlock state via Web API
        let webAchMap = {};
        try {
            const steamId = client.localplayer.getSteamId().steamId64.toString();
            const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/` +
                `?key=${storedApiKey}&steamid=${steamId}&appid=${currentAppId}&l=english`;
            const res = await axios_1.default.get(url, { timeout: 8000 });
            const list = res?.data?.playerstats?.achievements ?? [];
            webAchMap = Object.fromEntries(list.map((a) => [a.apiname, { achieved: a.achieved === 1, unlocktime: a.unlocktime }]));
        }
        catch { /* fall back to local steamworks */ }
        const achievements = schema.achievements.map((s) => {
            const web = webAchMap[s.name];
            const unlocked = web !== undefined ? web.achieved : client.achievement.isActivated(s.name);
            const unlockedAt = web?.unlocktime && web.unlocktime > 0 ? web.unlocktime : undefined;
            return {
                apiName: s.name,
                displayName: s.displayName || s.name,
                description: s.description || '',
                iconUrl: s.icon,
                iconGrayUrl: s.icongray,
                unlocked,
                unlockedAt,
                globalPercent: globalPct[s.name],
                hidden: s.hidden === 1,
            };
        });
        send(id, true, achievements);
    }
    catch (e) {
        send(id, false, undefined, e.message);
    }
}
// Sentinel returned when activate() persistently returns false, signalling
// the caller (client.ts) to restart the worker and retry.
exports.STATS_NOT_RECEIVED_SENTINEL = 'STATS_NOT_RECEIVED';
async function handleSetAchievement(id, apiName, unlocked) {
    console.error(`[worker] SET_ACHIEVEMENT: ${apiName} -> unlocked=${unlocked}, client=${!!client}, statsReady=${statsReady}`);
    if (!client) {
        send(id, false, undefined, 'Not initialised');
        return;
    }
    try {
        // Fast-fail pass: if we have 4 consecutive false returns in a row before
        // any success, UserStatsReceived never arrived for this session. Signal
        // the caller to restart the worker (fresh RequestCurrentStats) and retry.
        const FAST_FAIL_ATTEMPTS = 4;
        const RETRY_DELAY = 250; // ms between attempts
        const MAX_ATTEMPTS = 20;
        let attempt = 0;
        let ok = false;
        while (attempt < MAX_ATTEMPTS) {
            ok = unlocked
                ? client.achievement.activate(apiName)
                : client.achievement.clear(apiName);
            console.error(`[worker] attempt ${attempt + 1}: ${unlocked ? 'activate' : 'clear'}(${apiName}) = ${ok}`);
            if (ok)
                break;
            attempt++;
            // After FAST_FAIL_ATTEMPTS consecutive failures send the sentinel so the
            // main process can kill+respawn this worker and retry with a fresh stats
            // request — much faster than grinding through all 20 attempts.
            if (attempt === FAST_FAIL_ATTEMPTS) {
                console.error(`[worker] ${FAST_FAIL_ATTEMPTS} failures — sending STATS_NOT_RECEIVED sentinel`);
                send(id, false, undefined, exports.STATS_NOT_RECEIVED_SENTINEL);
                return;
            }
            await new Promise(r => setTimeout(r, RETRY_DELAY));
        }
        if (!ok) {
            send(id, false, undefined, `Steam rejected the achievement update after ${MAX_ATTEMPTS} attempts. Make sure Steam is running and the game supports achievements.`);
            return;
        }
        const stored = client.stats.store();
        console.error(`[worker] stats.store() returned:`, stored);
        // stats.store() queues the write asynchronously — Steam needs additional
        // runCallbacks() ticks to flush the UserStatsStored callback and actually
        // persist the data. Without this pump, killing the worker immediately after
        // (e.g. navigating away) can discard the pending write.
        const FLUSH_MS = 600;
        const FLUSH_TICK = 50;
        const flushStart = Date.now();
        while (Date.now() - flushStart < FLUSH_MS) {
            await new Promise(r => setTimeout(r, FLUSH_TICK));
        }
        // Verify the final state from Steamworks so the caller can detect mismatches.
        let verified;
        try {
            verified = client.achievement.isActivated(apiName);
        }
        catch { /* ok */ }
        console.error(`[worker] post-flush verify isActivated(${apiName}) =`, verified);
        send(id, true, { verified, expected: unlocked });
    }
    catch (e) {
        console.error(`[worker] SET_ACHIEVEMENT error:`, e);
        send(id, false, undefined, e.message);
    }
}
async function handleSetAllAchievements(id, unlocked) {
    if (!client) {
        send(id, false, undefined, 'Not initialised');
        return;
    }
    if (!storedApiKey) {
        send(id, false, undefined, 'Steam API key required. Add one in Settings.');
        return;
    }
    try {
        const schema = await fetchSchema(currentAppId, storedApiKey);
        // Pump callbacks first so UserStatsReceived is guaranteed to have fired
        const MAX_PUMP = 20;
        const PUMP_DELAY = 300;
        let pumped = false;
        for (let i = 0; i < MAX_PUMP; i++) {
            try {
                runCallbacks?.();
            }
            catch { /* ok */ }
            // Test with first achievement to see if stats are ready
            if (schema.achievements.length > 0) {
                const test = unlocked
                    ? client.achievement.activate(schema.achievements[0].name)
                    : client.achievement.clear(schema.achievements[0].name);
                if (test) {
                    pumped = true;
                    break;
                }
            }
            else {
                pumped = true;
                break;
            }
            await new Promise(r => setTimeout(r, PUMP_DELAY));
        }
        if (!pumped && schema.achievements.length > 0) {
            send(id, false, undefined, 'Steam stats not ready. Make sure Steam is running.');
            return;
        }
        // Apply to rest of achievements (first one already done above)
        for (const a of schema.achievements.slice(1)) {
            if (unlocked)
                client.achievement.activate(a.name);
            else
                client.achievement.clear(a.name);
        }
        client.stats.store();
        send(id, true, { count: schema.achievements.length });
    }
    catch (e) {
        send(id, false, undefined, e.message);
    }
}
async function handleGetStats(id) {
    if (!client) {
        send(id, false, undefined, 'Not initialised');
        return;
    }
    if (!storedApiKey) {
        send(id, false, undefined, 'Steam API key required. Add one in Settings.');
        return;
    }
    try {
        const schema = await fetchSchema(currentAppId, storedApiKey);
        const stats = schema.stats.map((s) => ({
            apiName: s.name,
            displayName: s.displayName || s.name,
            value: client.stats.getInt(s.name) ?? 0,
            defaultValue: s.defaultvalue,
        }));
        send(id, true, stats);
    }
    catch (e) {
        send(id, false, undefined, e.message);
    }
}
function handleSetStat(id, apiName, value) {
    if (!client) {
        send(id, false, undefined, 'Not initialised');
        return;
    }
    try {
        client.stats.setInt(apiName, Math.round(value));
        client.stats.store();
        send(id, true);
    }
    catch (e) {
        send(id, false, undefined, e.message);
    }
}
function handleResetStats(id) {
    if (!client) {
        send(id, false, undefined, 'Not initialised');
        return;
    }
    try {
        client.stats.resetAll(true);
        send(id, true);
    }
    catch (e) {
        send(id, false, undefined, e.message);
    }
}
// ─── runCallbacks loop (keeps Steamworks alive after init) ──────────────────
let callbackInterval = null;
function startCallbackLoop() {
    if (callbackInterval)
        return;
    callbackInterval = setInterval(() => {
        try {
            runCallbacks?.();
        }
        catch { /* ok */ }
    }, 250);
}
// ─── Message loop ────────────────────────────────────────────────────────────
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        let msg;
        try {
            msg = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        switch (msg.type) {
            case 'INIT':
                handleInit(msg.id, msg.appId, msg.apiKey);
                break;
            case 'GET_ACHIEVEMENTS':
                handleGetAchievements(msg.id);
                break;
            case 'SET_ACHIEVEMENT':
                handleSetAchievement(msg.id, msg.apiName, msg.unlocked);
                break;
            case 'SET_ALL_ACHIEVEMENTS':
                handleSetAllAchievements(msg.id, msg.unlocked);
                break;
            case 'GET_STATS':
                handleGetStats(msg.id);
                break;
            case 'SET_STAT':
                handleSetStat(msg.id, msg.apiName, msg.value);
                break;
            case 'RESET_STATS':
                handleResetStats(msg.id);
                break;
            case 'EXIT':
                process.exit(0);
                break;
            case 'IDLE':
                handleIdle(msg.id);
                break;
        }
    }
});
process.stdin.on('end', () => process.exit(0));
// ─── Idle handler ────────────────────────────────────────────────────────────
// No separate idle interval needed — startCallbackLoop() at INIT (250 ms)
// already keeps Steamworks alive. A second loop would duplicate runCallbacks().
function handleIdle(id) {
    if (!client) {
        send(id, false, undefined, 'Not initialised');
        return;
    }
    // callbackLoop is already running from INIT — nothing extra to start
    send(id, true, { idling: true });
}
