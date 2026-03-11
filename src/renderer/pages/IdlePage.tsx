import { useState, useEffect } from 'react'
import { Play, Square, Search, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppContext } from '../hooks/useAppContext'
import GameImage from '../components/GameImage'
import toast from 'react-hot-toast'

export default function IdlePage() {
  const { games, settings } = useAppContext()

  const notify = (title: string, body: string) => {
    if (!settings.notificationsEnabled) return
    window.steam.sendNotification(title, body, !settings.notificationSound).catch(() => {})
  }
  const [idlingIds, setIdlingIds] = useState<number[]>([])
  // Names keyed by appId, sourced from the idle manager via getIdlingGames().
  // This is the source-of-truth for the "Currently Idling" display.
  const [idlingNames, setIdlingNames] = useState<Record<number, string>>({})
  const [idlingSince, setIdlingSince] = useState<Record<number, number>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [now, setNow] = useState(Date.now())

  // Fetch current idle status on mount + listen for external changes
  // (tray stop-all, manual game launch detection, worker crashes, etc.)
  useEffect(() => {
    const refresh = () => {
      // Use getIdlingGames() so we always get the authoritative names from the
      // idle manager — this fixes the "App 12345" fallback appearing in
      // "Currently Idling" when the game was started from the Auto-Idle page
      // or via auto-idle-on-launch (where names come from settings, not library).
      window.steam.getIdlingGames().then(res => {
        if (res.success && res.data) {
          const nowMs = Date.now()
          setIdlingSince(old => {
            const next: Record<number, number> = {}
            for (const g of res.data!) {
              next[g.appId] = old[g.appId] ?? nowMs
            }
            return next
          })
          setIdlingIds(res.data!.map(g => g.appId))
          // Store names so "Currently Idling" can display them without
          // falling back to a library lookup or a generic App ID label.
          setIdlingNames(prev => {
            const next = { ...prev }
            for (const g of res.data!) next[g.appId] = g.name
            // Remove entries for games no longer idling
            for (const id of Object.keys(next)) {
              if (!res.data!.some(g => g.appId === Number(id))) delete next[Number(id)]
            }
            return next
          })
        }
      }).catch(() => {})
    }
    // Also seed start times from the main process on mount so elapsed timers
    // survive navigation away and back to this page.
    window.steam.getIdleStartTimes().then(res => {
      if (res.success && res.data) {
        setIdlingSince(old => {
          const merged: Record<number, number> = { ...old }
          for (const [id, ts] of Object.entries(res.data!)) {
            if (!(Number(id) in merged)) merged[Number(id)] = ts
          }
          return merged
        })
      }
    }).catch(() => {})

    refresh()
    const cleanupIdleChanged = window.steam.onIdleChanged(refresh)
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(t); cleanupIdleChanged() }
  }, [])

  const filteredGames = games.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  const formatElapsed = (startMs: number) => {
    const sec = Math.floor((now - startMs) / 1000)
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const startIdle = async (appId: number, name: string) => {
    setLoading(l => ({ ...l, [appId]: true }))
    try {
      const res = await window.steam.startIdle(appId, name)
      if (res.success && res.data) {
        setIdlingIds(res.data)
        setIdlingSince(m => ({ ...m, [appId]: Date.now() }))
        toast.success(`Now idling: ${name}`)
        notify('⚡ Idling Started', name)
      } else {
        toast.error(res.error ?? 'Failed to start idling')
      }
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Error')
    } finally {
      setLoading(l => ({ ...l, [appId]: false }))
    }
  }

  const stopIdle = async (appId: number) => {
    setLoading(l => ({ ...l, [appId]: true }))
    try {
      const res = await window.steam.stopIdle(appId)
      if (res.success && res.data) {
        setIdlingIds(res.data)
        setIdlingSince(m => {
          const copy = { ...m }
          delete copy[appId]
          return copy
        })
        const gameName = games.find(g => g.appId === appId)?.name ?? `App ${appId}`
        toast.success('Stopped idling')
        notify('⏹ Idling Stopped', gameName)
      } else {
        toast.error(res.error ?? 'Failed to stop')
      }
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Error')
    } finally {
      setLoading(l => ({ ...l, [appId]: false }))
    }
  }

  // Currently idling games — priority: (1) idle manager's name map, (2) library, (3) fallback.
  const currentlyIdling = idlingIds.map(id => ({
    appId: id,
    name: idlingNames[id]
      ?? games.find(x => x.appId === id)?.name
      ?? settings.autoIdleGames?.find(a => a.appId === id)?.name
      ?? `App ${id}`,
  }))

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-8 py-8">

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <Clock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Idling Games</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Manually idle a game to farm playtime or trigger achievements.
          </p>
        </motion.div>

        {/* Currently Idling */}
        {currentlyIdling.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
              Currently Idling
            </p>
            <div className="space-y-2">
              <AnimatePresence>
                {currentlyIdling.map(game => (
                  <motion.div
                    key={game.appId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-center gap-4 p-3 rounded-xl"
                    style={{ background: 'var(--card)', border: '1px solid rgba(34,197,94,0.25)' }}
                  >
                    <div className="w-16 h-9 rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
                      <GameImage appId={game.appId} name={game.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{game.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full idle-pulse" style={{ background: 'var(--green)' }} />
                        <p className="text-xs" style={{ color: 'var(--green)' }}>
                          Idling for {idlingSince[game.appId] ? formatElapsed(idlingSince[game.appId]) : '—'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => stopIdle(game.appId)}
                      disabled={loading[game.appId]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        color: 'var(--red)',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}
                    >
                      <Square className="w-3 h-3" />
                      Stop
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Game Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted)' }} />
            <input
              className="input w-full pl-9"
              placeholder="Search your games…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Game List */}
        <div className="space-y-1.5">
          {filteredGames.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
              No games found. Add games to your library or search differently.
            </p>
          )}
          {filteredGames.slice(0, 50).map(game => {
            const isIdling = idlingIds.includes(game.appId)
            const isLoading = loading[game.appId]
            return (
              <div
                key={game.appId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: isIdling ? 'rgba(34,197,94,0.05)' : 'var(--card)',
                  border: `1px solid ${isIdling ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                }}
              >
                <div className="w-14 h-8 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
                  <GameImage appId={game.appId} name={game.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{game.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    AppID: {game.appId}
                    {isIdling && idlingSince[game.appId] && (
                      <span style={{ color: 'var(--green)' }}> · {formatElapsed(idlingSince[game.appId])}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => isIdling ? stopIdle(game.appId) : startIdle(game.appId, game.name)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
                  style={isIdling
                    ? { background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }
                    : { background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.2)' }
                  }
                >
                  {isIdling
                    ? <><Square className="w-3 h-3" /> Stop</>
                    : <><Play className="w-3 h-3" /> Idle</>
                  }
                </button>
              </div>
            )
          })}
          {filteredGames.length > 50 && (
            <p className="text-xs text-center pt-2" style={{ color: 'var(--muted)' }}>
              Showing 50 of {filteredGames.length} games. Refine your search.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
