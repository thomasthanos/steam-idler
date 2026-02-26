"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = exports.IPC = void 0;
// ─── IPC Channels ─────────────────────────────────────────────────────────────
exports.IPC = {
    // Steam status
    CHECK_STEAM_RUNNING: 'steam:check-running',
    GET_USER_INFO: 'steam:get-user-info',
    // Games
    GET_OWNED_GAMES: 'steam:get-owned-games',
    // Achievements
    GET_ACHIEVEMENTS: 'steam:get-achievements',
    UNLOCK_ACHIEVEMENT: 'steam:unlock-achievement',
    LOCK_ACHIEVEMENT: 'steam:lock-achievement',
    UNLOCK_ALL_ACHIEVEMENTS: 'steam:unlock-all-achievements',
    LOCK_ALL_ACHIEVEMENTS: 'steam:lock-all-achievements',
    RESET_STATS: 'steam:reset-stats',
    // Settings
    GET_SETTINGS: 'app:get-settings',
    SET_SETTINGS: 'app:set-settings',
    // Window
    MINIMIZE_WINDOW: 'window:minimize',
    MAXIMIZE_WINDOW: 'window:maximize',
    CLOSE_WINDOW: 'window:close',
    // Idling
    IDLE_START: 'idle:start',
    IDLE_STOP: 'idle:stop',
    IDLE_STATUS: 'idle:status',
    // Autostart
    AUTOSTART_GET: 'app:autostart-get',
    AUTOSTART_SET: 'app:autostart-set',
    // Steam Store
    GET_STEAM_FEATURED: 'steam:get-featured',
    RESOLVE_APP_NAME: 'steam:resolve-app-name',
    SEARCH_GAMES: 'steam:search-games',
    // Notifications
    SEND_NOTIFICATION: 'app:send-notification',
    // Worker control
    STOP_GAME: 'steam:stop-game',
    // Auto-updater
    UPDATER_CHECK: 'updater:check',
    UPDATER_INSTALL: 'updater:install',
    UPDATER_RESTART: 'updater:restart', // quit & install downloaded update
    UPDATER_STATUS: 'updater:status', // push from main → renderer
};
exports.DEFAULT_SETTINGS = {
    theme: 'dark',
    showGlobalPercent: true,
    showHiddenAchievements: true,
    confirmBulkActions: true,
    minimizeToTray: true,
    autostart: false,
    autoIdleGames: [],
    notificationsEnabled: true,
    notificationSound: true,
};
