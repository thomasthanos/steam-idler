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
    GET_RECENT_GAMES: 'steam:get-recent-games',
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
    // Partner apps
    GET_PARTNER_APP_RELEASES: 'partner:get-releases',
    DOWNLOAD_PARTNER_APP: 'partner:download',
    PARTNER_APP_DOWNLOAD_PROGRESS: 'partner:download-progress', // push main → renderer
    // Steam Account (auto-invisible)
    STEAM_ACCOUNT_LOGOUT: 'steam-account:logout',
    STEAM_ACCOUNT_STATUS: 'steam-account:status',
    STEAM_ACCOUNT_SET_INVISIBLE: 'steam-account:set-invisible',
    STEAM_ACCOUNT_STATUS_CHANGED: 'steam-account:status-changed', // push main → renderer
    // QR code login
    STEAM_ACCOUNT_QR_START: 'steam-account:qr-start',
    STEAM_ACCOUNT_QR_CANCEL: 'steam-account:qr-cancel',
    STEAM_ACCOUNT_QR_EVENT: 'steam-account:qr-event', // push main → renderer
    // Cookie / refresh-token login
    STEAM_ACCOUNT_TOKEN_LOGIN: 'steam-account:token-login',
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
    autoInvisibleWhenIdling: true,
};
