import { SteamAPI, WindowAPI } from '../preload/index'

declare global {
  interface Window {
    steam: SteamAPI
    windowAPI: WindowAPI
  }
}
