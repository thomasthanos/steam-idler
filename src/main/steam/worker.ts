import * as sw from 'steamworks.js'
// runCallbacks may be a named export depending on the steamworks.js version
const { runCallbacks } = sw as any
import axios from 'axios'

type SteamClient = Omit<sw.Client, 'init' | 'runCallbacks'>

// ─── State ──────────────────────────────────────────────────────────────────
let client: SteamClient | null = null
let currentAppId = 0
let storedApiKey = ''

function send(id: number, ok: boolean, data?: unknown, error?: string) {
  process.stdout.write(JSON.stringify({ id, ok, data, error }) + '\n')
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface WorkerMessage {
  id: number
  type: 'INIT' | 'GET_ACHIEVEMENTS' | 'SET_ACHIEVEMENT' | 'SET_ALL_ACHIEVEMENTS'
       | 'GET_STATS' | 'SET_STAT' | 'RESET_STATS' | 'EXIT' | 'IDLE'
  appId?: number
  apiName?: string
  unlocked?: boolean
  value?: number
  apiKey?: string
}

interface SchemaAchievement {
  name: string
  displayName: string
  hidden: number
  description: string
  icon: string
  icongray: string
}

interface SchemaStats {
  name: string
  defaultvalue: number
  displayName: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchSchema(appId: number, apiKey: string) {
  const url = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}&l=english`
  const res = await axios.get(url, { timeout: 10000 })
  const stats = res?.data?.game?.availableGameStats
  return {
    achievements: (stats?.achievements ?? []) as SchemaAchievement[],
    stats: (stats?.stats ?? []) as SchemaStats[],
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────
function handleInit(id: number, appId: number, apiKey?: string) {
  try {
    process.env['SteamAppId'] = String(appId)
    client = sw.init(appId)
    currentAppId = appId
    if (apiKey) storedApiKey = apiKey
    // Start the callback loop immediately so Steam processes events
    startCallbackLoop()
    send(id, true, { appId })
  } catch (e: unknown) {
    send(id, false, undefined, (e as Error).message)
  }
}

async function handleGetAchievements(id: number) {
  if (!client) { send(id, false, undefined, 'Not initialised'); return }
  if (!storedApiKey) { send(id, false, undefined, 'Steam API key required to load achievements. Add one in Settings.'); return }

  try {
    const schema = await fetchSchema(currentAppId, storedApiKey)

    // Global percentages
    let globalPct: Record<string, number> = {}
    try {
      const url = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${currentAppId}`
      const res = await axios.get(url, { timeout: 6000 })
      const list: { name: string; percent: number }[] = res?.data?.achievementpercentages?.achievements ?? []
      globalPct = Object.fromEntries(list.map((a) => [a.name, a.percent]))
    } catch { /* optional */ }

    // Per-player unlock state via Web API
    let webAchMap: Record<string, { achieved: boolean; unlocktime: number }> = {}
    try {
      const steamId = client.localplayer.getSteamId().steamId64.toString()
      const url =
        `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/` +
        `?key=${storedApiKey}&steamid=${steamId}&appid=${currentAppId}&l=english`
      const res = await axios.get(url, { timeout: 8000 })
      const list: { apiname: string; achieved: number; unlocktime: number }[] =
        res?.data?.playerstats?.achievements ?? []
      webAchMap = Object.fromEntries(
        list.map((a) => [a.apiname, { achieved: a.achieved === 1, unlocktime: a.unlocktime }])
      )
    } catch { /* fall back to local steamworks */ }

    const achievements = schema.achievements.map((s) => {
      const web = webAchMap[s.name]
      const unlocked = web !== undefined ? web.achieved : client!.achievement.isActivated(s.name)
      const unlockedAt = web?.unlocktime && web.unlocktime > 0 ? web.unlocktime : undefined
      return {
        apiName: s.name,
        displayName: s.displayName || s.name,
        description: s.description || '',
        iconUrl: s.icon,
        iconGrayUrl: s.icongray,
        unlocked,
        unlockedAt,
        globalPercent: globalPct[s.name],
        hidden: s.hidden === 1,
      }
    })

    send(id, true, achievements)
  } catch (e: unknown) {
    send(id, false, undefined, (e as Error).message)
  }
}

function handleSetAchievement(id: number, apiName: string, unlocked: boolean) {
  if (!client) { send(id, false, undefined, 'Not initialised'); return }
  try {
    if (unlocked) client.achievement.activate(apiName)
    else client.achievement.clear(apiName)
    client.stats.store()
    send(id, true)
  } catch (e: unknown) {
    send(id, false, undefined, (e as Error).message)
  }
}

async function handleSetAllAchievements(id: number, unlocked: boolean) {
  if (!client) { send(id, false, undefined, 'Not initialised'); return }
  if (!storedApiKey) { send(id, false, undefined, 'Steam API key required. Add one in Settings.'); return }
  try {
    const schema = await fetchSchema(currentAppId, storedApiKey)
    for (const a of schema.achievements) {
      if (unlocked) client.achievement.activate(a.name)
      else client.achievement.clear(a.name)
    }
    client.stats.store()
    send(id, true, { count: schema.achievements.length })
  } catch (e: unknown) {
    send(id, false, undefined, (e as Error).message)
  }
}

async function handleGetStats(id: number) {
  if (!client) { send(id, false, undefined, 'Not initialised'); return }
  if (!storedApiKey) { send(id, false, undefined, 'Steam API key required. Add one in Settings.'); return }
  try {
    const schema = await fetchSchema(currentAppId, storedApiKey)
    const stats = schema.stats.map((s) => ({
      apiName: s.name,
      displayName: s.displayName || s.name,
      value: client!.stats.getInt(s.name) ?? 0,
      defaultValue: s.defaultvalue,
    }))
    send(id, true, stats)
  } catch (e: unknown) {
    send(id, false, undefined, (e as Error).message)
  }
}

function handleSetStat(id: number, apiName: string, value: number) {
  if (!client) { send(id, false, undefined, 'Not initialised'); return }
  try {
    client.stats.setInt(apiName, Math.round(value))
    client.stats.store()
    send(id, true)
  } catch (e: unknown) {
    send(id, false, undefined, (e as Error).message)
  }
}

function handleResetStats(id: number) {
  if (!client) { send(id, false, undefined, 'Not initialised'); return }
  try {
    client.stats.resetAll(true)
    send(id, true)
  } catch (e: unknown) {
    send(id, false, undefined, (e as Error).message)
  }
}

// ─── runCallbacks loop (keeps Steamworks alive after init) ──────────────────
let callbackInterval: ReturnType<typeof setInterval> | null = null

function startCallbackLoop() {
  if (callbackInterval) return
  callbackInterval = setInterval(() => {
    try { runCallbacks?.() } catch { /* ok */ }
  }, 250)
}

// ─── Message loop ────────────────────────────────────────────────────────────
let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk: string) => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let msg: WorkerMessage
    try { msg = JSON.parse(trimmed) } catch { continue }
    switch (msg.type) {
      case 'INIT':                 handleInit(msg.id, msg.appId!, msg.apiKey); break
      case 'GET_ACHIEVEMENTS':     handleGetAchievements(msg.id); break
      case 'SET_ACHIEVEMENT':      handleSetAchievement(msg.id, msg.apiName!, msg.unlocked!); break
      case 'SET_ALL_ACHIEVEMENTS': handleSetAllAchievements(msg.id, msg.unlocked!); break
      case 'GET_STATS':            handleGetStats(msg.id); break
      case 'SET_STAT':             handleSetStat(msg.id, msg.apiName!, msg.value!); break
      case 'RESET_STATS':          handleResetStats(msg.id); break
      case 'EXIT':                 process.exit(0); break
      case 'IDLE':                 handleIdle(msg.id); break
    }
  }
})
process.stdin.on('end', () => process.exit(0))

// ─── Idle handler ────────────────────────────────────────────────────────────
// No separate idle interval needed — startCallbackLoop() at INIT (250 ms)
// already keeps Steamworks alive. A second loop would duplicate runCallbacks().

function handleIdle(id: number) {
  if (!client) { send(id, false, undefined, 'Not initialised'); return }
  // callbackLoop is already running from INIT — nothing extra to start
  send(id, true, { idling: true })
}
