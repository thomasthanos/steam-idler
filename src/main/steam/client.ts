/**
 * client.ts  –  Main process Steam client
 *
 * Architecture (same as SAM):
 *  ┌─────────────────────────────┐
 *  │  Main Process (this file)   │
 *  │  - reads local Steam files  │
 *  │  - manages worker process   │
 *  └──────────┬──────────────────┘
 *             │ stdin/stdout JSON-lines
 *  ┌──────────▼──────────────────┐
 *  │  Worker Process             │  ← separate child process per game
 *  │  SteamAppId = <appId>       │    (mirrors SAM.Game.exe concept)
 *  │  sw.init(appId)             │
 *  │  sw.achievement.*           │
 *  │  sw.stats.*                 │
 *  └─────────────────────────────┘
 *
 * Game list comes from local steamapps/*.acf files — no Web API key needed.
 * Achievement schema comes from the free public Steam Web API endpoint.
 *
 * NOTE: We deliberately avoid sw.init(480) in the main process to prevent
 * Steam from showing "Spacewar" as currently playing.
 */

import { ChildProcess, spawn, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import Store from 'electron-store'
import axios from 'axios'

import {
  Achievement,
  AppSettings,
  DEFAULT_SETTINGS,
  SteamGame,
  SteamUser,
} from '../../shared/types'
import {
  getSteamPath,
  readInstalledApps,
  readLoginUsers,
  AcfApp,
} from './steamPaths'

type SteamClientObj = any

// ─── Persistent settings ───────────────────────────────────────────────────
const store = new Store<{ settings: AppSettings; gamesCache?: { data: SteamGame[]; timestamp: number } }>({
  name: 'config',           // explicit filename → config.json
  defaults: { settings: DEFAULT_SETTINGS },
})
function getSettings(): AppSettings { return store.get('settings') }

// ─── Games cache ────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getCachedGames(): SteamGame[] | null {
  const cached = store.get('gamesCache') as { data: SteamGame[]; timestamp: number } | undefined
  if (!cached) return null
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null
  return cached.data
}

function setCachedGames(data: SteamGame[]): void {
  store.set('gamesCache', { data, timestamp: Date.now() })
}

function clearGamesCache(): void {
  store.delete('gamesCache' as any)
}

// ─── Worker bridge ─────────────────────────────────────────────────────────

interface PendingCallback {
  resolve: (data: unknown) => void
  reject: (err: Error) => void
}

class WorkerBridge {
  private proc: ChildProcess | null = null
  private pending = new Map<number, PendingCallback>()
  private msgId = 0
  private buffer = ''
  private currentAppId = 0
  private lastApiKey = ''

  private get workerPath(): string {
    return path.join(__dirname, 'worker.js')
  }

  async ensure(appId: number): Promise<void> {
    const settings = getSettings()
    const apiKey = settings.steamApiKey ?? ''

    if (this.proc && this.currentAppId === appId && this.lastApiKey === apiKey) return
    await this.kill()

    const proc = spawn(process.execPath, [this.workerPath], {
      env: { ...process.env, SteamAppId: String(appId), ELECTRON_RUN_AS_NODE: '1', ELECTRON_NO_ASAR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.proc = proc

    proc.stderr!.setEncoding('utf8')
    proc.stderr!.on('data', (chunk: string) => {
      console.error(`[worker stderr] ${chunk.trim()}`)
    })

    this.currentAppId = appId
    this.lastApiKey = apiKey
    this.buffer = ''

    proc.stdout!.setEncoding('utf8')
    proc.stdout!.on('data', (chunk: string) => {
      this.buffer += chunk
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''
      for (const line of lines) {
        const t = line.trim()
        if (!t) continue
        try {
          const msg = JSON.parse(t) as { id: number; ok: boolean; data?: unknown; error?: string }
          const cb = this.pending.get(msg.id)
          if (!cb) continue
          this.pending.delete(msg.id)
          if (msg.ok) cb.resolve(msg.data)
          else cb.reject(new Error(msg.error ?? 'Worker error'))
        } catch { /* ignore malformed */ }
      }
    })

    proc.on('exit', (code, signal) => {
      console.error(`[worker] exited with code=${code} signal=${signal}`)
      // Only clean up if this proc is still the active one (kill() may have already nulled it)
      if (this.proc === proc) {
        this.proc = null
        this.currentAppId = 0
        this.lastApiKey = ''
        for (const [, cb] of this.pending) {
          cb.reject(new Error('Steam worker process exited unexpectedly'))
        }
        this.pending.clear()
      }
    })

    await this.send({ type: 'INIT', appId, apiKey: apiKey || undefined }, proc)
  }

  send(msg: Omit<{ id: number; type: string;[k: string]: unknown }, 'id'>, targetProc?: ChildProcess): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const p = targetProc ?? this.proc
      if (!p) { reject(new Error('Worker not running')); return }
      // Guard: stdin may be closed if kill() was called concurrently
      if (!p.stdin || !p.stdin.writable) {
        reject(new Error('Worker stdin is closed'))
        return
      }
      const id = ++this.msgId
      this.pending.set(id, { resolve, reject })
      try {
        p.stdin.write(JSON.stringify({ ...msg, id }) + '\n')
      } catch (err) {
        this.pending.delete(id)
        reject(err)
      }
    })
  }

  async kill(): Promise<void> {
    if (!this.proc) return
    const proc = this.proc
    // Null out immediately so any concurrent send() sees no proc
    this.proc = null
    this.currentAppId = 0
    this.lastApiKey = ''
    // Reject all pending calls
    for (const [, cb] of this.pending) {
      cb.reject(new Error('Worker stopped'))
    }
    this.pending.clear()
    try { proc.stdin!.end() } catch { /* ok */ }
    await new Promise<void>((r) => {
      const t = setTimeout(() => { proc.kill(); r() }, 3000)
      proc.once('exit', () => { clearTimeout(t); r() })
    })
  }
}

const worker = new WorkerBridge()

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse comma-separated customAppIds setting → number[] */
function parseCustomAppIds(raw: string | undefined): number[] {
  if (!raw?.trim()) return []
  return raw.split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n > 0)
}

/** Try to resolve a game name from the Steam Store API. Returns null on failure. */
async function fetchStoreName(appId: number): Promise<string | null> {
  try {
    const res = await axios.get(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`,
      { timeout: 5000 }
    )
    const data = res?.data?.[appId]
    if (data?.success && data?.data?.name) return data.data.name as string
  } catch { /* network/timeout */ }
  return null
}

/** Check if Steam is running via OS process list (avoids steamworks init / Spacewar) */
function detectSteamProcess(): boolean {
  try {
    if (process.platform === 'win32') {
      const out = execSync('tasklist /FI "IMAGENAME eq steam.exe" /NH', {
        timeout: 3000,
        windowsHide: true,
      }).toString()
      return out.toLowerCase().includes('steam.exe')
    } else if (process.platform === 'darwin') {
      const out = execSync('pgrep -x steam || pgrep -x Steam', { timeout: 3000 }).toString()
      return out.trim().length > 0
    } else {
      const out = execSync('pgrep -x steam', { timeout: 3000 }).toString()
      return out.trim().length > 0
    }
  } catch {
    return false
  }
}

// ─── SteamClient (main-process API) ────────────────────────────────────────

export class SteamClient {

  // ── Steam Running ─────────────────────────────────────────────────────────
  // Uses process detection instead of sw.init(480) to avoid "Spacewar" appearing.
  async isSteamRunning(): Promise<boolean> {
    return detectSteamProcess()
  }

  // ── User Info ─────────────────────────────────────────────────────────────
  async getUserInfo(): Promise<SteamUser> {
    const settings = getSettings()
    let steamId64 = settings.steamId || ''
    let personaName = 'Steam User'
    let level = 0

    // Try to get steamId from login users file (no steamworks init needed)
    if (!steamId64) {
      try {
        const users = readLoginUsers(getSteamPath())
        const recent = users[0]
        if (recent) {
          steamId64 = recent.steamId64
          personaName = recent.personaName
        }
      } catch { /* ok */ }
    }

    let avatarUrl = ''

    // Use Steam Web API if key available
    if (settings.steamApiKey && steamId64) {
      try {
        const res = await axios.get(
          `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${settings.steamApiKey}&steamids=${steamId64}`,
          { timeout: 5000 }
        )
        const player = res?.data?.response?.players?.[0] as {
          avatarfull?: string
          personaname?: string
          steamid?: string
          player_level?: number
        } | undefined
        if (player?.avatarfull) avatarUrl = player.avatarfull
        if (player?.personaname) personaName = player.personaname
      } catch { /* keep defaults */ }
    }

    if (!avatarUrl && steamId64) {
      avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(personaName.slice(0, 2).toUpperCase())}&background=1a9fff&color=fff&size=128&bold=true`
    }

    return {
      steamId: steamId64,
      personaName,
      avatarUrl,
      profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
      level,
    }
  }

  // ── Owned Games ───────────────────────────────────────────────────────────
  async getOwnedGames(force = false): Promise<SteamGame[]> {
    if (!force) {
      const cached = getCachedGames()
      if (cached) return cached
    }
    const steamPath = getSteamPath()
    const settings = getSettings()
    const customAppIds = parseCustomAppIds(settings.customAppIds)


    // ── 1. Read locally installed games from ACF files ──────────────────────
    let installed: AcfApp[] = []
    try {
      installed = readInstalledApps(steamPath)
    } catch (e) {
      console.warn('[getOwnedGames] Failed to read installed apps:', e)
    }

    const gamesMap = new Map<number, SteamGame>()
    const SKIP_NAMES = /redistributable|soundtrack|dedicated server|obs studio|wallpaper engine|desktop mate|proton|steamworks/i
    const SKIP_APPIDS = new Set([228980, 1826330, 2434870, 1905180, 431960, 3301060])

    const addGame = (appId: number, name: string, playtime = 0, lastPlayed = 0, forceShow = false) => {
      if (!forceShow && (SKIP_APPIDS.has(appId) || SKIP_NAMES.test(name))) return
      if (!gamesMap.has(appId)) {
        gamesMap.set(appId, {
          appId, name,
          iconUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
          headerImageUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
          playtimeForever: playtime,
          achievementCount: 0, achievementsUnlocked: 0, achievementPercentage: 0,
          lastPlayed,
        })
      }
    }

    for (const app of installed) {
      addGame(app.appId, app.name, 0, app.lastPlayed)
    }

    // ── 2. Force-add custom AppIDs ──────────────────────────────────────────
    const customToResolve = customAppIds.filter(id => !gamesMap.has(id))
    await Promise.allSettled(
      customToResolve.map(async (id) => {
        const name = (await fetchStoreName(id)) ?? `App ${id}`
        addGame(id, name, 0, 0, true)
      })
    )

    // ── 3. Fetch full owned games list from Steam Web API ───────────────────
    let steamId64 = settings.steamId || ''
    if (settings.steamApiKey) {
      try {
        if (!steamId64) {
          const users = readLoginUsers(steamPath)
          if (users[0]) steamId64 = users[0].steamId64
        }
        if (!steamId64) throw new Error('No Steam ID found')

        const res = await axios.get(
          `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${settings.steamApiKey}&steamid=${steamId64}&include_appinfo=1&include_played_free_games=1`,
          { timeout: 10000 }
        )
        const webGames: { appid: number; name: string; playtime_forever: number; rtime_last_played: number }[] = res?.data?.response?.games ?? []

        for (const wg of webGames) {
          addGame(wg.appid, wg.name, wg.playtime_forever, wg.rtime_last_played)
        }

        // ── 4. Fetch achievement counts in batches ──────────────────────────
        const appIdsForStats = Array.from(gamesMap.keys()).filter(id =>
          customAppIds.includes(id) ||
          (gamesMap.get(id)!.playtimeForever > 0) ||
          installed.some(ia => ia.appId === id)
        )

        for (let i = 0; i < appIdsForStats.length; i += 10) {
          const chunk = appIdsForStats.slice(i, i + 10)
          await Promise.allSettled(chunk.map(async (appid) => {
            try {
              const achRes = await axios.get(
                `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${settings.steamApiKey}&steamid=${steamId64}&appid=${appid}`,
                { timeout: 4000 }
              )
              const achs: { achieved: number }[] = achRes?.data?.playerstats?.achievements ?? []
              if (achs.length > 0) {
                const game = gamesMap.get(appid)
                if (game) {
                  game.achievementCount = achs.length
                  game.achievementsUnlocked = achs.filter(a => a.achieved === 1).length
                  game.achievementPercentage = Math.round((game.achievementsUnlocked / game.achievementCount) * 100)
                }
              }
            } catch { /* game has no stats or private profile */ }
          }))
        }
      } catch (e) {
        console.warn('[getOwnedGames] Steam Web API error:', e)
      }
    }

    // ── 5. Final filter ─────────────────────────────────────────────────────
    const hasAnyStats = Array.from(gamesMap.values()).some(g => g.achievementCount > 0)
    let finalGames = Array.from(gamesMap.values())

    if (settings.steamApiKey && hasAnyStats) {
      finalGames = finalGames.filter(g =>
        g.achievementCount > 0 ||
        customAppIds.includes(g.appId)
      )
    }

    const result = finalGames.sort((a, b) => a.name.localeCompare(b.name))
    setCachedGames(result)
    return result
  }

  // ── Achievements ──────────────────────────────────────────────────────────
  async getAchievements(appId: number): Promise<Achievement[]> {
    await worker.ensure(appId)
    return worker.send({ type: 'GET_ACHIEVEMENTS' }) as Promise<Achievement[]>
  }

  async setAchievement(appId: number, apiName: string, unlocked: boolean): Promise<void> {
    await worker.ensure(appId)
    await worker.send({ type: 'SET_ACHIEVEMENT', apiName, unlocked })
  }

  async setAllAchievements(appId: number, unlocked: boolean): Promise<void> {
    await worker.ensure(appId)
    await worker.send({ type: 'SET_ALL_ACHIEVEMENTS', unlocked })
  }

  async resetAllStats(appId: number): Promise<void> {
    await worker.ensure(appId)
    await worker.send({ type: 'RESET_STATS' })
  }

  // ── Stop current game (kill worker) ────────────────────────────────────────
  async stopGame(): Promise<void> {
    await worker.kill()
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  async destroy(): Promise<void> {
    await worker.kill()
  }
}
