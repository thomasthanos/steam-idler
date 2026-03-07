import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS, IdleStats } from '../shared/types'

export const DEFAULT_IDLE_STATS: IdleStats = {
  totalGamesIdled: 0,
  totalSecondsIdled: 0,
  todayGamesIdled: 0,
  todaySecondsIdled: 0,
  lastResetDate: new Date().toISOString().slice(0, 10),
}

interface StoreSchema {
  settings: AppSettings
  idleStats: IdleStats
  /** @deprecated Moved to games-cache.json — kept here only so migration cleanup in client.ts can compile */
  gamesCache?: unknown
}

// Lazy singleton — created on first access, AFTER app.setPath('userData') has been called.
// This guarantees the store file lands in the correct ThomasThanos/Souvlatzidiko-Unlocker
// directory instead of Electron's default AppData path.
//
// IMPORTANT: Do NOT create a `new Store()` at module top-level anywhere in the
// main process. ES module imports are evaluated before any top-level code runs,
// so a module-level Store would be instantiated before app.setPath() executes
// and would resolve to the wrong (default Electron) userData directory.
let _store: Store<StoreSchema> | null = null

/**
 * Returns the current idle stats, resetting today's counters if the date has
 * changed since they were last written. Mutates and persists the store when a
 * reset is needed. Single source of truth — replaces the duplicated reset
 * blocks that previously existed in both handlers.ts and idleManager.ts.
 */
export function getIdleStatsResetting(): IdleStats {
  const store = getStore()
  const stats = { ...DEFAULT_IDLE_STATS, ...store.get('idleStats') } as IdleStats
  const today = new Date().toISOString().slice(0, 10)
  if (stats.lastResetDate !== today) {
    stats.todayGamesIdled = 0
    stats.todaySecondsIdled = 0
    stats.lastResetDate = today
    store.set('idleStats', stats)
  }
  return stats
}

export function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new Store<StoreSchema>({
      name: 'config',
      defaults: { settings: DEFAULT_SETTINGS, idleStats: DEFAULT_IDLE_STATS },
    })
  }
  return _store
}
