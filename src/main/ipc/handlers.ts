import { app, ipcMain, Notification, BrowserWindow, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import axios from 'axios'
import { IPC, IPCResponse, AppSettings, IdleGame, FeaturedGame, PartnerAppRelease, PartnerAppDownloadProgress } from '../../shared/types'
import { SteamClient } from '../steam/client'
import { IdleManager } from '../steam/idleManager'
import { getStore } from '../store'

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

  ipcMain.handle(IPC.GET_RECENT_GAMES, () =>
    wrap(() => steam.getRecentGames())
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

  ipcMain.handle(IPC.STOP_GAME, (_e, appId?: number) =>
    wrap(() => steam.stopGame(appId))
  )

  // ── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_SETTINGS, () => {
    try { return { success: true, data: getStore().get('settings') } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle(IPC.SET_SETTINGS, (_e, settings: Partial<AppSettings>) => {
    try {
      const current = getStore().get('settings')
      const merged = { ...current, ...settings }
      getStore().set('settings', merged)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
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

  ipcMain.handle(IPC.IDLE_STATUS, () => {
    try { return { success: true, data: idle.getIdlingAppIds() } }
    catch (e: any) { return { success: false, error: e.message } }
  })

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
    try { return { success: true, data: app.getLoginItemSettings().openAtLogin } }
    catch { return { success: true, data: false } }
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

  // ── Partner Apps ──────────────────────────────────────────────────────────

  const PARTNER_APPS: Array<{ key: string; owner: string; repo: string }> = [
    { key: 'myle',          owner: 'thomasthanos', repo: 'Make_Your_Life_Easier.A.E' },
    { key: 'gbr',           owner: 'thomasthanos', repo: 'Github-Build-Release' },
    { key: 'backup',        owner: 'thomasthanos', repo: 'backup_projects' },
    { key: 'discordviewer', owner: 'thomasthanos', repo: 'discord_package_viewer' },
  ]

  // Fetch latest release info for both partner apps from GitHub API
  ipcMain.handle(IPC.GET_PARTNER_APP_RELEASES, async (): Promise<IPCResponse<PartnerAppRelease[]>> => {
    try {
      const results = await Promise.all(
        PARTNER_APPS.map(async ({ key, owner, repo }) => {
          const res = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
            { timeout: 8000, headers: { Accept: 'application/vnd.github+json' } }
          )
          const release = res.data
          const asset = (release.assets as any[]).find((a: any) =>
            (a.name as string).endsWith('.exe')
          )
          if (!asset) throw new Error(`No .exe asset found in ${repo} latest release`)
          const version: string = (release.tag_name as string).replace(/^v/, '')
          return {
            key,
            version,
            downloadUrl: asset.browser_download_url as string,
            fileName: asset.name as string,
            sizeBytes: asset.size as number,
          } satisfies PartnerAppRelease
        })
      )
      return { success: true, data: results }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // Download a partner app installer to the user's Downloads folder
  ipcMain.handle(IPC.DOWNLOAD_PARTNER_APP, async (_e, key: string, url: string, fileName: string): Promise<IPCResponse<void>> => {
    const pushProgress = (p: PartnerAppDownloadProgress) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(IPC.PARTNER_APP_DOWNLOAD_PROGRESS, p)
      }
    }

    const destPath = path.join(app.getPath('downloads'), fileName)

    try {
      const res = await axios.get(url, {
        responseType: 'stream',
        timeout: 0,
        headers: { Accept: 'application/octet-stream' },
        maxRedirects: 5,
      })

      const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10)
      let downloaded = 0
      let lastPercent = -1

      const writer = fs.createWriteStream(destPath)

      res.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        if (totalBytes > 0) {
          const pct = Math.round((downloaded / totalBytes) * 100)
          if (pct !== lastPercent) {
            lastPercent = pct
            pushProgress({ key, percent: pct, done: false })
          }
        }
      })

      await new Promise<void>((resolve, reject) => {
        res.data.pipe(writer)
        // Use 'close' (not 'finish') — 'close' fires after the OS releases the file handle
        writer.on('close', resolve)
        writer.on('error', reject)
        res.data.on('error', reject)
      })

      pushProgress({ key, percent: 100, done: true, filePath: destPath })
      // Small grace period to ensure Windows fully releases the handle before launching
      await new Promise(r => setTimeout(r, 300))
      await shell.openPath(destPath)

      return { success: true }
    } catch (e: any) {
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath) } catch {}
      pushProgress({ key, percent: 0, done: true, error: e.message })
      return { success: false, error: e.message }
    }
  })
}
