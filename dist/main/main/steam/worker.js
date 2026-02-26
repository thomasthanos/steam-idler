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
const sw = __importStar(require("steamworks.js"));
// runCallbacks may be a named export depending on the steamworks.js version
const { runCallbacks } = sw;
const axios_1 = __importDefault(require("axios"));
// ─── State ──────────────────────────────────────────────────────────────────
let client = null;
let currentAppId = 0;
let storedApiKey = '';
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
        process.env['SteamAppId'] = String(appId);
        client = sw.init(appId);
        currentAppId = appId;
        if (apiKey)
            storedApiKey = apiKey;
        // Start the callback loop immediately so Steam processes events
        startCallbackLoop();
        send(id, true, { appId });
    }
    catch (e) {
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
function handleSetAchievement(id, apiName, unlocked) {
    if (!client) {
        send(id, false, undefined, 'Not initialised');
        return;
    }
    try {
        if (unlocked)
            client.achievement.activate(apiName);
        else
            client.achievement.clear(apiName);
        client.stats.store();
        send(id, true);
    }
    catch (e) {
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
        for (const a of schema.achievements) {
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
