// ─── Steam User ──────────────────────────────────────────────────────────────
export interface SteamUser {
  steamId: string
  personaName: string
  avatarUrl: string
  profileUrl: string
  level: number
}

// ─── Steam Game ───────────────────────────────────────────────────────────────
export interface SteamGame {
  appId: number
  name: string
  iconUrl: string
  headerImageUrl: string
  playtimeForever: number // minutes
  achievementCount: number
  achievementsUnlocked: number
  achievementPercentage: number
  lastPlayed?: number // unix timestamp
}

// ─── Achievement ──────────────────────────────────────────────────────────────
export interface Achievement {
  apiName: string
  displayName: string
  description: string
  iconUrl: string
  iconGrayUrl: string
  unlocked: boolean
  unlockedAt?: number // unix timestamp
  globalPercent?: number // % of players who have it
  hidden: boolean
}

// ─── Featured / Deal Game ───────────────────────────────────────────────────
export interface FeaturedGame {
  id: number
  name: string
  header_image: string
  discount_percent: number
  final_price: number    // cents; 0 = free
  original_price: number // cents
  type: 'free' | 'sale' | 'featured'
  url: string
}

export interface FeaturedResponse {
  deals: FeaturedGame[]
  featured: FeaturedGame[]
  freeGames: FeaturedGame[]
}

// ─── Idle Stats ─────────────────────────────────────────────────────────────
export interface IdleStats {
  totalGamesIdled: number       // all-time unique games idled
  totalSecondsIdled: number     // all-time seconds idled
  todayGamesIdled: number       // games idled today (resets at midnight)
  todaySecondsIdled: number     // seconds idled today
  lastResetDate: string         // ISO date string (YYYY-MM-DD)
}

// ─── Idle Game ────────────────────────────────────────────────────────────────
export interface IdleGame {
  appId: number
  name: string
  headerImageUrl?: string
}

// ─── IPC Channels ─────────────────────────────────────────────────────────────
export const IPC = {
  // Steam status
  CHECK_STEAM_RUNNING: 'steam:check-running',
  GET_USER_INFO: 'steam:get-user-info',

  // Games
  GET_OWNED_GAMES:    'steam:get-owned-games',
  GET_RECENT_GAMES:   'steam:get-recent-games',

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
  RESOLVE_APP_NAME:   'steam:resolve-app-name',
  SEARCH_GAMES:       'steam:search-games',

  // Notifications
  SEND_NOTIFICATION: 'app:send-notification',

  // Idle Stats
  GET_IDLE_STATS:        'idle:get-stats',
  RESET_IDLE_STATS:      'idle:reset-stats',
  IDLE_GET_START_TIMES:  'idle:get-start-times',
  IDLE_GET_GAMES:        'idle:get-games',

  // Worker control
  STOP_GAME: 'steam:stop-game',

  // Auto-updater
  UPDATER_CHECK:    'updater:check',
  UPDATER_INSTALL:  'updater:install',
  UPDATER_RESTART:  'updater:restart',  // quit & install downloaded update
  UPDATER_STATUS:   'updater:status',   // push from main → renderer

  // Partner apps
  GET_PARTNER_APP_RELEASES:      'partner:get-releases',
  DOWNLOAD_PARTNER_APP:          'partner:download',
  PARTNER_APP_DOWNLOAD_PROGRESS: 'partner:download-progress', // push main → renderer

  // Steam Account (auto-invisible)
  STEAM_ACCOUNT_LOGOUT:         'steam-account:logout',
  STEAM_ACCOUNT_STATUS:         'steam-account:status',
  STEAM_ACCOUNT_SET_INVISIBLE:  'steam-account:set-invisible',
  STEAM_ACCOUNT_STATUS_CHANGED: 'steam-account:status-changed', // push main → renderer
  // QR code login
  STEAM_ACCOUNT_QR_START:       'steam-account:qr-start',
  STEAM_ACCOUNT_QR_CANCEL:      'steam-account:qr-cancel',
  STEAM_ACCOUNT_QR_EVENT:       'steam-account:qr-event',       // push main → renderer
  // Cookie / refresh-token login
  STEAM_ACCOUNT_TOKEN_LOGIN:    'steam-account:token-login',
} as const

// ─── Updater ─────────────────────────────────────────────────────────────────────
export type UpdaterState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available';    version: string; releaseNotes?: string }
  | { status: 'not-available'; version: string }
  | { status: 'downloading';  percent: number; version: string }
  | { status: 'downloaded';   version: string }
  | { status: 'error';        message: string }

// ─── IPC Response ─────────────────────────────────────────────────────────────
export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ─── App Settings ─────────────────────────────────────────────────────────────
export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  steamApiKey?: string
  steamId?: string
  customAppIds?: string
  showGlobalPercent: boolean
  showHiddenAchievements: boolean
  confirmBulkActions: boolean
  minimizeToTray: boolean
  autostart: boolean
  autoIdleGames: IdleGame[]
  notificationsEnabled: boolean
  notificationSound: boolean
  // Steam Account (auto-invisible when idling)
  steamRefreshToken?: string  // base64-obfuscated refresh token
  autoInvisibleWhenIdling: boolean
  stopIdleOnGameLaunch: boolean
  resumeIdleAfterGame: boolean
}

// ─── Steam Account Status ─────────────────────────────────────────────────────
export type SteamAccountConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export interface SteamAccountStatusInfo {
  status: SteamAccountConnectionStatus
  username: string | null
}

// ─── QR Login Events (pushed main → renderer) ────────────────────────────────
export type QrLoginEvent =
  | { type: 'qr-code';  dataUrl: string }
  | { type: 'scanned' }
  | { type: 'success' }
  | { type: 'timeout' }
  | { type: 'error';    message: string }

// ─── Partner Apps ────────────────────────────────────────────────────────────
export interface PartnerAppRelease {
  key: string
  version: string
  downloadUrl: string
  fileName: string
  sizeBytes: number
}

export interface PartnerAppDownloadProgress {
  key: string
  percent: number     // 0-100
  done: boolean
  error?: string
  filePath?: string   // set when done=true
}

export const DEFAULT_SETTINGS: AppSettings = {
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
  stopIdleOnGameLaunch: true,
  resumeIdleAfterGame: true,
}
