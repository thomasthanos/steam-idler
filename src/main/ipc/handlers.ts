import { app, ipcMain, BrowserWindow, shell } from 'electron'
import { showNotification } from '../managers/notificationManager'
import * as path from 'path'
import * as fs from 'fs'
import axios from 'axios'
import { IPC, IPCResponse, AppSettings, IdleGame, IdleStats, FeaturedGame, PartnerAppRelease, PartnerAppDownloadProgress, SteamAccountStatusInfo, QrLoginEvent } from '../../shared/types'
import { DEFAULT_IDLE_STATS, getIdleStatsResetting } from '../managers/store'
import { SteamClient } from '../steam/client'
import { IdleManager } from '../steam/idleManager'
import { SteamAccountManager } from '../steam/steamUser'
import { getStore } from '../managers/store'

function wrap<T>(fn: () => Promise<T>): Promise<IPCResponse<T>> {
  return fn()
    .then((data) => ({ success: true, data }))
    .catch((error: Error) => ({ success: false, error: error.message }))
}

export function setupIpcHandlers(steam: SteamClient, idle: IdleManager, steamAccount: SteamAccountManager): void {
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
      // Only allow known settings keys to prevent arbitrary key injection
      const ALLOWED_KEYS: Set<string> = new Set([
        'theme', 'steamApiKey', 'steamId', 'customAppIds', 'showGlobalPercent',
        'showHiddenAchievements', 'confirmBulkActions', 'minimizeToTray',
        'autostart', 'autoIdleGames', 'notificationsEnabled', 'notificationSound',
        'autoInvisibleWhenIdling', 'stopIdleOnGameLaunch', 'resumeIdleAfterGame', 'steamRefreshToken',
      ])
      const filtered = Object.fromEntries(
        Object.entries(settings).filter(([k]) => ALLOWED_KEYS.has(k))
      )
      const current = getStore().get('settings')
      const merged = { ...current, ...filtered }
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

  ipcMain.handle(IPC.GET_IDLE_STATS, () => {
    try {
      const stats = getIdleStatsResetting()
      // Add live elapsed time for currently-running sessions so the Settings
      // page shows accurate figures even while games are actively being idled.
      const liveSeconds = idle.getLiveElapsedSeconds()
      return {
        success: true,
        data: {
          ...stats,
          totalSecondsIdled: stats.totalSecondsIdled + liveSeconds,
          todaySecondsIdled: stats.todaySecondsIdled + liveSeconds,
        },
      }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle(IPC.IDLE_GET_START_TIMES, () => {
    try { return { success: true, data: idle.getIdleStartTimes() } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  // Returns idling games WITH their names (from the idle manager's internal
  // names map) — used by the IdlePage "Currently Idling" section so games
  // started from outside the library still show a proper name.
  ipcMain.handle(IPC.IDLE_GET_GAMES, () => {
    try { return { success: true, data: idle.getIdlingGames() } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle(IPC.RESET_IDLE_STATS, () => {
    try {
      getStore().set('idleStats', DEFAULT_IDLE_STATS)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // ── Notifications ────────────────────────────────────────────────────────
  // Custom overlay notifications via notificationManager.ts.
  // `silent` flag is accepted for API compatibility but the overlay is
  // always visual-only (no OS sound), so it is intentionally unused here.
  ipcMain.handle(IPC.SEND_NOTIFICATION, (_e, title: string, body: string, _silent: boolean) => {
    try {
      const settings = getStore().get('settings')
      if (settings.notificationsEnabled) {
        showNotification({ title, body, variant: 'info', duration: 5000 })
      }
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // ── Steam Store Featured / Deals (proxied from main to avoid CORS) ────────
  ipcMain.handle(IPC.GET_STEAM_FEATURED, async () => {
    // Delegate to steamClient which caches the result — the splash preload
    // calls steamClient.getSteamFeatured() so this returns instantly on first
    // renderer request after the app opens.
    try {
      const data = await steam.getSteamFeatured()
      return { success: true, data }
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

  // ── Steam Account (auto-invisible) ────────────────────────────────────────
  const pushAccountStatus = (info: SteamAccountStatusInfo) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.STEAM_ACCOUNT_STATUS_CHANGED, info)
    }
  }
  const pushQrEvent = (evt: QrLoginEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.STEAM_ACCOUNT_QR_EVENT, evt)
    }
  }

  steamAccount.on('status-changed', pushAccountStatus)

  // When QR login completes, save the refresh token so we can auto-reconnect next launch
  steamAccount.on('qr-login-complete', (refreshToken: string) => {
    try {
      const store = getStore()
      const current = store.get('settings')
      store.set('settings', { ...current, steamRefreshToken: Buffer.from(refreshToken).toString('base64') })
    } catch { /* ok */ }
  })

  // ── QR code login ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.STEAM_ACCOUNT_QR_START, async () => {
    try {
      // fire-and-forget: startQrLogin resolves after QR image is ready,
      // subsequent events are pushed via pushQrEvent
      steamAccount.startQrLogin(pushQrEvent).catch((e: Error) => {
        pushQrEvent({ type: 'error', message: e.message })
      })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(IPC.STEAM_ACCOUNT_QR_CANCEL, () => {
    try { steamAccount.cancelQrLogin(); return { success: true } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  // ── Cookie / refresh-token login ──────────────────────────────────────────
  ipcMain.handle(IPC.STEAM_ACCOUNT_TOKEN_LOGIN, async (_e, token: string) => {
    try {
      const decoded = decodeURIComponent(token.trim())
      const refreshToken = decoded.includes('||') ? decoded.split('||').pop()! : decoded

      await steamAccount.loginWithRefreshToken(refreshToken)

      const store = getStore()
      const current = store.get('settings')
      store.set('settings', { ...current, steamRefreshToken: Buffer.from(refreshToken).toString('base64') })

      return { success: true, data: steamAccount.getStatusInfo() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(IPC.STEAM_ACCOUNT_LOGOUT, () => {
    try {
      steamAccount.logout()
      const store = getStore()
      const current = store.get('settings')
      store.set('settings', { ...current, steamRefreshToken: undefined })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(IPC.STEAM_ACCOUNT_STATUS, () => {
    try { return { success: true, data: steamAccount.getStatusInfo() } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle(IPC.STEAM_ACCOUNT_SET_INVISIBLE, () => {
    try { steamAccount.setInvisible(); return { success: true } }
    catch (e: any) { return { success: false, error: e.message } }
  })

  // ── Image probe (silent HEAD via main process — no CORS, no console 404s) ──
  ipcMain.handle('image:probe', async (_e, url: string) => {
    try {
      const res = await axios.head(url, { timeout: 4000, validateStatus: () => true })
      return { success: true, data: res.status >= 200 && res.status < 300 }
    } catch {
      return { success: true, data: false }
    }
  })

  // ── Autostart ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.AUTOSTART_GET, () => {
    if (!app.isPackaged) return { success: true, data: false }
    try { return { success: true, data: app.getLoginItemSettings().openAtLogin } }
    catch { return { success: true, data: false } }
  })

  ipcMain.handle(IPC.AUTOSTART_SET, (_e, enabled: boolean) => {
    if (!app.isPackaged) return { success: true, data: false }
    try {
      app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
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

  ipcMain.handle(IPC.DOWNLOAD_PARTNER_APP, async (_e, key: string, url: string, fileName: string): Promise<IPCResponse<void>> => {
    const ALLOWED_HOSTS = ['github.com', 'objects.githubusercontent.com']
    try {
      const parsed = new URL(url)
      if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
        return { success: false, error: 'Download URL is not from a trusted source' }
      }
    } catch {
      return { success: false, error: 'Invalid download URL' }
    }

    const safeName = path.basename(fileName)
    if (!safeName || safeName.startsWith('.')) {
      return { success: false, error: 'Invalid file name' }
    }

    const pushProgress = (p: PartnerAppDownloadProgress) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(IPC.PARTNER_APP_DOWNLOAD_PROGRESS, p)
      }
    }

    const destPath = path.join(app.getPath('downloads'), safeName)

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
        writer.on('close', resolve)
        writer.on('error', reject)
        res.data.on('error', reject)
      })

      pushProgress({ key, percent: 100, done: true, filePath: destPath })

      return { success: true }
    } catch (e: any) {
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath) } catch {}
      pushProgress({ key, percent: 0, done: true, error: e.message })
      return { success: false, error: e.message }
    }
  })
}
