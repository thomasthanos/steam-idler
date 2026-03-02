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
    }
    get workerPath() {
        return path.join(__dirname, 'worker.js')
            .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
    }
    setSteamAccountManager(manager) {
        this.steamAccountManager = manager;
    }
    startIdle(appId, name) {
        if (this.idlers.has(appId))
            return;
        if (name)
            this.names.set(appId, name);
        const proc = (0, child_process_1.spawn)(process.execPath, [this.workerPath], {
            env: {
                ...process.env,
                SteamAppId: String(appId),
                ELECTRON_RUN_AS_NODE: '1',
                ELECTRON_NO_ASAR: '1',
            },
            // detached: false keeps the child in the same session so tree-kill can
            // walk the full process tree on all platforms.
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false,
        });
        proc.stderr?.setEncoding('utf8');
        proc.stderr?.on('data', (chunk) => {
            console.error(`[idle:${appId}] ${chunk.trim()}`);
        });
        proc.stdin.write(JSON.stringify({ id: 1, type: 'INIT', appId }) + '\n');
        proc.stdin.write(JSON.stringify({ id: 2, type: 'IDLE' }) + '\n');
        proc.on('exit', () => {
            this.idlers.delete(appId);
            this.names.delete(appId);
            // Notify listeners so the tray can refresh without waiting for the poll.
            this.emit('changed');
        });
        this.idlers.set(appId, proc);
        console.log(`[idle] Started idling appId=${appId}`);
        // Set invisible when the first game starts idling (if setting enabled)
        if (this.idlers.size === 1 && this.steamAccountManager?.isConnected) {
            const { autoInvisibleWhenIdling } = (0, store_1.getStore)().get('settings');
            if (autoInvisibleWhenIdling)
                this.steamAccountManager.setInvisible();
        }
        this.emit('changed');
    }
    stopIdle(appId) {
        const proc = this.idlers.get(appId);
        if (!proc)
            return;
        // 1. Close stdin so the worker's 'end' handler fires and it calls process.exit(0)
        try {
            proc.stdin.end();
        }
        catch { /* ok */ }
        // 2. Use tree-kill to SIGKILL the entire process subtree (works on Windows too).
        //    Fall back to proc.kill() if the pid is unavailable.
        const pid = proc.pid;
        if (pid !== undefined) {
            (0, tree_kill_1.default)(pid, 'SIGKILL', (err) => {
                if (err) {
                    // Tree-kill failed (process may have already exited) — best-effort fallback.
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
        // Restore status when the last game stops idling (if setting enabled)
        if (this.idlers.size === 0 && this.steamAccountManager?.isConnected) {
            const { autoInvisibleWhenIdling } = (0, store_1.getStore)().get('settings');
            if (autoInvisibleWhenIdling)
                this.steamAccountManager.restoreStatus();
        }
        this.emit('changed');
    }
    getIdlingAppIds() {
        return [...this.idlers.keys()];
    }
    getIdlingGames() {
        return [...this.idlers.keys()].map(id => ({
            appId: id,
            name: this.names.get(id) ?? `App ${id}`,
        }));
    }
    isIdling(appId) {
        return this.idlers.has(appId);
    }
    stopAll(opts = {}) {
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
            for (const appId of [...this.idlers.keys()]) {
                this.stopIdle(appId); // stopIdle already handles names.delete(appId)
            }
        }
    }
}
exports.IdleManager = IdleManager;
