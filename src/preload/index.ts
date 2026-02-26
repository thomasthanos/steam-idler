import { contextBridge, ipcRenderer } from 'electron'
import { IPC, IPCResponse, AppSettings, Achievement, SteamGame, SteamUser, IdleGame } from '../shared/types'

// ─── Exposed API ──────────────────────────────────────────────────────────────
const steamAPI = {
  // Steam status
  checkSteamRunning: (): Promise<IPCResponse<boolean>> =>
    ipcRenderer.invoke(IPC.CHECK_STEAM_RUNNING),

  getUserInfo: (): Promise<IPCResponse<SteamUser>> =>
    ipcRenderer.invoke(IPC.GET_USER_INFO),

  // Games
  getOwnedGames: (force?: boolean): Promise<IPCResponse<SteamGame[]>> =>
    ipcRenderer.invoke(IPC.GET_OWNED_GAMES, force),

  // Achievements
  getAchievements: (appId: number): Promise<IPCResponse<Achievement[]>> =>
    ipcRenderer.invoke(IPC.GET_ACHIEVEMENTS, appId),

  unlockAchievement: (appId: number, apiName: string): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.UNLOCK_ACHIEVEMENT, appId, apiName),

  lockAchievement: (appId: number, apiName: string): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.LOCK_ACHIEVEMENT, appId, apiName),

  unlockAllAchievements: (appId: number): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.UNLOCK_ALL_ACHIEVEMENTS, appId),

  lockAllAchievements: (appId: number): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.LOCK_ALL_ACHIEVEMENTS, appId),

  resetStats: (appId: number): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.RESET_STATS, appId),

  // Settings
  getSettings: (): Promise<IPCResponse<AppSettings>> =>
    ipcRenderer.invoke(IPC.GET_SETTINGS),

  setSettings: (settings: Partial<AppSettings>): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.SET_SETTINGS, settings),

  // Idle
  startIdle: (appId: number, name: string): Promise<IPCResponse<number[]>> =>
    ipcRenderer.invoke(IPC.IDLE_START, appId, name),

  stopIdle: (appId: number): Promise<IPCResponse<number[]>> =>
    ipcRenderer.invoke(IPC.IDLE_STOP, appId),

  getIdleStatus: (): Promise<IPCResponse<number[]>> =>
    ipcRenderer.invoke(IPC.IDLE_STATUS),

  onIdleChanged: (cb: () => void) => {
    ipcRenderer.on('idle:changed', cb)
    return () => ipcRenderer.removeListener('idle:changed', cb)
  },

  // Steam Store
  getSteamFeatured: (): Promise<IPCResponse<{ deals: any[]; featured: any[]; freeGames: any[] }>> =>
    ipcRenderer.invoke(IPC.GET_STEAM_FEATURED),

  resolveAppName: (appId: number): Promise<IPCResponse<{ name: string }>> =>
    ipcRenderer.invoke(IPC.RESOLVE_APP_NAME, appId),

  searchGames: (term: string): Promise<IPCResponse<Array<{
    appId: number; name: string; headerImageUrl: string; tiny_image?: string; price?: any
  }>>> =>
    ipcRenderer.invoke(IPC.SEARCH_GAMES, term),

  // Worker control
  stopGame: (): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.STOP_GAME),

  // Auto-updater
  checkForUpdates: (): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.UPDATER_CHECK),
  installUpdate: (): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.UPDATER_INSTALL),
  restartAndInstall: (): void =>
    { ipcRenderer.invoke(IPC.UPDATER_RESTART) },
  onUpdaterStatus: (cb: (state: import('../shared/types').UpdaterState) => void) => {
    const handler = (_: unknown, state: import('../shared/types').UpdaterState) => cb(state)
    ipcRenderer.on(IPC.UPDATER_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.UPDATER_STATUS, handler)
  },

  // Notifications
  sendNotification: (title: string, body: string, silent: boolean): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke(IPC.SEND_NOTIFICATION, title, body, silent),

  // Autostart
  getAutostart: (): Promise<IPCResponse<boolean>> =>
    ipcRenderer.invoke(IPC.AUTOSTART_GET),

  setAutostart: (enabled: boolean): Promise<IPCResponse<boolean>> =>
    ipcRenderer.invoke(IPC.AUTOSTART_SET, enabled),

  // Theme listener
  onThemeChange: (cb: (theme: 'dark' | 'light') => void) => {
    ipcRenderer.on('theme:changed', (_event, theme) => cb(theme))
    return () => ipcRenderer.removeAllListeners('theme:changed')
  },
}

const windowAPI = {
  minimize: () => ipcRenderer.send(IPC.MINIMIZE_WINDOW),
  maximize: () => ipcRenderer.send(IPC.MAXIMIZE_WINDOW),
  close: () => ipcRenderer.send(IPC.CLOSE_WINDOW),
}

contextBridge.exposeInMainWorld('steam', steamAPI)
contextBridge.exposeInMainWorld('windowAPI', windowAPI)

// ─── Type augmentation for renderer ──────────────────────────────────────────
export type SteamAPI = typeof steamAPI
export type WindowAPI = typeof windowAPI
