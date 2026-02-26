import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types'

// Lazy singleton — created on first access, AFTER app.setPath('userData') has been called.
// This guarantees the store file lands in the correct ThomasThanos/Souvlatzidiko-Unlocker
// directory instead of Electron's default AppData path.
let _store: Store<{ settings: AppSettings }> | null = null

export function getStore(): Store<{ settings: AppSettings }> {
  if (!_store) {
    _store = new Store<{ settings: AppSettings }>({
      name: 'config',
      defaults: { settings: DEFAULT_SETTINGS },
    })
  }
  return _store
}
