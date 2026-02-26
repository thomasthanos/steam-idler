import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Achievement } from '@shared/types'
import {
  ArrowLeft, Search, RefreshCw, Lock, Unlock, Trophy,
  AlertTriangle, Eye, EyeOff, Key, Star, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useAppContext } from '../hooks/useAppContext'

type Filter = 'all' | 'unlocked' | 'locked'

// ── Rarity label ─────────────────────────────────────────────────────────────
function rarityLabel(pct: number) {
  if (pct < 5)  return { label: 'Legendary', color: '#f59e0b' }
  if (pct < 15) return { label: 'Rare',      color: '#a78bfa' }
  if (pct < 35) return { label: 'Uncommon',  color: '#60a5fa' }
  return              { label: 'Common',     color: 'var(--muted)' }
}

// ── Single Achievement Card ───────────────────────────────────────────────────
function AchCard({
  ach, onToggle, isLoading
}: {
  ach: Achievement
  onToggle: () => void
  isLoading: boolean
}) {
  const globalPct = ach.globalPercent !== undefined ? Number(ach.globalPercent) : undefined
  const rarity    = globalPct !== undefined ? rarityLabel(globalPct) : null

  return (
    <div
      className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 cursor-default"
      onMouseEnter={e => { e.currentTarget.style.background = ach.unlocked ? 'rgba(34,197,94,0.05)' : 'var(--surface)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Icon */}
      <div className="relative shrink-0">
        <img
          src={ach.unlocked ? ach.iconUrl : ach.iconGrayUrl}
          alt=""
          className={clsx(
            'w-10 h-10 rounded-lg object-cover',
            !ach.unlocked && 'grayscale opacity-20'
          )}
          onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
        />
        {ach.unlocked && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--green)', boxShadow: '0 0 0 2px var(--card)' }}
          >
            <Trophy className="w-2 h-2 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={clsx(
            'text-xs font-medium truncate',
            ach.unlocked ? 'text-ui-text' : 'text-ui-muted'
          )}>
            {ach.hidden && !ach.unlocked ? 'Hidden Achievement' : ach.displayName}
          </p>
          {rarity && globalPct !== undefined && globalPct < 15 && (
            <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ color: rarity.color, background: `${rarity.color}15` }}>
              {rarity.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 mt-0.5">
          {(ach.description || (ach.hidden && !ach.unlocked)) && (
            <p className="text-[11px] truncate" style={{ color: 'var(--muted)', opacity: 0.7 }}>
              {ach.hidden && !ach.unlocked ? 'Unlock to reveal' : ach.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-0.5">
          {globalPct !== undefined && (
            <span className="text-[10px]" style={{ color: 'var(--muted)', opacity: 0.6 }}>
              {globalPct.toFixed(1)}% players
            </span>
          )}
          {ach.unlocked && ach.unlockedAt && (
            <span className="text-[10px] font-medium" style={{ color: 'var(--green)', opacity: 0.8 }}>
              {new Date(ach.unlockedAt * 1000).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        disabled={isLoading}
        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 opacity-0 group-hover:opacity-100"
        style={{ color: ach.unlocked ? 'var(--red)' : 'var(--green)' }}
        onMouseEnter={e => { e.currentTarget.style.background = ach.unlocked ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {isLoading
          ? <RefreshCw className="w-3 h-3 animate-spin" />
          : ach.unlocked
            ? <><Lock className="w-3 h-3" />Lock</>
            : <><Unlock className="w-3 h-3" />Unlock</>
        }
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AchievementsPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate  = useNavigate()
  const numAppId  = Number(appId)

  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [filtered, setFiltered]         = useState<Achievement[]>([])
  const [loading, setLoading]           = useState(true)
  const [loadError, setLoadError]       = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [filter, setFilter]             = useState<Filter>('all')
  const [showHidden, setShowHidden]     = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ action: string; label: string } | null>(null)
  const [gameName, setGameName]         = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { settings, games } = useAppContext()

  // Resolve game name — first from context, then IPC
  useEffect(() => {
    const fromCtx = games.find(g => g.appId === numAppId)
    if (fromCtx) { setGameName(fromCtx.name); return }
    window.steam.resolveAppName(numAppId).then(r => {
      if (r?.success && r?.data) setGameName((r.data as any).name ?? r.data as string)
    }).catch(() => {})
  }, [numAppId, games])

  const notify = (title: string, body: string) => {
    if (!settings.notificationsEnabled) return
    window.steam.sendNotification(title, body, !settings.notificationSound).catch(() => {})
  }

  // Kill the Steam worker when navigating away from the achievements page.
  // We use a ref+timeout guard so React StrictMode double-mount in dev
  // doesn't kill the worker before GET_ACHIEVEMENTS has a chance to run.
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // Cancel any pending stop from a previous StrictMode cycle
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    return () => {
      // Delay slightly — if StrictMode remounts immediately this gets cancelled
      stopTimerRef.current = setTimeout(() => {
        window.steam.stopGame().catch(() => {})
      }, 300)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/games')
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const fetchAchievements = async () => {
    setLoading(true); setLoadError(null)
    try {
      const res = await window.steam.getAchievements(numAppId)
      if (res.success) {
        setAchievements(res.data ?? [])
      } else {
        const msg = res.error ?? 'Failed to load achievements'
        if (!msg.includes('API key')) toast.error(msg)
        setLoadError(msg); setAchievements([])
      }
    } catch (e: unknown) {
      const msg = (e as Error).message ?? 'Failed to load achievements'
      if (!msg.includes('API key')) toast.error(msg)
      setLoadError(msg); setAchievements([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAchievements() }, [appId])

  useEffect(() => {
    let list = [...achievements]
    if (!showHidden) list = list.filter(a => !a.hidden)
    if (filter === 'unlocked') list = list.filter(a => a.unlocked)
    if (filter === 'locked')   list = list.filter(a => !a.unlocked)
    if (search) list = list.filter(a =>
      a.displayName.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase())
    )
    list.sort((a, b) => {
      if (b.unlocked !== a.unlocked) return Number(b.unlocked) - Number(a.unlocked)
      // Sort locked ones by rarity (rarest first)
      if (!a.unlocked && a.globalPercent !== undefined && b.globalPercent !== undefined)
        return Number(a.globalPercent) - Number(b.globalPercent)
      return 0
    })
    setFiltered(list)
  }, [achievements, search, filter, showHidden])

  const toggleAchievement = async (ach: Achievement) => {
    setActionLoading(ach.apiName)
    try {
      const res = ach.unlocked
        ? await window.steam.lockAchievement(numAppId, ach.apiName)
        : await window.steam.unlockAchievement(numAppId, ach.apiName)
      if (res.success) {
        setAchievements(prev => prev.map(a =>
          a.apiName === ach.apiName
            ? { ...a, unlocked: !a.unlocked, unlockedAt: !a.unlocked ? Date.now() / 1000 : undefined }
            : a
        ))
        const wasUnlocked = ach.unlocked
        toast.success(wasUnlocked ? `Locked: ${ach.displayName}` : `🏆 Unlocked: ${ach.displayName}`)
        if (!wasUnlocked) notify('🏆 Achievement Unlocked!', ach.displayName)
      } else {
        toast.error(res.error ?? 'Failed to update achievement')
      }
    } catch { toast.error('Failed to update achievement') }
    finally { setActionLoading(null) }
  }

  const handleBulkAction = async (action: string) => {
    setConfirmDialog(null); setActionLoading('bulk')
    try {
      const res = action === 'unlock-all'
        ? await window.steam.unlockAllAchievements(numAppId)
        : action === 'lock-all'
          ? await window.steam.lockAllAchievements(numAppId)
          : await window.steam.resetStats(numAppId)
      if (res.success) {
        toast.success('Done!')
        if (action === 'unlock-all') notify('🏆 All Unlocked!', 'All achievements have been unlocked.')
        if (action === 'lock-all')   notify('🔒 All Locked',    'All achievements have been locked.')
        await fetchAchievements()
      } else { toast.error(res.error ?? 'Action failed') }
    } catch { toast.error('Action failed') }
    finally { setActionLoading(null) }
  }

  const unlocked  = achievements.filter(a => a.unlocked).length
  const total     = achievements.length
  const pct       = total > 0 ? Math.round((unlocked / total) * 100) : 0
  const isPerfect = total > 0 && pct === 100

  const coverUrl  = `https://cdn.cloudflare.steamstatic.com/steam/apps/${numAppId}/header.jpg`

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="shrink-0 relative overflow-hidden border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

        {/* Blurred cover bg — very subtle */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img src={coverUrl} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-10"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>

        <div className="relative px-6 py-4">
          {/* Row 1: back + actions */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate('/games')}
              className="inline-flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--sub)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            <div className="flex items-center gap-1.5">
              <button className="btn-success text-xs" disabled={actionLoading !== null || total === 0}
                onClick={() => settings.confirmBulkActions
                  ? setConfirmDialog({ action: 'unlock-all', label: 'Unlock ALL achievements?' })
                  : handleBulkAction('unlock-all')
                }>
                <Unlock className="w-3 h-3" /> Unlock All
              </button>
              <button className="btn-danger text-xs" disabled={actionLoading !== null || total === 0}
                onClick={() => settings.confirmBulkActions
                  ? setConfirmDialog({ action: 'lock-all', label: 'Lock ALL achievements?' })
                  : handleBulkAction('lock-all')
                }>
                <Lock className="w-3 h-3" /> Lock All
              </button>
              <button className="btn-danger text-xs" disabled={actionLoading !== null}
                onClick={() => settings.confirmBulkActions
                  ? setConfirmDialog({ action: 'reset-stats', label: 'Reset ALL stats & achievements?' })
                  : handleBulkAction('reset-stats')
                }>
                <AlertTriangle className="w-3 h-3" /> Reset
              </button>
            </div>
          </div>

          {/* Row 2: cover + title + progress */}
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-lg overflow-hidden hidden sm:block"
              style={{ width: 96, aspectRatio: '460/215', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
              <img src={coverUrl} alt="" className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold truncate" style={{ color: 'var(--text)' }}>
                  {gameName ?? `App #${appId}`}
                </h1>
                {isPerfect && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                    <Star className="w-2.5 h-2.5" fill="currentColor" /> PERFECT
                  </span>
                )}
              </div>

              {total > 0 && (
                <div className="flex items-center gap-2.5 mt-2">
                  <div className="flex-1 max-w-[200px] h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: isPerfect ? 'var(--green)' : 'var(--accent)' }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums" style={{ color: isPerfect ? 'var(--green)' : 'var(--accent)' }}>
                    {unlocked}/{total}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--sub)' }}>{pct}%</span>
                </div>
              )}
            </div>


          </div>
        </div>
      </div>

      {/* ══ FILTER BAR ═══════════════════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center gap-2 px-6 py-2.5 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

          {/* Search */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--muted)' }} />
            <input
              ref={searchInputRef}
              className="input w-full pl-9 pr-8 py-1.5 text-sm"
              placeholder="Search… (Ctrl+F)"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity">
                <X className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1 rounded-xl border p-1" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            {(['all', 'unlocked', 'locked'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={clsx('px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all')}
                style={filter === f
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { color: 'var(--muted)' }
                }
              >
                {f === 'all' ? `All ${total > 0 ? `(${total})` : ''}` : f === 'unlocked' ? `✓ ${unlocked}` : `🔒 ${total - unlocked}`}
              </button>
            ))}
          </div>

          {/* Hidden toggle */}
          <button onClick={() => setShowHidden(v => !v)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all'
            )}
            style={!showHidden
              ? { color: 'var(--accent)', borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)' }
              : { color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }
            }
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Hidden
          </button>

          <div className="flex-1" />

          <button onClick={fetchAchievements} disabled={loading} className="btn-ghost text-xs py-1.5 px-3">
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
      </div>

      {/* ══ CONTENT ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Loading */}
          {loading && (
            <div className="card !p-0 overflow-hidden">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton mx-0 rounded-none border-b last:border-0"
                  style={{ height: 62, animationDelay: `${i * 40}ms`, borderColor: 'var(--border)' }} />
              ))}
            </div>
          )}

          {/* API key error */}
          {!loading && loadError !== null && (
            <div className="flex flex-col items-center justify-center h-full gap-5 py-16">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center border"
                style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)' }}>
                <Key className="w-7 h-7" style={{ color: 'rgba(59,130,246,0.6)' }} />
              </div>
              <div className="text-center">
                <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Steam API Key Required</p>
                <p className="text-sm max-w-xs" style={{ color: 'var(--muted)' }}>
                  Add an API key in Settings to load achievement names and descriptions.
                </p>
              </div>
              <button onClick={() => navigate('/settings')} className="btn-primary">
                <Key className="w-4 h-4" /> Open Settings
              </button>
            </div>
          )}

          {/* No achievements */}
          {!loading && loadError === null && total === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16" style={{ color: 'var(--muted)' }}>
              <Trophy className="w-12 h-12 opacity-20" />
              <p className="text-sm">This game has no achievements</p>
            </div>
          )}

          {/* No match */}
          {!loading && loadError === null && total > 0 && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16" style={{ color: 'var(--muted)' }}>
              <Search className="w-10 h-10 opacity-20" />
              <p className="text-sm">No achievements match</p>
              <button onClick={() => { setSearch(''); setFilter('all') }}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>
                Clear filters
              </button>
            </div>
          )}

          {/* Achievement list — card sections like settings */}
          {!loading && filtered.length > 0 && (() => {
            const unlockedList = filtered.filter(a => a.unlocked)
            const lockedList   = filtered.filter(a => !a.unlocked)
            return (
              <div className="space-y-3">
                {unlockedList.length > 0 && (
                  <section className="card !p-0 overflow-hidden">
                    <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                      <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                        <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--green)' }} />
                        Unlocked · {unlockedList.length}
                      </h2>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {unlockedList.map((ach, i) => (
                        <motion.div key={ach.apiName}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.01, 0.2), duration: 0.15 }}
                        >
                          <AchCard ach={ach} onToggle={() => toggleAchievement(ach)} isLoading={actionLoading === ach.apiName} />
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )}

                {lockedList.length > 0 && (
                  <section className="card !p-0 overflow-hidden">
                    <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                      <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                        <Lock className="w-3.5 h-3.5" />
                        Locked · {lockedList.length}
                      </h2>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {lockedList.map((ach, i) => (
                        <motion.div key={ach.apiName}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.01, 0.2), duration: 0.15 }}
                        >
                          <AchCard ach={ach} onToggle={() => toggleAchievement(ach)} isLoading={actionLoading === ach.apiName} />
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )
          })()}
      </div>

      {/* ══ CONFIRM DIALOG ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setConfirmDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1,   opacity: 1, y: 0  }}
              exit={{   scale: 0.9, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="card max-w-sm mx-4 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 border"
                style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' }}>
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="font-bold mb-1" style={{ color: 'var(--text)' }}>{confirmDialog.label}</h3>
              <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>This cannot be easily undone.</p>
              <div className="flex gap-3 justify-center">
                <button className="btn-ghost" onClick={() => setConfirmDialog(null)}>Cancel</button>
                <button className="btn-danger" onClick={() => handleBulkAction(confirmDialog.action)}>Confirm</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
