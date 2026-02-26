"use strict";
/**
 * steamPaths.ts
 * Finds the Steam installation directory and reads local Steam data files.
 *
 * HOW SAM ACTUALLY WORKS (no Steam Web API key needed):
 *  1. Find Steam install path → Windows registry or known Linux/macOS paths
 *  2. Read game list → steamapps/*.acf manifest files (+ extra library folders)
 *  3. Read achievement schema → appcache/stats/UserGameStatsSchema_{appid}.bin (binary VDF)
 *     OR the free Steam Web API endpoint as fallback
 *  4. Achievement state & modification → steamworks.js (per-game process)
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
exports.getSteamPath = getSteamPath;
exports.getSteamLibraryPaths = getSteamLibraryPaths;
exports.readInstalledApps = readInstalledApps;
exports.readLoginUsers = readLoginUsers;
exports.parseTextVdf = parseTextVdf;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
// ─── Steam path detection ─────────────────────────────────────────────────────
function getSteamPath() {
    const platform = process.platform;
    if (platform === 'win32') {
        // Try registry (64-bit and 32-bit views)
        const regKeys = [
            'HKCU\\Software\\Valve\\Steam',
            'HKLM\\SOFTWARE\\Valve\\Steam',
            'HKLM\\SOFTWARE\\Wow6432Node\\Valve\\Steam',
        ];
        for (const key of regKeys) {
            try {
                const result = (0, child_process_1.execSync)(`reg query "${key}" /v SteamPath 2>nul`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
                const match = result.match(/SteamPath\s+REG_SZ\s+(.+)/i);
                if (match) {
                    const p = match[1].trim().replace(/\//g, '\\');
                    if (fs.existsSync(p))
                        return p;
                }
            }
            catch { /* try next */ }
        }
        // Fallback: common Windows paths
        const fallbacks = [
            'C:\\Program Files (x86)\\Steam',
            'C:\\Program Files\\Steam',
        ];
        for (const p of fallbacks) {
            if (fs.existsSync(p))
                return p;
        }
    }
    if (platform === 'linux') {
        const candidates = [
            path.join(os.homedir(), '.steam', 'steam'),
            path.join(os.homedir(), '.steam', 'root'),
            path.join(os.homedir(), '.local', 'share', 'Steam'),
            '/usr/share/steam',
        ];
        for (const p of candidates) {
            if (fs.existsSync(p))
                return p;
        }
    }
    if (platform === 'darwin') {
        const p = path.join(os.homedir(), 'Library', 'Application Support', 'Steam');
        if (fs.existsSync(p))
            return p;
    }
    throw new Error('Steam installation not found. Please make sure Steam is installed.');
}
// ─── Library folder discovery ─────────────────────────────────────────────────
/**
 * Returns all steamapps directory paths (primary + extra library folders).
 */
function getSteamLibraryPaths(steamPath) {
    const libraries = [];
    // Primary library
    const primaryLib = path.join(steamPath, 'steamapps');
    if (fs.existsSync(primaryLib))
        libraries.push(primaryLib);
    // Extra libraries from libraryfolders.vdf
    const vdfPath = path.join(primaryLib, 'libraryfolders.vdf');
    if (fs.existsSync(vdfPath)) {
        try {
            const text = fs.readFileSync(vdfPath, 'utf8');
            const parsed = parseTextVdf(text);
            // New format (Steam > 2021): "libraryfolders" > "0", "1", ... > "path"
            const rootVal = parsed['libraryfolders'] ?? parsed['LibraryFolders'] ?? {};
            const root = typeof rootVal === 'object' ? rootVal : {};
            for (const key of Object.keys(root)) {
                if (isNaN(Number(key)))
                    continue;
                const entry = root[key];
                const libPath = typeof entry === 'object' ? entry['path'] : entry;
                if (typeof libPath === 'string') {
                    const appsDir = path.join(libPath, 'steamapps');
                    if (fs.existsSync(appsDir) && !libraries.includes(appsDir)) {
                        libraries.push(appsDir);
                    }
                }
            }
        }
        catch { /* ignore parse errors */ }
    }
    return libraries;
}
// ─── ACF manifest reader ──────────────────────────────────────────────────────
/**
 * Reads all installed games from .acf manifest files across all library paths.
 */
function readInstalledApps(steamPath) {
    const libs = getSteamLibraryPaths(steamPath);
    const apps = [];
    for (const lib of libs) {
        try {
            const entries = fs.readdirSync(lib);
            for (const entry of entries) {
                if (!entry.startsWith('appmanifest_') || !entry.endsWith('.acf'))
                    continue;
                const acfPath = path.join(lib, entry);
                try {
                    const text = fs.readFileSync(acfPath, 'utf8');
                    const data = parseTextVdf(text);
                    const appStateRaw = data['AppState'] ?? data['appstate'] ?? {};
                    const appState = typeof appStateRaw === 'object' ? appStateRaw : {};
                    const appId = parseInt(String(appState['appid'] ?? appState['AppID'] ?? '0'));
                    if (!appId)
                        continue;
                    apps.push({
                        appId,
                        name: String(appState['name'] ?? appState['Name'] ?? `App ${appId}`),
                        installDir: String(appState['installdir'] ?? ''),
                        lastPlayed: parseInt(String(appState['LastPlayed'] ?? appState['lastplayed'] ?? '0')) || 0,
                        sizeOnDisk: parseInt(String(appState['SizeOnDisk'] ?? appState['sizeonDisk'] ?? '0')) || 0,
                        libraryPath: lib,
                    });
                }
                catch { /* skip bad manifests */ }
            }
        }
        catch { /* skip unreadable dirs */ }
    }
    return apps.sort((a, b) => a.name.localeCompare(b.name));
}
/**
 * Reads the currently logged-in Steam users from config/loginusers.vdf.
 */
function readLoginUsers(steamPath) {
    const vdfPath = path.join(steamPath, 'config', 'loginusers.vdf');
    if (!fs.existsSync(vdfPath))
        return [];
    try {
        const text = fs.readFileSync(vdfPath, 'utf8');
        const data = parseTextVdf(text);
        const usersRaw = data['users'] ?? data['Users'] ?? {};
        const users = typeof usersRaw === 'object' ? usersRaw : {};
        const result = [];
        for (const [steamId64, info] of Object.entries(users)) {
            if (typeof info !== 'object' || !info)
                continue;
            const u = info;
            const id64 = BigInt(steamId64);
            // Account ID = lower 32 bits of SteamID64
            const accountId = Number(id64 & 0xffffffffn);
            result.push({
                steamId64,
                accountId,
                personaName: u['PersonaName'] ?? u['personaname'] ?? 'Unknown',
                mostRecent: (u['MostRecent'] ?? u['mostrecent']) === '1',
            });
        }
        return result.sort((a, b) => Number(b.mostRecent) - Number(a.mostRecent));
    }
    catch {
        return [];
    }
}
function parseTextVdf(text) {
    const tokens = tokenize(text);
    let pos = 0;
    function peek() { return pos < tokens.length ? tokens[pos] : null; }
    function consume() { return tokens[pos++]; }
    function parseObject() {
        const obj = {};
        consume(); // consume '{'
        while (peek() !== '}' && peek() !== null) {
            const key = consume();
            const next = peek();
            if (next === '{') {
                obj[key] = parseObject();
            }
            else if (next !== null && next !== '}') {
                obj[key] = consume();
            }
        }
        if (peek() === '}')
            consume();
        return obj;
    }
    const root = {};
    while (peek() !== null) {
        const key = consume();
        const next = peek();
        if (next === '{') {
            root[key] = parseObject();
        }
        else if (next !== null) {
            root[key] = consume();
        }
    }
    return root;
}
function tokenize(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        // Skip whitespace
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        // Skip // comments
        if (ch === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n')
                i++;
            continue;
        }
        // Braces
        if (ch === '{' || ch === '}') {
            tokens.push(ch);
            i++;
            continue;
        }
        // Quoted string
        if (ch === '"') {
            i++;
            let str = '';
            while (i < text.length && text[i] !== '"') {
                if (text[i] === '\\' && i + 1 < text.length) {
                    const esc = text[i + 1];
                    if (esc === 'n')
                        str += '\n';
                    else if (esc === 't')
                        str += '\t';
                    else if (esc === '"')
                        str += '"';
                    else if (esc === '\\')
                        str += '\\';
                    else
                        str += esc;
                    i += 2;
                }
                else {
                    str += text[i++];
                }
            }
            i++; // closing quote
            tokens.push(str);
            continue;
        }
        // Unquoted token (until whitespace or brace)
        let token = '';
        while (i < text.length && !/[\s{}"]/g.test(text[i])) {
            token += text[i++];
        }
        if (token)
            tokens.push(token);
    }
    return tokens;
}
