// @refresh reset
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { SteamUser, AppSettings, DEFAULT_SETTINGS, SteamGame } from '@shared/types'
import toast from 'react-hot-toast'

interface AppContextType {
  user: SteamUser | null
  steamRunning: boolean
  settings: AppSettings
  isLoadingUser: boolean
  games: SteamGame[]
  isLoadingGames: boolean
  fetchGames: (force?: boolean) => Promise<void>
  updateSettings: (s: Partial<AppSettings>) => Promise<void>
  refreshUser: () => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SteamUser | null>(null)
  const [steamRunning, setSteamRunning] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [games, setGames] = useState<SteamGame[]>([])
  const [isLoadingGames, setIsLoadingGames] = useState(false)
  const [gamesFetched, setGamesFetched] = useState(false)

  const refreshUser = async () => {
    setIsLoadingUser(true)
    try {
      const statusRes = await window.steam.checkSteamRunning()
      setSteamRunning(statusRes.data ?? false)
      if (statusRes.data) {
        const userRes = await window.steam.getUserInfo()
        if (userRes.success && userRes.data) setUser(userRes.data)
      }
    } catch {
      toast.error('Failed to connect to Steam')
    } finally {
      setIsLoadingUser(false)
    }
  }

  const fetchGames = useCallback(async (force = false) => {
    if (gamesFetched && !force) return
    setIsLoadingGames(true)
    try {
      const res = await window.steam.getOwnedGames(force)
      if (res.success && res.data) {
        setGames(res.data)
        setGamesFetched(true)
      } else {
        toast.error(res.error ?? 'Failed to load games')
      }
    } catch {
      toast.error('Failed to load games')
    } finally {
      setIsLoadingGames(false)
    }
  }, [gamesFetched])

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial }
    setSettings(next)
    await window.steam.setSettings(partial)
    const gameRelatedKeys: (keyof AppSettings)[] = ['customAppIds', 'steamApiKey', 'steamId']
    if (gameRelatedKeys.some((k) => k in partial)) {
      setGamesFetched(false)
    }
  }

  useEffect(() => {
    window.steam.getSettings().then((res) => {
      if (res.success && res.data) setSettings(res.data)
    })

    // Startup: check Steam + load user + auto-fetch games in background
    const init = async () => {
      await refreshUser()
      // Kick off game fetch in background (shows cached data instantly if available)
      fetchGames()
    }
    init()

    // Auto-refresh Steam status every 30 seconds
    const interval = setInterval(async () => {
      try {
        const statusRes = await window.steam.checkSteamRunning()
        const isRunning = statusRes.data ?? false
        setSteamRunning(prev => {
          // If steam just reconnected, also refresh user info
          if (!prev && isRunning) {
            window.steam.getUserInfo().then(r => {
              if (r.success && r.data) setUser(r.data)
            }).catch(() => {})
          }
          return isRunning
        })
      } catch { /* silent */ }
    }, 30_000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppContext.Provider value={{
      user, steamRunning, settings, isLoadingUser,
      games, isLoadingGames, fetchGames,
      updateSettings, refreshUser,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
