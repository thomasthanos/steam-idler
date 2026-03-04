"use strict";
/**
 * idleManager.ts – manages "idling" worker processes.
 * Each game gets its own child process with SteamAppId set,
 * so Steam shows the game as "currently playing."
 *
 * Fix #1  – tree-kill ensures the entire process tree (not just the root pid)
 *           is terminated on stopIdle.  Without this, child processes spawned
 *           by the worker (native addons, etc.) could linger after proc.kill().
 * Fix #10 – IdleManager extends EventEmitter so the main window can subscribe
 *           to 'changed' events and update the tray icon immediately instead of
 *           waiting for the 5 s polling interval.
 *
 * NOTE: Auto-invisible via steam-user is intentionally disabled.
 * steam-user.setPlayingGame() opens a second CM session which conflicts with
 * the steamworks.js worker → Steam sends LoggedInElsewhere to the worker →
 * worker exits → idle stops. The worker already advertises the playing state
 * natively via sw.init(appId), so steam-user is not needed for idle.
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
exports.IdleManager = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const events_1 = require("events");
const tree_kill_1 = __importDefault(require("tree-kill"));
const store_1 = require("../store");
class IdleManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.idlers = new Map();
        this.names = new Map();
        this.steamAccountManager = null;
        // Timer for delayed status restore — gives Steam time to fully close
        // the game process before we change persona state back.
        this._restoreTimer = null;
        // Pending worker spawns — games where we set invisible first and are
        // waiting for the delay before actually spawning the worker process.
        this._pendingSpawns = new Map();
        // Polling interval for detecting manual game launches via Windows registry.
        // Steam sets HKCU\Software\Valve\Steam\RunningAppID when a game is launched.
        this._gameDetectionInterval = null;
        // Games that were already running when idle started — excluded from
        // manual launch detection so the polling doesn't immediately kill the idle.
        // Cleared when the game quits (RunningAppID → 0) or when all idle stops.
        this._knownRunningAtStart = new Set();
    }
    get workerPath() {
        return path.join(__dirname, 'worker.js')
            .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
    }
    setSteamAccountManager(manager) {
        this.steamAccountManager = manager;
        // When the steam account connects AFTER games are already idling
        // (e.g. auto-idle starts immediately at startup but the account
        // reconnect is delayed by 2 seconds), trigger setInvisible at that
        // point so auto-invisible actually works on startup.
        manager.on('status-changed', (info) => {
            if (info.status === 'connected' && this.idlers.size > 0) {
                const { autoInvisibleWhenIdling } = (0, store_1.getStore)().get('settings');
                if (autoInvisibleWhenIdling) {
                    console.log('[idle] Steam account connected while idling — setting invisible now');
                    manager.setInvisible();
                }
            }
        });
        // When the user launches a game manually from Steam, stop all idling
        // and restore status. The steam-user CM session fires 'game-launched'
        // (forwarded from the 'appLaunched' CM event) when any app starts.
        // If the appId is NOT one we're currently idling, it's a manual launch.
        // Only active when stopIdleOnGameLaunch is enabled.
        manager.on('game-launched', (appId) => {
            if (!(0, store_1.getStore)().get('settings').stopIdleOnGameLaunch)
                return;
            if (this.idlers.size > 0 && !this.isIdling(appId)) {
                console.log(`[idle] Manual game launch detected (appId=${appId}) — stopping all idle`);
                this.stopAll();
            }
        });
    }
    startIdle(appId, name) {
        if (this.idlers.has(appId) || this._pendingSpawns.has(appId))
            return;
        if (name)
            this.names.set(appId, name);
        // Cancel any pending restore timer — we're starting a new idle session
        this._cancelRestoreTimer();
        const totalActive = this.idlers.size + this._pendingSpawns.size;
        const shouldGoInvisible = totalActive === 0
            && this.steamAccountManager?.hasAccount
            && (0, store_1.getStore)().get('settings').autoInvisibleWhenIdling;
        if (shouldGoInvisible) {
            // Set invisible FIRST, then wait for Steam to process the status
            // change before spawning the worker (which shows "In-Game").
            this.steamAccountManager.setInvisible();
            console.log(`[idle] Set invisible — waiting ${IdleManager.INVISIBLE_FIRST_DELAY_MS}ms before spawning worker for appId=${appId}`);
            const timer = setTimeout(() => {
                this._pendingSpawns.delete(appId);
                this._spawnWorker(appId);
            }, IdleManager.INVISIBLE_FIRST_DELAY_MS);
            this._pendingSpawns.set(appId, timer);
        }
        else {
            this._spawnWorker(appId);
        }
        // Game detection + warnings only when stopIdleOnGameLaunch is enabled.
        // When disabled, idle runs "autonomously" without any of this.
        if ((0, store_1.getStore)().get('settings').stopIdleOnGameLaunch) {
            // Start polling for manual game launches (registry-based detection)
            this._startGameDetectionPolling();
            // One-time check: warn if a Steam game is already running
            this._warnIfGameRunning();
        }
        this.emit('changed');
    }
    /** Spawn the actual child process worker for an appId. */
    _spawnWorker(appId) {
        // Guard: stopIdle may have been called while waiting for the delay
        if (this.idlers.has(appId))
            return;
        const proc = (0, child_process_1.spawn)(process.execPath, [this.workerPath], {
            env: {
                ...process.env,
                SteamAppId: String(appId),
                ELECTRON_RUN_AS_NODE: '1',
                ELECTRON_NO_ASAR: '1',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false,
        });
        proc.stderr?.setEncoding('utf8');
        proc.stderr?.on('data', (chunk) => {
            console.error(`[idle:${appId}] ${chunk.trim()}`);
        });
        proc.stdout?.resume();
        proc.stdin?.on('error', () => { });
        try {
            proc.stdin.write(JSON.stringify({ id: 1, type: 'INIT', appId }) + '\n');
            proc.stdin.write(JSON.stringify({ id: 2, type: 'IDLE' }) + '\n');
        }
        catch (e) {
            console.error(`[idle:${appId}] Failed to write to worker stdin:`, e);
        }
        proc.on('exit', () => {
            if (!this.idlers.has(appId))
                return;
            this.idlers.delete(appId);
            this.names.delete(appId);
            console.log(`[idle] Worker exited unexpectedly for appId=${appId}`);
            if (this.idlers.size === 0 && this._pendingSpawns.size === 0) {
                this._scheduleRestore();
            }
            this.emit('changed');
        });
        this.idlers.set(appId, proc);
        console.log(`[idle] Spawned worker for appId=${appId}`);
        this.emit('changed');
    }
    stopIdle(appId) {
        // Cancel pending spawn if the worker hasn't been created yet
        const pendingTimer = this._pendingSpawns.get(appId);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            this._pendingSpawns.delete(appId);
            this.names.delete(appId);
            console.log(`[idle] Cancelled pending spawn for appId=${appId}`);
            if (this.idlers.size === 0 && this._pendingSpawns.size === 0) {
                this._scheduleRestore();
            }
            this.emit('changed');
            return;
        }
        const proc = this.idlers.get(appId);
        if (!proc)
            return;
        try {
            proc.stdin.end();
        }
        catch { /* ok */ }
        const pid = proc.pid;
        if (pid !== undefined) {
            (0, tree_kill_1.default)(pid, 'SIGKILL', (err) => {
                if (err) {
                    try {
                        proc.kill('SIGKILL');
                    }
                    catch { /* ok */ }
                }
            });
        }
        else {
            try {
                proc.kill('SIGKILL');
            }
            catch { /* ok */ }
        }
        this.idlers.delete(appId);
        this.names.delete(appId);
        console.log(`[idle] Stopped idling appId=${appId}`);
        if (this.idlers.size === 0 && this._pendingSpawns.size === 0) {
            this._scheduleRestore();
        }
        this.emit('changed');
    }
    getIdlingAppIds() {
        return [...this.idlers.keys(), ...this._pendingSpawns.keys()];
    }
    getIdlingGames() {
        const ids = this.getIdlingAppIds();
        return ids.map(id => ({
            appId: id,
            name: this.names.get(id) ?? `App ${id}`,
        }));
    }
    isIdling(appId) {
        return this.idlers.has(appId) || this._pendingSpawns.has(appId);
    }
    stopAll(opts = {}) {
        // Cancel all pending spawns and game detection polling
        for (const [appId, timer] of this._pendingSpawns) {
            clearTimeout(timer);
            console.log(`[idle] Cancelled pending spawn for appId=${appId}`);
        }
        const hadPending = this._pendingSpawns.size > 0;
        this._pendingSpawns.clear();
        this._knownRunningAtStart.clear();
        this._stopGameDetectionPolling();
        if (opts.skipRestore) {
            // During app quit: kill processes without touching Steam persona state
            for (const [appId, proc] of [...this.idlers.entries()]) {
                try {
                    proc.stdin.end();
                }
                catch { /* ok */ }
                const pid = proc.pid;
                if (pid !== undefined) {
                    (0, tree_kill_1.default)(pid, 'SIGKILL', () => { });
                }
                else {
                    try {
                        proc.kill('SIGKILL');
                    }
                    catch { /* ok */ }
                }
                console.log(`[idle] Stopped idling appId=${appId}`);
            }
            this.idlers.clear();
            this.names.clear();
            this.emit('changed');
        }
        else {
            const hadIdlers = this.idlers.size > 0 || hadPending;
            for (const [appId, proc] of [...this.idlers.entries()]) {
                try {
                    proc.stdin.end();
                }
                catch { /* ok */ }
                const pid = proc.pid;
                if (pid !== undefined) {
                    (0, tree_kill_1.default)(pid, 'SIGKILL', () => { });
                }
                else {
                    try {
                        proc.kill('SIGKILL');
                    }
                    catch { /* ok */ }
                }
                this.idlers.delete(appId);
                this.names.delete(appId);
                console.log(`[idle] Stopped idling appId=${appId}`);
            }
            if (hadIdlers) {
                this._scheduleRestore();
            }
            this.emit('changed');
        }
    }
    // ─── Private: manual game launch detection (Windows registry polling) ─────
    /** Start polling the Windows registry for manual game launches. */
    _startGameDetectionPolling() {
        if (process.platform !== 'win32')
            return;
        if (this._gameDetectionInterval)
            return; // already polling
        this._gameDetectionInterval = setInterval(() => this._checkRunningGame(), IdleManager.GAME_DETECTION_POLL_MS);
    }
    /** Stop polling when no games are idling. */
    _stopGameDetectionPolling() {
        if (this._gameDetectionInterval) {
            clearInterval(this._gameDetectionInterval);
            this._gameDetectionInterval = null;
        }
    }
    /**
     * Read Steam's RunningAppID from the Windows registry.
     * When the user launches a game from Steam, this value changes to the
     * game's appId. Our idle workers do NOT set this — they only register
     * via steamworks.js IPC, so RunningAppID stays 0 during idle.
     * If a non-zero appId appears that we're not idling → manual launch.
     */
    _checkRunningGame() {
        if (this.idlers.size === 0 && this._pendingSpawns.size === 0)
            return;
        (0, child_process_1.execFile)('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'], {
            timeout: 3000,
            windowsHide: true,
        }, (err, stdout) => {
            if (err)
                return;
            // Output format: "    RunningAppID    REG_DWORD    0x000000XX"
            const match = stdout.match(/RunningAppID\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
            if (!match)
                return;
            const appId = parseInt(match[1], 16);
            if (appId === 0 && this._knownRunningAtStart.size > 0) {
                // The game that was running at idle start has quit — clear the
                // exclusion set so relaunching the same game IS detected next time.
                console.log('[idle] Previously running game quit — clearing known-at-start exclusion');
                this._knownRunningAtStart.clear();
                return;
            }
            if (appId > 0 && !this.isIdling(appId) && !this._knownRunningAtStart.has(appId)) {
                console.log(`[idle] Manual game launch detected via registry (appId=${appId}) — stopping all idle`);
                this.emit('manual-game-detected', appId);
                this.stopAll();
            }
        });
    }
    /**
     * One-time check when idle starts: emit 'game-already-running' if a Steam
     * game is currently running so the UI can show a warning notification.
     */
    _warnIfGameRunning() {
        if (process.platform !== 'win32')
            return;
        (0, child_process_1.execFile)('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'], {
            timeout: 3000,
            windowsHide: true,
        }, (err, stdout) => {
            if (err)
                return;
            const match = stdout.match(/RunningAppID\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
            if (!match)
                return;
            const appId = parseInt(match[1], 16);
            if (appId > 0) {
                // Add to exclusion set so the polling doesn't immediately kill the idle
                // for a game that was already running BEFORE the user started idling.
                this._knownRunningAtStart.add(appId);
                console.log(`[idle] Warning: Steam game already running (appId=${appId}) while starting idle — added to exclusion set`);
                this.emit('game-already-running', appId);
            }
        });
    }
    // ─── Private: delayed status restore ──────────────────────────────────────
    /**
     * Schedule a delayed restoreStatus call.
     * The 3-second delay gives Steam time to fully terminate the game
     * process before we change the persona state — without it, Steam
     * may still show "In-Game" briefly after the restore.
     * If a timer is already pending, it is replaced (only one fires).
     */
    _scheduleRestore() {
        this._cancelRestoreTimer();
        if (!this.steamAccountManager?.hasAccount)
            return;
        const { autoInvisibleWhenIdling } = (0, store_1.getStore)().get('settings');
        if (!autoInvisibleWhenIdling)
            return;
        this._restoreTimer = setTimeout(() => {
            this._restoreTimer = null;
            // Double-check: only restore if no new idle started during the delay
            if (this.idlers.size === 0 && this._pendingSpawns.size === 0 && this.steamAccountManager?.hasAccount) {
                this._stopGameDetectionPolling();
                this.steamAccountManager.restoreStatus();
            }
        }, IdleManager.RESTORE_DELAY_MS);
    }
    _cancelRestoreTimer() {
        if (this._restoreTimer) {
            clearTimeout(this._restoreTimer);
            this._restoreTimer = null;
        }
    }
}
exports.IdleManager = IdleManager;
IdleManager.RESTORE_DELAY_MS = 3000;
IdleManager.INVISIBLE_FIRST_DELAY_MS = 2500;
IdleManager.GAME_DETECTION_POLL_MS = 5000;
