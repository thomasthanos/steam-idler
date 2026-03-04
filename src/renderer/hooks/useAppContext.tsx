// @refresh reset
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { SteamUser, AppSettings, DEFAULT_SETTINGS, SteamGame, FeaturedGame } from '@shared/types'
import toast from 'react-hot-toast'

interface FeaturedData {
  deals: FeaturedGame[]
  featured: FeaturedGame[]
  freeGames: FeaturedGame[]
}

interface AppContextType {
  user: SteamUser | null
  steamRunning: boolean
  settings: AppSettings
  isLoadingUser: boolean
  games: SteamGame[]
  isLoadingGames: boolean
  recentGames: SteamGame[]
  featuredData: FeaturedData
  isLoadingFeatured: boolean
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
  const [recentGames, setRecentGames] = useState<SteamGame[]>([])
  const [featuredData, setFeaturedData] = useState<FeaturedData>({ deals: [], featured: [], freeGames: [] })
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(true)

  // Fix #7 – Request deduplication for rapid settings saves.
  // Holds the timer id for the pending debounced flush.
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Accumulates partial updates that haven't been flushed yet.
  const pendingSaveRef = useRef<Partial<AppSettings>>({})
  // Snapshot of settings BEFORE the first optimistic update in the current batch.
  // Used to roll back ALL keys in the batch if the server call fails.
  const preOptimisticRef = useRef<Partial<AppSettings> | null>(null)

  const refreshUser = useCallback(async () => {
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
  }, [])

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

  // Accumulates pending resolve/reject callbacks so rapid callers all settle.
  const pendingCallbacksRef = useRef<Array<{ resolve: () => void; reject: (e: Error) => void }>>([])

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    // --- Capture the pre-batch snapshot on the FIRST call in a new batch ---
    setSettings(prev => {
      if (preOptimisticRef.current === null) {
        const snap: Partial<AppSettings> = {}
        for (const k of Object.keys(partial) as (keyof AppSettings)[]) {
          ;(snap as Record<string, unknown>)[k] = prev[k]
        }
        preOptimisticRef.current = snap
      } else {
        for (const k of Object.keys(partial) as (keyof AppSettings)[]) {
          if (!(k in preOptimisticRef.current!)) {
            ;(preOptimisticRef.current as Record<string, unknown>)[k] = prev[k]
          }
        }
      }
      return { ...prev, ...partial }
    })

    // --- Deduplication: merge this partial into the pending batch ---
    pendingSaveRef.current = { ...pendingSaveRef.current, ...partial }

    // If a flush is already scheduled, reschedule it so we coalesce rapid
    // calls (e.g. toggling several toggles in quick succession) into one IPC.
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)

    await new Promise<void>((resolve, reject) => {
      pendingCallbacksRef.current.push({ resolve, reject })

      saveTimerRef.current = setTimeout(async () => {
        saveTimerRef.current = null
        const batch = pendingSaveRef.current
        const snapshot = preOptimisticRef.current
        const callbacks = pendingCallbacksRef.current
        pendingSaveRef.current = {}
        preOptimisticRef.current = null
        pendingCallbacksRef.current = []

        try {
          const res = await window.steam.setSettings(batch)
          if (!res.success) {
            if (snapshot) setSettings(prev => ({ ...prev, ...snapshot }))
            const err = new Error(res.error ?? 'Failed to save settings')
            for (const cb of callbacks) cb.reject(err)
            return
          }

          const gameRelatedKeys: (keyof AppSettings)[] = ['customAppIds', 'steamApiKey', 'steamId']
          if (gameRelatedKeys.some((k) => k in batch)) {
            setIsLoadingGames(true)
            window.steam.getOwnedGames(true)
              .then(r => {
                if (r.success && r.data) { setGames(r.data); setGamesFetched(true) }
              })
              .catch(() => { /* silent */ })
              .finally(() => setIsLoadingGames(false))
          }

          for (const cb of callbacks) cb.resolve()
        } catch (e) {
          for (const cb of callbacks) cb.reject(e as Error)
        }
      }, 150)
    })
  }, [])

  // Cleanup debounce timer on unmount (prevents state updates after unmount)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    // Fire all startup requests in parallel — main process has preloaded
    // Steam status, user info and games cache during the splash screen,
    // so every IPC call here returns almost instantly.
    const init = async () => {
      const [settingsRes] = await Promise.all([
        window.steam.getSettings(),
        refreshUser(),
      ])
      if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data)
      // Games were preloaded into cache — fetchGames() returns from cache immediately
      fetchGames()
      // Recent games were preloaded during splash — fetch immediately from cache
      window.steam.getRecentGames().then(res => {
        if (res.success && res.data) setRecentGames(res.data)
      }).catch(() => {})
      // Fetch Steam featured data once and cache in context
      setIsLoadingFeatured(true)
      window.steam.getSteamFeatured().then(res => {
        if (res.success && res.data) {
          setFeaturedData({
            deals: res.data.deals ?? [],
            featured: res.data.featured ?? [],
            freeGames: res.data.freeGames ?? [],
          })
        }
      }).catch(() => {}).finally(() => setIsLoadingFeatured(false))
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
  games, isLoadingGames, recentGames, fetchGames,
  featuredData, isLoadingFeatured,
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
