import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Clock, Trophy, ChevronRight, RefreshCw,
  Gamepad2, Zap, LayoutGrid, List, Star, SlidersHorizontal, X
} from 'lucide-react'
import { SteamGame } from '@shared/types'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppContext } from '../hooks/useAppContext'
import GameImage from '../components/GameImage'
import clsx from 'clsx'

type SortKey  = 'name' | 'completion' | 'recent' | 'playtime'
type ViewMode = 'grid' | 'list'
type FilterKey = 'all' | 'perfect' | 'started' | 'unstarted' | 'no-achievements'

function formatHours(mins: number) {
  const h = Math.round(mins / 60)
  return h >= 1 ? `${h}h` : `${mins}m`
}

// ── Grid Card ─────────────────────────────────────────────────────────────
function GameCard({ game, index, onClick }: { game: SteamGame; index: number; onClick: () => void }) {
  const pct     = Math.round(game.achievementPercentage)
  const perfect = game.achievementCount > 0 && pct === 100
  const started = game.achievementCount > 0 && pct > 0

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.4), duration: 0.2 }}
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden border text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: 'var(--card)', borderColor: perfect ? 'rgba(34,197,94,0.3)' : 'var(--border)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = perfect ? 'rgba(34,197,94,0.6)' : 'var(--borderhov)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = perfect ? 'rgba(34,197,94,0.3)' : 'var(--border)' }}
    >
      {/* Cover image */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '460/215' }}>
        <GameImage appId={game.appId} name={game.name} className="transition-transform duration-500 group-hover:scale-105" />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Perfect badge */}
        {perfect && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'var(--green)', color: '#000' }}>
            <Star className="w-2.5 h-2.5" />
            100%
          </div>
        )}

        {/* Playtime badge */}
        {game.playtimeForever > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)' }}>
            <Clock className="w-2.5 h-2.5" />
            {formatHours(game.playtimeForever)}
          </div>
        )}

        {/* Bottom name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-xs font-semibold text-white truncate leading-tight drop-shadow">{game.name}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2">
        {game.achievementCount > 0 ? (
          <div className="space-y-1.5">
            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: Math.min(index * 0.02, 0.4) + 0.1 }}
                className="h-full rounded-full"
                style={{ background: perfect ? 'var(--green)' : started ? 'var(--accent)' : 'var(--muted)' }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                <Trophy className="w-3 h-3 inline mr-0.5" style={{ color: 'var(--accent)' }} />
                {game.achievementsUnlocked}/{game.achievementCount}
              </span>
              <span className={clsx(
                'text-[11px] font-bold tabular-nums',
                perfect ? 'text-ui-green' : started ? 'text-ui-accent' : 'text-ui-muted'
              )}>
                {pct}%
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] py-0.5" style={{ color: 'var(--muted)' }}>No achievements</p>
        )}
      </div>
    </motion.button>
  )
}

// ── List Row ──────────────────────────────────────────────────────────────
function GameRow({ game, index, onClick }: { game: SteamGame; index: number; onClick: () => void }) {
  const pct     = Math.round(game.achievementPercentage)
  const perfect = game.achievementCount > 0 && pct === 100
  const started = game.achievementCount > 0 && pct > 0

  const barColor = perfect ? 'var(--green)' : started ? 'var(--accent)' : 'var(--muted)'
  const pctColor  = perfect ? 'var(--green)' : started ? 'var(--accent)' : 'var(--muted)'

  return (
    <motion.button
      key={game.appId}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.35), duration: 0.18 }}
      onClick={onClick}
      className="w-full group flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150"
      style={{ background: 'var(--card)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)' }}
    >
      {/* Thumbnail */}
      <div className="w-14 h-8 rounded-lg shrink-0 overflow-hidden" style={{ opacity: 0.9 }}>
        <GameImage appId={game.appId} name={game.name} />
      </div>

      {/* Name + progress */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight" style={{ color: 'var(--text)' }}>
          {game.name}
        </p>
        {game.achievementCount > 0 ? (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 max-w-[120px] h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: Math.min(index * 0.015, 0.35) + 0.05 }}
                className="h-full rounded-full"
                style={{ background: barColor }}
              />
            </div>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--muted)' }}>
              {game.achievementsUnlocked}/{game.achievementCount}
            </span>
          </div>
        ) : (
          <span className="text-[11px] mt-0.5 block" style={{ color: 'var(--muted)', opacity: 0.4 }}>No achievements</span>
        )}
      </div>

      {/* Playtime */}
      {game.playtimeForever > 0 && (
        <span className="text-[11px] flex items-center gap-1 shrink-0" style={{ color: 'var(--muted)' }}>
          <Clock className="w-3 h-3" />
          {formatHours(game.playtimeForever)}
        </span>
      )}

      {/* % + chevron */}
      <div className="shrink-0 flex items-center gap-1.5">
        {game.achievementCount > 0 && (
          <span className="text-sm font-bold font-mono tabular-nums w-10 text-right" style={{ color: pctColor }}>
            {pct}%
          </span>
        )}
        {perfect && <Star className="w-3 h-3 shrink-0" style={{ color: 'var(--green)' }} />}
        <ChevronRight className="w-3.5 h-3.5 opacity-20 group-hover:opacity-50 group-hover:translate-x-0.5 transition-all" style={{ color: 'var(--sub)' }} />
      </div>
    </motion.button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function GamesPage() {
  const { games, isLoadingGames, fetchGames } = useAppContext()
  const [filtered, setFiltered] = useState<SteamGame[]>([])
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState<SortKey>('playtime')
  const [filter, setFilter]     = useState<FilterKey>('all')
  const [view, setView]         = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate  = useNavigate()

  const searchAsAppId  = /^\d+$/.test(search.trim()) ? parseInt(search.trim(), 10) : null
  const showDirectOpen = searchAsAppId !== null && !games.some(g => g.appId === searchAsAppId)

  useEffect(() => { fetchGames() }, [fetchGames])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    let list = [...games]

    // Filter
    switch (filter) {
      case 'perfect':      list = list.filter(g => g.achievementCount > 0 && g.achievementPercentage === 100); break
      case 'started':      list = list.filter(g => g.achievementCount > 0 && g.achievementPercentage > 0 && g.achievementPercentage < 100); break
      case 'unstarted':    list = list.filter(g => g.achievementCount > 0 && g.achievementPercentage === 0); break
      case 'no-achievements': list = list.filter(g => g.achievementCount === 0); break
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q) || g.appId.toString().includes(q))
    }

    // Sort
    switch (sortBy) {
      case 'completion': list.sort((a, b) => b.achievementPercentage - a.achievementPercentage); break
      case 'recent':     list.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)); break
      case 'playtime':   list.sort((a, b) => b.playtimeForever - a.playtimeForever); break
      default:           list.sort((a, b) => a.name.localeCompare(b.name))
    }

    setFiltered(list)
  }, [games, search, sortBy, filter])

  const totalAchs    = games.reduce((s, g) => s + g.achievementCount, 0)
  const unlockedAchs = games.reduce((s, g) => s + g.achievementsUnlocked, 0)
  const perfectGames = games.filter(g => g.achievementCount > 0 && g.achievementPercentage === 100).length
  const achPct       = totalAchs > 0 ? Math.round((unlockedAchs / totalAchs) * 100) : 0

  const filterLabels: Record<FilterKey, string> = {
    'all': 'All', 'perfect': '⭐ Perfect', 'started': 'In Progress',
    'unstarted': 'Not Started', 'no-achievements': 'No Achievements'
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Library</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {isLoadingGames ? 'Loading…' : `${games.length.toLocaleString()} games`}
              {filtered.length !== games.length && !isLoadingGames && ` · ${filtered.length} shown`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-xl border p-1 gap-0.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              {(['grid', 'list'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={clsx(
                    'p-1.5 rounded-lg transition-all duration-150',
                    view === v ? 'text-white' : 'hover:opacity-70'
                  )}
                  style={view === v ? { background: 'var(--accent)' } : { color: 'var(--muted)' }}
                >
                  {v === 'grid' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
            <button onClick={() => fetchGames(true)} disabled={isLoadingGames}
              className="btn-ghost text-xs"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoadingGames && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {games.length > 0 && !isLoadingGames && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Games',      value: games.length.toLocaleString(), color: 'var(--accent)',  bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.18)'  },
              { label: 'Unlocked',   value: `${unlockedAchs.toLocaleString()}`, color: 'var(--purple)', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.18)' },
              { label: 'Completion', value: `${achPct}%`,     color: 'var(--green)',  bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.18)'  },
              { label: 'Perfect',    value: perfectGames,     color: '#f59e0b',       bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)' },
            ].map(({ label, value, color, bg, border }) => (
              <div key={label} className="rounded-xl px-3 py-2.5 border" style={{ background: bg, borderColor: border }}>
                <p className="text-base font-bold font-mono tabular-nums leading-none" style={{ color }}>{value}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + controls row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--muted)' }} />
            <input
              ref={searchRef}
              className="input w-full pl-9 text-sm"
              placeholder="Search games or AppID… (Ctrl+F)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchAsAppId !== null) navigate(`/achievements/${searchAsAppId}`)
                if (e.key === 'Escape') setSearch('')
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-70 transition-opacity">
                <X className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
              </button>
            )}
          </div>

          <select
            className="input text-sm pr-8 shrink-0"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
          >
            <option value="playtime">Most Played</option>
            <option value="name">A → Z</option>
            <option value="completion">Completion %</option>
            <option value="recent">Recently Played</option>
          </select>

          <button
            onClick={() => setShowFilters(v => !v)}
            className="btn-ghost text-xs shrink-0 relative"
            style={showFilters ? { borderColor: 'rgba(59,130,246,0.4)', color: 'var(--accent)' } : {}}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {filter !== 'all' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
            )}
          </button>
        </div>

        {/* Filter pills */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 flex-wrap pt-3">
                {(Object.keys(filterLabels) as FilterKey[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
                      filter === f
                        ? 'text-white border-transparent'
                        : 'border-transparent hover:border-ui-border'
                    )}
                    style={filter === f
                      ? { background: 'var(--accent)' }
                      : { color: 'var(--muted)', background: 'var(--card)' }
                    }
                  >
                    {filterLabels[f]}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* Direct AppID open */}
        <AnimatePresence>
          {showDirectOpen && (
            <motion.button
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={() => navigate(`/achievements/${searchAsAppId}`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border mb-3 text-left transition-all hover:scale-[1.005]"
              style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.07)' }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.15)' }}>
                <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Open AppID {searchAsAppId}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Not in your library — open directly</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)', opacity: 0.6 }} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Loading skeletons */}
        {isLoadingGames && (
          view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton rounded-2xl" style={{ aspectRatio: '460/270', animationDelay: `${i * 50}ms` }} />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="h-[58px] skeleton rounded-xl" style={{ animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          )
        )}

        {/* Empty state */}
        {!isLoadingGames && filtered.length === 0 && !showDirectOpen && (
          <div className="flex flex-col items-center justify-center h-full pt-16 gap-3" style={{ color: 'var(--muted)' }}>
            <Gamepad2 className="w-12 h-12 opacity-20" />
            <p className="text-sm">{search || filter !== 'all' ? 'No games match your filters' : 'No games found'}</p>
            {(search || filter !== 'all') && (
              <button onClick={() => { setSearch(''); setFilter('all') }}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Grid view */}
        {!isLoadingGames && view === 'grid' && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((game, i) => (
              <GameCard key={game.appId} game={game} index={i} onClick={() => navigate(`/achievements/${game.appId}`)} />
            ))}
          </div>
        )}

        {/* List view */}
        {!isLoadingGames && view === 'list' && filtered.length > 0 && (
          <div className="space-y-1.5">
            {filtered.map((game, i) => (
              <GameRow key={game.appId} game={game} index={i} onClick={() => navigate(`/achievements/${game.appId}`)} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
