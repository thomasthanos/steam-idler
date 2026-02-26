import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Gamepad2, Settings, Wifi, WifiOff, Trophy, Clock, ChevronRight } from 'lucide-react'
import { useAppContext } from '../hooks/useAppContext'
import GameImage from './GameImage'
import clsx from 'clsx'
import { useState, useEffect } from 'react'

// ── Custom SVG icons ────────────────────────────────────────────────────────

// Idle icon: controller with soft sleep/play aura
function IdleIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Controller body */}
      <path
        d="M6 9.5C6 8.12 7.12 7 8.5 7h7C16.88 7 18 8.12 18 9.5v3c0 2.21-1.79 4-4 4H10c-2.21 0-4-1.79-4-4v-3z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* D-pad left-right */}
      <line x1="8" y1="10.5" x2="10" y2="10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* D-pad up-down */}
      <line x1="9" y1="9.5" x2="9" y2="11.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Circle button */}
      <circle cx="15" cy="10.5" r="1" fill={color} />
      {/* Cable / grip bumps */}
      <path d="M9.5 14.5 Q12 16.5 14.5 14.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* ZZZ sleep dots — top right */}
      <text x="17" y="8" fontSize="4" fill={color} fontFamily="sans-serif" fontWeight="bold" opacity="0.85">z</text>
      <text x="19" y="6" fontSize="3" fill={color} fontFamily="sans-serif" fontWeight="bold" opacity="0.55">z</text>
      <text x="20.5" y="4.5" fontSize="2.5" fill={color} fontFamily="sans-serif" fontWeight="bold" opacity="0.3">z</text>
    </svg>
  )
}

// Auto-Idle icon: lightning bolt inside a shield
function AutoIdleIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield */}
      <path
        d="M12 3L4 6.5V12c0 4.2 3.4 7.4 8 9 4.6-1.6 8-4.8 8-9V6.5L12 3z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Bolt */}
      <path
        d="M13.5 8.5L10.5 12.5H13L10.5 16.5"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Nav data ────────────────────────────────────────────────────────────────

const navItems = [
  { to: '/home',     icon: Home,     label: 'Home',    desc: 'Deals & promos' },
  { to: '/games',    icon: Gamepad2, label: 'Library', desc: 'All games'      },
  { to: '/settings', icon: Settings, label: 'Settings',desc: 'Configure'      },
]

// ── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { user, steamRunning, isLoadingUser, games } = useAppContext()
  const navigate = useNavigate()
  const [idlingCount, setIdlingCount] = useState(0)

  useEffect(() => {
    const refresh = () => {
      window.steam.getIdleStatus().then(res => {
        if (res.success && res.data) setIdlingCount(res.data.length)
      }).catch(() => {})
    }
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [])

  const recentGames = [...games]
    .filter(g => (g.lastPlayed ?? 0) > 0)
    .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
    .slice(0, 3)

  const totalAchs    = games.reduce((s, g) => s + g.achievementCount, 0)
  const unlockedAchs = games.reduce((s, g) => s + g.achievementsUnlocked, 0)
  const achPct       = totalAchs > 0 ? Math.round((unlockedAchs / totalAchs) * 100) : 0

  // ── Shared nav link renderer ───────────────────────────────────────────
  function NavItem({
    to, icon: Icon, svgIcon, label, desc, badge,
  }: {
    to: string
    icon?: React.ElementType
    svgIcon?: (color: string) => React.ReactNode
    label: string
    desc: string
    badge?: React.ReactNode
  }) {
    return (
      <NavLink
        to={to}
        className={({ isActive }) =>
          clsx('nav-active-glow group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer', isActive ? 'active' : '')
        }
        style={({ isActive }) => isActive
          ? { background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.2)' }
          : { color: 'var(--sub)', border: '1px solid transparent' }
        }
      >
        {({ isActive }) => {
          const color = isActive ? 'var(--accent)' : 'var(--sub)'
          return (
            <>
              <span className="shrink-0 transition-transform group-hover:scale-110">
                {svgIcon
                  ? svgIcon(color)
                  : Icon && <Icon className="w-4 h-4" style={{ color }} />
                }
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{label}</p>
                <p className="text-xs leading-tight mt-0.5" style={{ color: isActive ? 'rgba(59,130,246,0.55)' : 'var(--muted)' }}>
                  {desc}
                </p>
              </div>
              {badge}
            </>
          )
        }}
      </NavLink>
    )
  }

  // ── Section label ────────────────────────────────────────────────────────
  function SectionLabel({ label, right }: { label: string; right?: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between px-3 pt-1 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', letterSpacing: '0.1em' }}>
          {label}
        </p>
        {right}
      </div>
    )
  }

  return (
    <aside className="w-56 flex flex-col shrink-0 select-none" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

      {/* ── Profile section ── */}
      <div className="px-3 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        {isLoadingUser ? (
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full skeleton shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 skeleton rounded" />
              <div className="h-2 w-14 skeleton rounded" />
            </div>
          </div>
        ) : user ? (
          <div className="flex items-center gap-3 px-1">
            <div className="relative shrink-0">
              <img
                src={user.avatarUrl}
                alt={user.personaName}
                className="w-9 h-9 rounded-full object-cover"
                style={{ outline: `2px solid ${steamRunning ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`, outlineOffset: 1 }}
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.personaName.slice(0, 2).toUpperCase())}&background=3b82f6&color=fff&size=64&bold=true`
                }}
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{ background: steamRunning ? 'var(--green)' : 'var(--muted)', border: '2px solid var(--surface)' }}
              />
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{user.personaName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {user.level > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0"
                    style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', fontSize: 10 }}>
                    Lv {user.level}
                  </span>
                )}
                <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                  {steamRunning ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-1 py-0.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <WifiOff className="w-4 h-4" style={{ color: 'var(--muted)' }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>Not connected</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Launch Steam</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Main nav ── */}
      <nav className="px-3 pt-3 pb-2 space-y-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <SectionLabel label="Menu" />
        {navItems.map(({ to, icon, label, desc }) => (
          <NavItem key={to} to={to} icon={icon} label={label} desc={desc} />
        ))}
      </nav>

      {/* ── Idling nav ── */}
      <nav className="px-3 pt-3 pb-2 space-y-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <SectionLabel
          label="Idling"
          right={idlingCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full idle-pulse"
              style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)', fontSize: 10 }}>
              {idlingCount}
            </span>
          )}
        />

        {/* Manual Idle */}
        <NavItem
          to="/idle"
          svgIcon={color => <IdleIcon size={16} color={color} />}
          label="Idle Games"
          desc="Manual idle"
        />

        {/* Auto-Idle */}
        <NavItem
          to="/auto-idle"
          svgIcon={color => <AutoIdleIcon size={16} color={color} />}
          label="Auto-Idle"
          desc="Saved list"
          badge={idlingCount > 0 ? (
            <span className="w-1.5 h-1.5 rounded-full shrink-0 idle-pulse" style={{ background: 'var(--green)' }} />
          ) : undefined}
        />
      </nav>

      {/* ── Recent games ── */}
      {recentGames.length > 0 && (
        <div className="px-3 pt-3 pb-2 flex-1 min-h-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <SectionLabel label="Recent" />
          <div className="space-y-0.5">
            {recentGames.map(game => (
              <button
                key={game.appId}
                onClick={() => navigate(`/achievements/${game.appId}`)}
                className="sidebar-item-hover w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all duration-100 group text-left"
                style={{ color: 'var(--sub)' }}
              >
                <div className="w-8 h-5 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
                  <GameImage appId={game.appId} name={game.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{game.name}</p>
                  {game.achievementCount > 0 && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {game.achievementsUnlocked}/{game.achievementCount}
                      <span className="ml-1" style={{ color: 'var(--accent)', opacity: 0.7 }}>
                        {Math.round(game.achievementPercentage)}%
                      </span>
                    </p>
                  )}
                </div>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" style={{ color: 'var(--sub)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer stats ── */}
      <div className="mt-auto p-3 space-y-2">
        {/* Achievement progress */}
        {games.length > 0 && (
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                <Gamepad2 className="w-3 h-3" /> {games.length}
              </span>
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                <Trophy className="w-3 h-3" /> {unlockedAchs}/{totalAchs}
              </span>
            </div>
            {totalAchs > 0 && (
              <>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${achPct}%`, background: 'linear-gradient(90deg, var(--accent), #7c3aed)' }}
                  />
                </div>
                <p className="text-xs mt-1 text-right tabular-nums" style={{ color: 'var(--muted)', fontSize: 10 }}>
                  {achPct}% complete
                </p>
              </>
            )}
          </div>
        )}

        {/* Steam status */}
        <div
          className="flex items-center gap-2 text-xs rounded-xl px-3 py-2 transition-all duration-300"
          style={{
            background: steamRunning ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
            color:      steamRunning ? 'var(--green)'          : 'var(--red)',
            border:    `1px solid ${steamRunning ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`,
          }}
        >
          {steamRunning
            ? <><Wifi    className="w-3 h-3 shrink-0" /><span>Steam connected</span></>
            : <><WifiOff className="w-3 h-3 shrink-0" /><span>Steam offline</span></>
          }
          {steamRunning && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
          )}
        </div>
      </div>
    </aside>
  )
}
