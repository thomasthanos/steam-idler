import { app, ipcMain, Notification } from 'electron'
import * as path from 'path'
import axios from 'axios'
import { IPC, IPCResponse, AppSettings, DEFAULT_SETTINGS, IdleGame, FeaturedGame } from '../../shared/types'
import { SteamClient } from '../steam/client'
import { IdleManager } from '../steam/idleManager'
import Store from 'electron-store'

const store = new Store<{ settings: AppSettings }>({
  name: 'config',
  defaults: { settings: DEFAULT_SETTINGS },
})

function wrap<T>(fn: () => Promise<T>): Promise<IPCResponse<T>> {
  return fn()
    .then((data) => ({ success: true, data }))
    .catch((error: Error) => ({ success: false, error: error.message }))
}

export function setupIpcHandlers(steam: SteamClient, idle: IdleManager): void {
  // ── Steam status ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CHECK_STEAM_RUNNING, () =>
    wrap(() => steam.isSteamRunning())
  )

  ipcMain.handle(IPC.GET_USER_INFO, () =>
    wrap(() => steam.getUserInfo())
  )

  // ── Games ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_OWNED_GAMES, (_e, force?: boolean) =>
    wrap(() => steam.getOwnedGames(force))
  )

  // ── Achievements ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_ACHIEVEMENTS, (_e, appId: number) =>
    wrap(() => steam.getAchievements(appId))
  )

  ipcMain.handle(IPC.UNLOCK_ACHIEVEMENT, (_e, appId: number, apiName: string) =>
    wrap(() => steam.setAchievement(appId, apiName, true))
  )

  ipcMain.handle(IPC.LOCK_ACHIEVEMENT, (_e, appId: number, apiName: string) =>
    wrap(() => steam.setAchievement(appId, apiName, false))
  )

  ipcMain.handle(IPC.UNLOCK_ALL_ACHIEVEMENTS, (_e, appId: number) =>
    wrap(() => steam.setAllAchievements(appId, true))
  )

  ipcMain.handle(IPC.LOCK_ALL_ACHIEVEMENTS, (_e, appId: number) =>
    wrap(() => steam.setAllAchievements(appId, false))
  )

  ipcMain.handle(IPC.RESET_STATS, (_e, appId: number) =>
    wrap(() => steam.resetAllStats(appId))
  )

  ipcMain.handle(IPC.STOP_GAME, () =>
    wrap(() => steam.stopGame())
  )

  // ── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_SETTINGS, () => ({
    success: true,
    data: store.get('settings'),
  }))

  ipcMain.handle(IPC.SET_SETTINGS, (_e, settings: Partial<AppSettings>) => {
    const current = store.get('settings')
    const merged = { ...current, ...settings }
    store.set('settings', merged)
    return { success: true }
  })

  // ── Idle ──────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.IDLE_START, (_e, appId: number, name: string) => {
    try {
      idle.startIdle(appId, name)
      return { success: true, data: idle.getIdlingAppIds() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(IPC.IDLE_STOP, (_e, appId: number) => {
    try {
      idle.stopIdle(appId)
      return { success: true, data: idle.getIdlingAppIds() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(IPC.IDLE_STATUS, () => ({
    success: true,
    data: idle.getIdlingAppIds(),
  }))

  // ── Notifications ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SEND_NOTIFICATION, (_e, title: string, body: string, silent: boolean) => {
    try {
      if (!Notification.isSupported()) return { success: false, error: 'Not supported' }

      // Strip emoji on Windows — Segoe UI Emoji font isn’t always available in toast
      const stripEmoji = (s: string) =>
        s.replace(
          /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26ff]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g,
          ''
        ).replace(/\s{2,}/g, ' ').trim()

      const isWin = process.platform === 'win32'
      if (isWin) {
        title = stripEmoji(title)
        body  = stripEmoji(body)
      }

      const fs = require('fs')
      const iconCandidates = [
        path.join(__dirname, '../../../resources/notify.png'),
        path.join(app.getAppPath(), 'resources/notify.png'),
        path.join(process.resourcesPath ?? '', 'notify.png'),
        // fallback to steam.png if notify.png not found
        path.join(__dirname, '../../../resources/steam.png'),
        path.join(app.getAppPath(), 'resources/steam.png'),
      ]
      const iconPath = iconCandidates.find(p => { try { return fs.existsSync(p) } catch { return false } }) ?? iconCandidates[0]

      const n = new Notification({
        title,
        body,
        silent,
        icon: iconPath,
        // Windows-specific: show the notification for longer
        ...(isWin ? { timeoutType: 'default' as const } : {}),
      })
      n.show()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // ── Steam Store Featured / Deals (proxied from main to avoid CORS) ────────
  ipcMain.handle(IPC.GET_STEAM_FEATURED, async () => {
    try {
      const [catRes, featRes] = await Promise.allSettled([
        axios.get('https://store.steampowered.com/api/featuredcategories/?cc=us&l=english', { timeout: 8000 }),
        axios.get('https://store.steampowered.com/api/featured/?cc=us&l=english', { timeout: 8000 }),
      ])

      const deals: FeaturedGame[] = []
      const featured: FeaturedGame[] = []
      const freeGames: FeaturedGame[] = []
      const seen = new Set<number>()

      const toGame = (item: any, type: FeaturedGame['type']): FeaturedGame => ({
        id: item.id,
        name: item.name,
        header_image: item.header_image ||
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.id}/header.jpg`,
        discount_percent: item.discount_percent ?? 0,
        final_price: item.final_price ?? 0,
        original_price: item.original_price ?? 0,
        type: (item.final_price === 0 && item.original_price === 0) ? 'free'
            : (item.discount_percent ?? 0) > 0 ? 'sale' : type,
        url: `https://store.steampowered.com/app/${item.id}`,
      })

      if (catRes.status === 'fulfilled') {
        // Weekly specials / deals
        const specials: any[] = catRes.value.data?.specials?.items ?? []
        for (const item of specials.slice(0, 8)) {
          if (!item.id || seen.has(item.id)) continue
          seen.add(item.id)
          deals.push(toGame(item, 'sale'))
        }
        // Free This Week: free-to-play + free weekend promos
        const freePool: any[] = [
          ...(catRes.value.data?.free_to_play?.items ?? []),
          ...(catRes.value.data?.free_weekend?.items ?? []),
        ]
        for (const item of freePool.slice(0, 6)) {
          if (!item.id || seen.has(item.id)) continue
          seen.add(item.id)
          freeGames.push(toGame(item, 'free'))
        }
      }

      if (featRes.status === 'fulfilled') {
        for (const cat of ['large_capsules', 'featured_win', 'featured_mac']) {
          const items: any[] = featRes.value.data?.[cat] ?? []
          for (const item of items) {
            if (!item.id || seen.has(item.id)) continue
            seen.add(item.id)
            featured.push(toGame(item, 'featured'))
          }
        }
      }

      return { success: true, data: { deals: deals.slice(0, 8), featured: featured.slice(0, 6), freeGames: freeGames.slice(0, 6) } }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(IPC.SEARCH_GAMES, async (_e, term: string) => {
    try {
      const res = await axios.get(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=us`,
        { timeout: 6000 }
      )
      const items: any[] = res.data?.items ?? []
      const results = items
        .filter(i => i.type === 'app')
        .slice(0, 8)
        .map(i => ({
          appId: i.id as number,
          name:  i.name as string,
          headerImageUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${i.id}/header.jpg`,
          tiny_image: i.tiny_image as string | undefined,
          price: i.price,
        }))
      return { success: true, data: results }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(IPC.RESOLVE_APP_NAME, async (_e, appId: number) => {
    try {
      const res = await axios.get(
        `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`,
        { timeout: 6000 }
      )
      const data = res.data?.[appId]
      if (data?.success && data?.data?.name) {
        return { success: true, data: { name: data.data.name as string } }
      }
      return { success: true, data: { name: `App ${appId}` } }
    } catch (e: any) {
      return { success: true, data: { name: `App ${appId}` } }
    }
  })

  // ── Autostart ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.AUTOSTART_GET, () => {
    try {
      const loginSettings = app.getLoginItemSettings()
      return { success: true, data: loginSettings.openAtLogin }
    } catch {
      return { success: true, data: false }
    }
  })

  ipcMain.handle(IPC.AUTOSTART_SET, (_e, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
      })
      return { success: true, data: enabled }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
