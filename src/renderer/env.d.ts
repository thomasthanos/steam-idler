import { SteamAPI, WindowAPI } from '../preload/index'

declare global {
  const __APP_VERSION__: string
  interface Window {
    steam: SteamAPI
    windowAPI: WindowAPI
  }
}
