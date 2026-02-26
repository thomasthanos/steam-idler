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
  RESOLVE_APP_NAME:   'steam:resolve-app-name',
  SEARCH_GAMES:       'steam:search-games',

  // Notifications
  SEND_NOTIFICATION: 'app:send-notification',

  // Worker control
  STOP_GAME: 'steam:stop-game',

  // Auto-updater
  UPDATER_CHECK:    'updater:check',
  UPDATER_INSTALL:  'updater:install',
  UPDATER_RESTART:  'updater:restart',  // quit & install downloaded update
  UPDATER_STATUS:   'updater:status',   // push from main → renderer
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
}
