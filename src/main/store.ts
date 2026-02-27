import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS, SteamGame } from '../shared/types'

interface StoreSchema {
  settings: AppSettings
  gamesCache?: { data: SteamGame[]; timestamp: number }
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

export function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new Store<StoreSchema>({
      name: 'config',
      defaults: { settings: DEFAULT_SETTINGS },
    })
  }
  return _store
}
