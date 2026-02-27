import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Play, Square, Plus, Trash2, Search, X, Loader } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppContext } from '../hooks/useAppContext'
import { IdleGame } from '@shared/types'
import GameImage from '../components/GameImage'
import toast from 'react-hot-toast'

interface SearchResult {
  appId: number
  name: string
  headerImageUrl: string
  tiny_image?: string
  price?: { final_formatted?: string; discount_percent?: number }
}

export default function AutoIdlePage() {
  const { settings, updateSettings } = useAppContext()

  const notify = (title: string, body: string) => {
    if (!settings.notificationsEnabled) return
    window.steam.sendNotification(title, body, !settings.notificationSound).catch(() => {})
  }

  const [idlingIds, setIdlingIds]   = useState<number[]>([])
  const [loading, setLoading]       = useState<Record<number, boolean>>({})

  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching]         = useState(false)
  const [showDropdown, setShowDropdown]   = useState(false)
  const searchRef   = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const savedGames: IdleGame[] = settings.autoIdleGames ?? []

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    window.steam.getIdleStatus().then(res => {
      if (res.success && res.data) setIdlingIds(res.data)
    })
  }, [])

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) { setSearchResults([]); setShowDropdown(false); return }
    setSearching(true); setShowDropdown(true)
    try {
      const res = await window.steam.searchGames(term)
      setSearchResults(res.success && res.data ? res.data : [])
    } catch { setSearchResults([]) }
    finally   { setSearching(false) }
  }, [])

  const handleSearchInput = (val: string) => {
    setSearchQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setSearchResults([]); setShowDropdown(false); return }
    setShowDropdown(true); setSearching(true)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  const addFromResult = async (result: SearchResult) => {
    setShowDropdown(false); setSearchQuery(''); setSearchResults([])
    if (savedGames.some(g => g.appId === result.appId)) { toast('Already in list', { icon: 'ℹ️' }); return }
    await updateSettings({ autoIdleGames: [...savedGames, { appId: result.appId, name: result.name, headerImageUrl: result.headerImageUrl }] })
    toast.success(`Added: ${result.name}`)
  }

  const addFromAppId = async () => {
    const trimmed = searchQuery.trim()
    const asNumber = parseInt(trimmed, 10)
    if (/^\d+$/.test(trimmed) && Number.isFinite(asNumber) && asNumber > 0) {
      if (savedGames.some(g => g.appId === asNumber)) { toast('Already in list', { icon: 'ℹ️' }); return }
      setSearching(true)
      try {
        const res  = await window.steam.resolveAppName(asNumber)
        const name = res.data?.name ?? `App ${asNumber}`
        await updateSettings({ autoIdleGames: [...savedGames, { appId: asNumber, name, headerImageUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${asNumber}/header.jpg` }] })
        setSearchQuery('')
        toast.success(`Added: ${name}`)
      } finally { setSearching(false) }
      return
    }
    if (searchResults.length > 0) addFromResult(searchResults[0])
  }

  const removeGame = async (appId: number) => {
    if (idlingIds.includes(appId)) {
      await window.steam.stopIdle(appId)
      setIdlingIds(ids => ids.filter(i => i !== appId))
    }
    await updateSettings({ autoIdleGames: savedGames.filter(g => g.appId !== appId) })
    toast.success('Removed')
  }

  const startIdle = async (game: IdleGame) => {
    setLoading(l => ({ ...l, [game.appId]: true }))
    try {
      const res = await window.steam.startIdle(game.appId, game.name)
      if (res.success && res.data) {
        setIdlingIds(res.data)
        toast.success(`Idling: ${game.name}`)
        notify('⚡ Idling Started', game.name)
      } else { toast.error(res.error ?? 'Failed') }
    } finally { setLoading(l => ({ ...l, [game.appId]: false })) }
  }

  const stopIdle = async (appId: number, silent = false) => {
    setLoading(l => ({ ...l, [appId]: true }))
    try {
      const res = await window.steam.stopIdle(appId)
      if (res.success && res.data) {
        setIdlingIds(res.data)
        if (!silent) {
          const name = savedGames.find(g => g.appId === appId)?.name ?? `App ${appId}`
          toast.success('Stopped')
          notify('⏹ Idling Stopped', name)
        }
      } else { toast.error(res.error ?? 'Failed') }
    } finally { setLoading(l => ({ ...l, [appId]: false })) }
  }

  const startAll = async () => {
    const toStart = savedGames.filter(g => !idlingIds.includes(g.appId))
    for (const game of toStart) {
      try { await startIdle(game) } catch { /* continue with next game */ }
      await new Promise(r => setTimeout(r, 300))
    }
  }

  // Stop all — one single notification summary instead of one per game
  const stopAll = async () => {
    const ids = [...idlingIds]
    if (ids.length === 0) return

    // Stop all silently (no individual notifications)
    for (const id of ids) await stopIdle(id, true)

    // One summary notification
    const names = ids.map(id => savedGames.find(g => g.appId === id)?.name ?? `App ${id}`)
    if (names.length === 1) {
      notify('⏹ Idling Stopped', names[0])
    } else {
      notify('⏹ Stopped All Idling', `${names.length} games stopped`)
    }
    toast.success(`Stopped ${names.length} game${names.length > 1 ? 's' : ''}`)
  }

  const activeCount = idlingIds.filter(id => savedGames.some(g => g.appId === id)).length

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-8 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Auto-Idle</h1>
              {activeCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full idle-pulse"
                  style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  {activeCount} active
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Αποθήκευσε games για αυτόματο idling.</p>
          </div>
          <div className="flex gap-2">
            {activeCount > 0 ? (
              <button onClick={stopAll} className="btn-danger text-xs">
                <Square className="w-3 h-3" /> Stop All ({activeCount})
              </button>
            ) : (
              <button onClick={startAll} disabled={savedGames.length === 0} className="btn-success text-xs">
                <Play className="w-3 h-3" /> Start All
              </button>
            )}
          </div>
        </motion.div>

        {/* Search / Add box */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }} className="card mb-6"
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            Αναζήτηση Game
          </p>
          <div ref={searchRef} className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--muted)' }} />
                {searching && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin pointer-events-none" style={{ color: 'var(--muted)' }} />}
                {!searching && searchQuery && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}
                    onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false) }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <input className="input w-full pl-9 pr-9"
                  placeholder="Όνομα game ή AppID… (π.χ. GTA V, 271590)"
                  value={searchQuery}
                  onChange={e => handleSearchInput(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  onKeyDown={e => { if (e.key === 'Enter') addFromAppId(); if (e.key === 'Escape') setShowDropdown(false) }}
                />
              </div>
              <button className="btn-primary shrink-0" onClick={addFromAppId} disabled={!searchQuery.trim() || searching}>
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <AnimatePresence>
              {showDropdown && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden"
                  style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}
                >
                  {searching && searchResults.length === 0 && (
                    <div className="flex items-center gap-2 px-4 py-3" style={{ color: 'var(--muted)' }}>
                      <Loader className="w-3.5 h-3.5 animate-spin shrink-0" /><span className="text-sm">Αναζήτηση…</span>
                    </div>
                  )}
                  {!searching && searchResults.length === 0 && searchQuery.trim() && (
                    <div className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
                      Δεν βρέθηκαν αποτελέσματα για «{searchQuery}»
                    </div>
                  )}
                  {searchResults.map((result, idx) => {
                    const alreadyAdded = savedGames.some(g => g.appId === result.appId)
                    return (
                      <button key={result.appId} onClick={() => !alreadyAdded && addFromResult(result)}
                        disabled={alreadyAdded}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-100"
                        style={{ borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border)' : 'none', opacity: alreadyAdded ? 0.5 : 1, cursor: alreadyAdded ? 'default' : 'pointer' }}
                        onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = 'var(--card)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div className="w-16 h-9 rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
                          <img src={result.tiny_image || result.headerImageUrl} alt={result.name} className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).src = result.headerImageUrl }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{result.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>AppID: {result.appId}</span>
                            {result.price?.discount_percent ? (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent)' }}>
                                -{result.price.discount_percent}%
                              </span>
                            ) : null}
                            {result.price?.final_formatted && <span className="text-xs" style={{ color: 'var(--sub)' }}>{result.price.final_formatted}</span>}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {alreadyAdded
                            ? <span className="text-xs" style={{ color: 'var(--muted)' }}>Added</span>
                            : <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.2)' }}>+ Add</span>
                          }
                        </div>
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Γράψε το όνομα του game ή το AppID και πάτα Enter ή διάλεξε από τη λίστα.
          </p>
        </motion.div>

        {/* Saved Games */}
        {savedGames.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ border: '2px dashed var(--border)', background: 'var(--card)' }}>
            <Zap className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--border)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Δεν έχεις αποθηκεύσει games ακόμα</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Αναζήτησε παραπάνω για να ξεκινήσεις</p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
              Αποθηκευμένα ({savedGames.length})
            </p>
            <div className="space-y-2">
              <AnimatePresence>
                {savedGames.map(game => {
                  const isIdling  = idlingIds.includes(game.appId)
                  const isLoading = loading[game.appId]
                  return (
                    <motion.div key={game.appId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all"
                      style={{ background: isIdling ? 'rgba(34,197,94,0.05)' : 'var(--card)', border: `1px solid ${isIdling ? 'rgba(34,197,94,0.25)' : 'var(--border)'}` }}
                    >
                      <div className="w-16 h-9 rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
                        <GameImage appId={game.appId} name={game.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{game.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>AppID: {game.appId}</p>
                          {isIdling && (
                            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--green)' }}>
                              <span className="w-1.5 h-1.5 rounded-full idle-pulse" style={{ background: 'var(--green)' }} />
                              Idling
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => isIdling ? stopIdle(game.appId) : startIdle(game)} disabled={isLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={isIdling
                            ? { background: 'rgba(239,68,68,0.1)', color: 'var(--red)',    border: '1px solid rgba(239,68,68,0.2)' }
                            : { background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.2)' }
                          }
                        >
                          {isLoading ? <Loader className="w-3 h-3 animate-spin" /> : isIdling ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </button>
                        <button onClick={() => removeGame(game.appId)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="mt-6 p-4 rounded-xl flex items-start gap-3"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
        >
          <Zap className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--sub)' }}>
            <strong style={{ color: 'var(--accent)' }}>Auto-Idle</strong> — τα αποθηκευμένα games ξεκινούν αυτόματα
            την επόμενη φορά που θα ανοίξεις την εφαρμογή. Ενεργοποίησε το{' '}
            <strong>Autostart</strong> στις Settings για να ξεκινά όλα μαζί με τα Windows.
          </p>
        </motion.div>

      </div>
    </div>
  )
}
