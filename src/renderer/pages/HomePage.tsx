import { useNavigate } from 'react-router-dom'
import {
  Gamepad2, Trophy, RefreshCw, AlertCircle, Key, Shield,
  Tag, ExternalLink, Star, Gift, Clock, BarChart2,
  TrendingUp, Zap, ChevronRight, Wifi, WifiOff,
} from 'lucide-react'
import { useAppContext } from '../hooks/useAppContext'
import { motion } from 'framer-motion'
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

// ─── Main ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, steamRunning, isLoadingUser, refreshUser, settings, games } = useAppContext()
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

  // Computed stats
  const totalMins       = games.reduce((s, g) => s + g.playtimeForever, 0)
  const totalUnlocked   = games.reduce((s, g) => s + g.achievementsUnlocked, 0)
  const totalAchs       = games.reduce((s, g) => s + g.achievementCount, 0)
  const achPct          = totalAchs > 0 ? Math.round((totalUnlocked / totalAchs) * 100) : 0
  const topGames        = [...games].sort((a, b) => b.playtimeForever - a.playtimeForever).slice(0, 5)

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

        {/* ── Hero: Steam Connection ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="relative rounded-2xl overflow-hidden p-5"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Decorative gradient bg */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: steamRunning ? 'radial-gradient(ellipse at top right, rgba(59,130,246,0.07) 0%, transparent 60%)' : 'radial-gradient(ellipse at top right, rgba(239,68,68,0.05) 0%, transparent 60%)' }}
            />

            <div className="relative flex items-center justify-between gap-4">
              {isLoadingUser ? (
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 rounded-full skeleton shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 skeleton rounded" />
                    <div className="h-3 w-20 skeleton rounded" />
                    <div className="h-3 w-16 skeleton rounded" />
                  </div>
                </div>
              ) : steamRunning && user ? (
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative shrink-0">
                    <img src={user.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover"
                      style={{ outline: '2px solid rgba(59,130,246,0.5)', outlineOffset: 2 }} />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--green)', border: '2.5px solid var(--card)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base truncate" style={{ color: 'var(--text)' }}>{user.personaName}</p>
                    <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{user.steamId}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Wifi className="w-3 h-3" style={{ color: 'var(--green)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--green)' }}>Connected</span>
                      {user.level > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)' }}>
                          Lv {user.level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.2)' }}>
                    <WifiOff className="w-6 h-6" style={{ color: 'var(--red)' }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>Steam Offline</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Launch Steam to continue</p>
                  </div>
                </div>
              )}

              <button onClick={refreshUser} disabled={isLoadingUser}
                className="btn-ghost text-xs shrink-0 self-start"
                title="Refresh (Ctrl+R)">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUser ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Quick Actions row — only when connected */}
            {steamRunning && (
              <div className="relative grid grid-cols-3 gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                {[
                  { icon: Gamepad2, label: 'Library',      desc: 'Browse all games', to: '/games',     color: 'var(--accent)', iconBg: 'rgba(59,130,246,0.1)'  },
                  { icon: Trophy,   label: 'Achievements',  desc: 'Pick a game',      to: '/games',     color: '#f59e0b',       iconBg: 'rgba(245,158,11,0.1)' },
                  { icon: Zap,      label: 'Auto-Idle',     desc: 'Manage idling',    to: '/auto-idle', color: '#22c55e',       iconBg: 'rgba(34,197,94,0.1)'  },
                ].map(({ icon: Icon, label, desc, to, color, iconBg }) => (
                  <button key={to + label} onClick={() => navigate(to)}
                    className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 text-left"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--borderhov)'; e.currentTarget.style.background = 'var(--panel)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';    e.currentTarget.style.background = 'var(--surface)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                      style={{ background: iconBg }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{label}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{desc}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'var(--sub)' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

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

        {/* ── Playtime Dashboard ── */}
        {games.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <SectionHeader icon={BarChart2} title="Playtime Dashboard" />

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                {
                  icon: Clock, label: 'Total Playtime',
                  value: formatPlaytime(totalMins),
                  sub: `across ${games.length} games`,
                  color: 'var(--accent)', bg: 'rgba(59,130,246,0.08)',
                },
                {
                  icon: Trophy, label: 'Achievements',
                  value: `${totalUnlocked.toLocaleString()}`,
                  sub: `${achPct}% of ${totalAchs.toLocaleString()}`,
                  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',
                },
                {
                  icon: TrendingUp, label: 'Most Played',
                  value: topGames[0] ? formatPlaytime(topGames[0].playtimeForever) : '—',
                  sub: topGames[0]?.name ?? '',
                  color: '#22c55e', bg: 'rgba(34,197,94,0.08)',
                },
              ].map(({ icon: Icon, label, value, sub, color, bg }) => (
                <div key={label} className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
                  </div>
                  <p className="text-xl font-bold tabular-nums leading-none" style={{ color: 'var(--text)' }}>{value}</p>
                  <p className="text-xs mt-1 truncate" style={{ color: 'var(--muted)' }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Achievement progress bar */}
            {totalAchs > 0 && (
              <div className="rounded-2xl px-4 py-3 mb-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Overall Achievement Progress</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: '#f59e0b' }}>{achPct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${achPct}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
                  />
                </div>
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                  {totalUnlocked.toLocaleString()} / {totalAchs.toLocaleString()} achievements unlocked
                </p>
              </div>
            )}

            {/* Top played list */}
            {topGames.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Top Played</p>
                </div>
                <div>
                  {topGames.map((game, i) => {
                    const pct = topGames[0].playtimeForever > 0
                      ? (game.playtimeForever / topGames[0].playtimeForever) * 100 : 0
                    const colors = ['var(--accent)', '#f59e0b', '#22c55e', 'var(--sub)', 'var(--muted)']
                    return (
                      <button key={game.appId} onClick={() => navigate(`/achievements/${game.appId}`)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 group transition-all duration-150"
                        style={{ borderBottom: i < topGames.length - 1 ? '1px solid var(--border)' : 'none' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        {/* Rank */}
                        <span className="w-5 text-center text-xs font-bold tabular-nums shrink-0" style={{ color: colors[i] }}>
                          {i + 1}
                        </span>
                        {/* Bar + Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{game.name}</p>
                            <span className="text-xs tabular-nums shrink-0 ml-3 font-semibold" style={{ color: colors[i] }}>
                              {formatPlaytime(game.playtimeForever)}
                            </span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 + i * 0.07 }}
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
              </div>
            )}
          </motion.div>
        )}

        {/* ── Free This Week ── */}
        {!loadingDeals && freeGames.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <SectionHeader icon={Gift} title="Free This Week" badge="FREE"
              badgeColor="#22c55e" badgeBg="rgba(34,197,94,0.1)" badgeBorder="rgba(34,197,94,0.3)" />
            <div className="grid grid-cols-3 gap-3">
              {freeGames.map(g => <GameCard key={`fw-${g.id}`} game={g} />)}
            </div>
          </motion.div>
        )}

        {/* ── Weekly Deals ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <SectionHeader icon={Tag} title="Weekly Deals" badge="Steam Store" badgeBorder="rgba(59,130,246,0.25)" />
          {loadingDeals ? (
            <div className="grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : deals.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {deals.map(g => <GameCard key={g.id} game={g} />)}
            </div>
          ) : (
            <div className="rounded-xl p-8 text-center" style={{ border: '1px dashed var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Could not load Steam deals — check your connection.
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Featured ── */}
        {!loadingDeals && featured.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <SectionHeader icon={Star} title="Featured on Steam" badgeColor="#f59e0b" badgeBg="rgba(245,158,11,0.1)" />
            <div className="grid grid-cols-3 gap-3">
              {featured.slice(0, 6).map(g => <GameCard key={`f-${g.id}`} game={g} />)}
            </div>
          </motion.div>
        )}

        {/* ── Disclaimer ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.12)' }}
        >
          <Shield className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'rgba(234,179,8,0.6)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(234,179,8,0.55)' }}>
            <strong style={{ color: 'rgba(234,179,8,0.75)' }}>Use responsibly.</strong>{' '}
            Modifying achievements may violate the Steam Subscriber Agreement. For personal / educational use only.
          </p>
        </motion.div>

      </div>
    </div>
  )
}
