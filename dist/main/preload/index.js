"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const types_1 = require("../shared/types");
// ─── Exposed API ──────────────────────────────────────────────────────────────
const steamAPI = {
    // Steam status
    checkSteamRunning: () => electron_1.ipcRenderer.invoke(types_1.IPC.CHECK_STEAM_RUNNING),
    getUserInfo: () => electron_1.ipcRenderer.invoke(types_1.IPC.GET_USER_INFO),
    // Games
    getOwnedGames: (force) => electron_1.ipcRenderer.invoke(types_1.IPC.GET_OWNED_GAMES, force),
    // Achievements
    getAchievements: (appId) => electron_1.ipcRenderer.invoke(types_1.IPC.GET_ACHIEVEMENTS, appId),
    unlockAchievement: (appId, apiName) => electron_1.ipcRenderer.invoke(types_1.IPC.UNLOCK_ACHIEVEMENT, appId, apiName),
    lockAchievement: (appId, apiName) => electron_1.ipcRenderer.invoke(types_1.IPC.LOCK_ACHIEVEMENT, appId, apiName),
    unlockAllAchievements: (appId) => electron_1.ipcRenderer.invoke(types_1.IPC.UNLOCK_ALL_ACHIEVEMENTS, appId),
    lockAllAchievements: (appId) => electron_1.ipcRenderer.invoke(types_1.IPC.LOCK_ALL_ACHIEVEMENTS, appId),
    resetStats: (appId) => electron_1.ipcRenderer.invoke(types_1.IPC.RESET_STATS, appId),
    // Settings
    getSettings: () => electron_1.ipcRenderer.invoke(types_1.IPC.GET_SETTINGS),
    setSettings: (settings) => electron_1.ipcRenderer.invoke(types_1.IPC.SET_SETTINGS, settings),
    // Idle
    startIdle: (appId, name) => electron_1.ipcRenderer.invoke(types_1.IPC.IDLE_START, appId, name),
    stopIdle: (appId) => electron_1.ipcRenderer.invoke(types_1.IPC.IDLE_STOP, appId),
    getIdleStatus: () => electron_1.ipcRenderer.invoke(types_1.IPC.IDLE_STATUS),
    onIdleChanged: (cb) => {
        electron_1.ipcRenderer.on('idle:changed', cb);
        return () => electron_1.ipcRenderer.removeListener('idle:changed', cb);
    },
    // Steam Store
    getSteamFeatured: () => electron_1.ipcRenderer.invoke(types_1.IPC.GET_STEAM_FEATURED),
    resolveAppName: (appId) => electron_1.ipcRenderer.invoke(types_1.IPC.RESOLVE_APP_NAME, appId),
    searchGames: (term) => electron_1.ipcRenderer.invoke(types_1.IPC.SEARCH_GAMES, term),
    // Worker control
    stopGame: () => electron_1.ipcRenderer.invoke(types_1.IPC.STOP_GAME),
    // Auto-updater
    checkForUpdates: () => electron_1.ipcRenderer.invoke(types_1.IPC.UPDATER_CHECK),
    onUpdaterStatus: (cb) => {
        const handler = (_, state) => cb(state);
        electron_1.ipcRenderer.on(types_1.IPC.UPDATER_STATUS, handler);
        return () => electron_1.ipcRenderer.removeListener(types_1.IPC.UPDATER_STATUS, handler);
    },
    // Notifications
    sendNotification: (title, body, silent) => electron_1.ipcRenderer.invoke(types_1.IPC.SEND_NOTIFICATION, title, body, silent),
    // Autostart
    getAutostart: () => electron_1.ipcRenderer.invoke(types_1.IPC.AUTOSTART_GET),
    setAutostart: (enabled) => electron_1.ipcRenderer.invoke(types_1.IPC.AUTOSTART_SET, enabled),
    // Theme listener
    onThemeChange: (cb) => {
        const handler = (_event, theme) => cb(theme);
        electron_1.ipcRenderer.on('theme:changed', handler);
        // Use removeListener (not removeAllListeners) so multiple subscribers can coexist
        return () => electron_1.ipcRenderer.removeListener('theme:changed', handler);
    },
};
const windowAPI = {
    minimize: () => electron_1.ipcRenderer.send(types_1.IPC.MINIMIZE_WINDOW),
    maximize: () => electron_1.ipcRenderer.send(types_1.IPC.MAXIMIZE_WINDOW),
    close: () => electron_1.ipcRenderer.send(types_1.IPC.CLOSE_WINDOW),
};
electron_1.contextBridge.exposeInMainWorld('steam', steamAPI);
electron_1.contextBridge.exposeInMainWorld('windowAPI', windowAPI);
