import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, Key,
  Tag, ExternalLink, Star, Gift, Clock,
  Gamepad2, ChevronRight, ChevronLeft, TrendingUp,
} from 'lucide-react'
import { useAppContext } from '../hooks/useAppContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { FeaturedGame } from '@shared/types'

// ─── Game card for Steam Store ─────────────────────────────────────────────
function GameCard({ game }: { game: FeaturedGame }) {
  const [imgError, setImgError] = useState(false)
  const fallback = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.id}/header.jpg`

  return (
    <a
      href={game.url} target="_blank" rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden transition-all duration-200"
      style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--borderhov)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';    e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: '460/215' }}>
        <img
          src={imgError ? fallback : game.header_image}
          alt={game.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-2 left-2 flex gap-1">
          {game.type === 'free' && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#22c55e', color: '#000' }}>FREE</span>
          )}
          {game.discount_percent > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>
              -{game.discount_percent}%
            </span>
          )}
        </div>
        <ExternalLink className="absolute top-2 right-2 w-3.5 h-3.5 opacity-0 group-hover:opacity-80 transition-opacity" style={{ color: '#fff' }} />
        {/* hover name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <p className="text-xs font-semibold text-white truncate drop-shadow">{game.name}</p>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{game.name}</p>
        {game.discount_percent > 0 && game.original_price > 0 ? (
          <p className="text-xs mt-0.5 flex items-center gap-1.5">
            <span style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>€{(game.original_price / 100).toFixed(2)}</span>
            <span className="font-semibold" style={{ color: '#22c55e' }}>
              {game.final_price === 0 ? 'FREE' : `€${(game.final_price / 100).toFixed(2)}`}
            </span>
          </p>
        ) : (
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Steam Store</p>
        )}
      </div>
    </a>
  )
}

// ─── Store Carousel ────────────────────────────────────────────────────────
function StoreCarousel({ games, loading }: { games: FeaturedGame[]; loading: boolean }) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const VISIBLE = 3
  const total = loading ? VISIBLE : games.length
  const maxIndex = Math.max(0, total - VISIBLE)

  const go = (dir: 1 | -1) => {
    setDirection(dir)
    setIndex(i => Math.min(Math.max(i + dir, 0), maxIndex))
  }

  const canPrev = index > 0
  const canNext = index < maxIndex

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  }

  const visible = loading
    ? Array(VISIBLE).fill(null)
    : games.slice(index, index + VISIBLE)

  return (
    <div className="relative group/carousel">
      {/* Left arrow */}
      <button
        onClick={() => go(-1)}
        disabled={!canPrev}
        className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background: canPrev ? 'var(--card)' : 'transparent',
          border: canPrev ? '1px solid var(--border)' : '1px solid transparent',
          opacity: canPrev ? 1 : 0,
          transform: `translateY(-50%) translateX(${canPrev ? '0' : '-4px'})`,
          pointerEvents: canPrev ? 'auto' : 'none',
          boxShadow: canPrev ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
        }}
        onMouseEnter={e => { if (canPrev) e.currentTarget.style.background = 'var(--surface)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)' }}
      >
        <ChevronLeft className="w-4 h-4" style={{ color: 'var(--sub)' }} />
      </button>

      {/* Cards */}
      <div className="overflow-hidden">
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.32, 0, 0.67, 0] }}
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${VISIBLE}, 1fr)` }}
          >
            {visible.map((g, i) =>
              loading || !g
                ? <CardSkeleton key={i} />
                : <GameCard key={g.id} game={g} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right arrow */}
      <button
        onClick={() => go(1)}
        disabled={!canNext}
        className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background: canNext ? 'var(--card)' : 'transparent',
          border: canNext ? '1px solid var(--border)' : '1px solid transparent',
          opacity: canNext ? 1 : 0,
          transform: `translateY(-50%) translateX(${canNext ? '0' : '4px'})`,
          pointerEvents: canNext ? 'auto' : 'none',
          boxShadow: canNext ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
        }}
        onMouseEnter={e => { if (canNext) e.currentTarget.style.background = 'var(--surface)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)' }}
      >
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--sub)' }} />
      </button>

      {/* Dot indicators */}
      {maxIndex > 0 && (
        <div className="flex justify-center gap-1 mt-3">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i) }}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === index ? 16 : 5,
                height: 5,
                background: i === index ? 'var(--accent)' : 'var(--border)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton card ─────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ aspectRatio: '460/215' }} />
      <div className="p-2.5 space-y-1.5">
        <div className="h-3 w-2/3 skeleton rounded" />
        <div className="h-2 w-1/3 skeleton rounded" />
      </div>
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, badge, badgeColor = 'var(--accent)', badgeBg = 'rgba(59,130,246,0.12)', badgeBorder = 'rgba(59,130,246,0.25)' }: {
  icon: React.ElementType; title: string; badge?: string; badgeColor?: string; badgeBg?: string; badgeBorder?: string
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: badgeBg }}>
        <Icon className="w-3.5 h-3.5" style={{ color: badgeColor }} />
      </div>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
      {badge && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-0.5"
          style={{ background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}` }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatPlaytime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Idling Now Widget ────────────────────────────────────────────────────
function IdlingNowWidget({ games }: { games: { appId: number; name: string }[] }) {
  const [now, setNow] = useState(Date.now())
  const [since] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsed = (start: number) => {
    const sec = Math.floor((now - start) / 1000)
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid rgba(34,197,94,0.25)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full idle-pulse shrink-0" style={{ background: 'var(--green)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--green)' }}>Idling Now</span>
        </div>
        <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.25)' }}>
          {games.length} active
        </span>
      </div>
      {/* Games */}
      <div>
        {games.map((g, i) => (
          <div key={g.appId}
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderBottom: i < games.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            <div className="w-10 h-6 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
              <img
                src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appId}/header.jpg`}
                alt={g.name}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>{g.name}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <Clock className="w-3 h-3" style={{ color: 'var(--muted)' }} />
              <span className="text-xs tabular-nums font-semibold" style={{ color: 'var(--green)' }}>
                {elapsed(since)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { steamRunning, settings, games } = useAppContext()
  const navigate = useNavigate()
  const [deals, setDeals]         = useState<FeaturedGame[]>([])
  const [featured, setFeatured]   = useState<FeaturedGame[]>([])
  const [freeGames, setFreeGames] = useState<FeaturedGame[]>([])
  const [loadingDeals, setLoadingDeals] = useState(true)

  useEffect(() => {
    setLoadingDeals(true)
    window.steam.getSteamFeatured().then(res => {
      if (res.success && res.data) {
        setDeals(res.data.deals)
        setFeatured(res.data.featured)
        setFreeGames(res.data.freeGames ?? [])
      }
    }).finally(() => setLoadingDeals(false))
  }, [])

  // Idling status
  const [idlingGames, setIdlingGames] = useState<{ appId: number; name: string }[]>([])
  useEffect(() => {
    const refresh = () => {
      window.steam.getIdleStatus().then(res => {
        if (res.success && res.data) {
          setIdlingGames(res.data.map(id => ({
            appId: id,
            name: games.find(g => g.appId === id)?.name ?? `App ${id}`,
          })))
        }
      }).catch(() => {})
    }
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [games])

  // Computed stats
  const totalMins     = games.reduce((s, g) => s + g.playtimeForever, 0)
  const totalUnlocked = games.reduce((s, g) => s + g.achievementsUnlocked, 0)
  const totalAchs     = games.reduce((s, g) => s + g.achievementCount, 0)
  const achPct        = totalAchs > 0 ? Math.round((totalUnlocked / totalAchs) * 100) : 0
  const topGames      = [...games].sort((a, b) => b.playtimeForever - a.playtimeForever).slice(0, 5)

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">


        {/* API key hint */}
        {steamRunning && !settings.steamApiKey && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}
          >
            <Key className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Add a Steam API Key</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Without a key only installed games are shown.{' '}
                <button onClick={() => navigate('/settings')} className="underline" style={{ color: 'var(--accent)' }}>
                  Open Settings →
                </button>
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Idling Now ── */}
        <AnimatePresence>
          {idlingGames.length > 0 && (
            <motion.div
              key="idling-widget"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <IdlingNowWidget games={idlingGames} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats strip ── */}
        {games.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              {[
                { icon: Clock,    value: formatPlaytime(totalMins),          label: 'played',       color: 'var(--accent)' },
                { icon: Trophy,   value: `${totalUnlocked.toLocaleString()}`, label: `achiev. (${achPct}%)`, color: '#f59e0b' },
                { icon: Gamepad2, value: `${games.length}`,                  label: 'games',        color: '#22c55e' },
              ].map(({ icon: Icon, value, label, color }, i, arr) => (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2 flex-1 justify-center">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>{value}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-px h-4 shrink-0" style={{ background: 'var(--border)' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Top 5 Most Played ── */}
        {games.length > 0 && topGames.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <SectionHeader icon={TrendingUp} title="Most Played" />
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              {topGames.map((game, i) => {
                const pct = topGames[0].playtimeForever > 0
                  ? (game.playtimeForever / topGames[0].playtimeForever) * 100 : 0
                const colors = ['var(--accent)', '#f59e0b', '#22c55e', 'var(--sub)', 'var(--muted)']
                return (
                  <button
                    key={game.appId}
                    onClick={() => navigate(`/achievements/${game.appId}`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 group transition-all duration-150"
                    style={{ borderBottom: i < topGames.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span className="w-4 text-center text-xs font-bold tabular-nums shrink-0" style={{ color: colors[i] }}>{i + 1}</span>
                    <div className="w-10 h-6 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
                      <img
                        src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/header.jpg`}
                        alt={game.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{game.name}</p>
                        <span className="text-xs tabular-nums font-semibold ml-3 shrink-0" style={{ color: colors[i] }}>
                          {formatPlaytime(game.playtimeForever)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 * i }}
                          className="h-full rounded-full"
                          style={{ background: colors[i] }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: 'var(--sub)' }} />
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Free This Week ── */}
        {(loadingDeals || freeGames.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <SectionHeader icon={Gift} title="Free This Week" badge="FREE"
              badgeColor="#22c55e" badgeBg="rgba(34,197,94,0.1)" badgeBorder="rgba(34,197,94,0.3)" />
            <StoreCarousel games={freeGames} loading={loadingDeals} />
          </motion.div>
        )}

        {/* ── Weekly Deals ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <SectionHeader icon={Tag} title="Weekly Deals" badge="Steam Store" badgeBorder="rgba(59,130,246,0.25)" />
          {!loadingDeals && deals.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ border: '1px dashed var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Could not load Steam deals — check your connection.</p>
            </div>
          ) : (
            <StoreCarousel games={deals} loading={loadingDeals} />
          )}
        </motion.div>

        {/* ── Featured ── */}
        {(loadingDeals || featured.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <SectionHeader icon={Star} title="Featured on Steam" badgeColor="#f59e0b" badgeBg="rgba(245,158,11,0.1)" />
            <StoreCarousel games={featured} loading={loadingDeals} />
          </motion.div>
        )}


      </div>
    </div>
  )
}
