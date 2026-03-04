import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Gamepad2, Settings, User, ChevronRight, Sparkles } from 'lucide-react'
import { useAppContext } from '../hooks/useAppContext'
import GameImage from './GameImage'
import clsx from 'clsx'
import React, { useState, useEffect } from 'react'

// ── Custom SVG icons ────────────────────────────────────────────────────────

function IdleIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9.5C6 8.12 7.12 7 8.5 7h7C16.88 7 18 8.12 18 9.5v3c0 2.21-1.79 4-4 4H10c-2.21 0-4-1.79-4-4v-3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="8" y1="10.5" x2="10" y2="10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="9.5" x2="9" y2="11.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="15" cy="10.5" r="1" fill={color} />
      <path d="M9.5 14.5 Q12 16.5 14.5 14.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <text x="17" y="8" fontSize="4" fill={color} fontFamily="sans-serif" fontWeight="bold" opacity="0.85">z</text>
      <text x="19" y="6" fontSize="3" fill={color} fontFamily="sans-serif" fontWeight="bold" opacity="0.55">z</text>
      <text x="20.5" y="4.5" fontSize="2.5" fill={color} fontFamily="sans-serif" fontWeight="bold" opacity="0.3">z</text>
    </svg>
  )
}

function AutoIdleIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L4 6.5V12c0 4.2 3.4 7.4 8 9 4.6-1.6 8-4.8 8-9V6.5L12 3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13.5 8.5L10.5 12.5H13L10.5 16.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Nav data ────────────────────────────────────────────────────────────────

const navItems = [
  { to: '/home',  icon: Home,     label: 'Home'    },
  { to: '/games', icon: Gamepad2, label: 'Achievements' },
]

// ── NavItem (defined OUTSIDE of Sidebar to prevent unmount/remount on every render) ──

function NavItem({ to, icon: Icon, svgIcon, label, badge }: {
  to: string
  icon?: React.ElementType
  svgIcon?: (color: string) => React.ReactNode
  label: string
  badge?: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx('nav-active-glow group flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer', isActive ? 'active' : '')
      }
      style={({ isActive }) => isActive
        ? { background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.2)' }
        : { color: 'var(--sub)', border: '1px solid transparent' }
      }
      onMouseEnter={e => {
        const el = e.currentTarget
        if (!el.classList.contains('active')) {
          el.style.background = 'rgba(255,255,255,0.04)'
          el.style.borderColor = 'rgba(255,255,255,0.07)'
          el.style.transform = 'translateX(2px)'
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        if (!el.classList.contains('active')) {
          el.style.background = 'transparent'
          el.style.borderColor = 'transparent'
          el.style.transform = 'translateX(0)'
        }
      }}
    >
      {({ isActive }) => {
        const color = isActive ? 'var(--accent)' : 'var(--sub)'
        return (
          <>
            <span className="shrink-0 transition-all duration-200 group-hover:scale-110">
              {svgIcon ? svgIcon(color) : Icon && <Icon className="w-4 h-4" style={{ color }} />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{label}</p>
            </div>
            {badge}
          </>
        )
      }}
    </NavLink>
  )
}

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

// ── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { steamRunning, user, recentGames } = useAppContext()
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

  return (
    <aside className="w-48 flex flex-col shrink-0 select-none" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

      {/* ── Main nav ── */}
      <nav className="px-2 pt-3 pb-2 space-y-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <SectionLabel label="Menu" />
        {navItems.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} />
        ))}
      </nav>

      {/* ── Idling nav ── */}
      <nav className="px-2 pt-3 pb-2 space-y-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <SectionLabel
          label="Idling"
          right={idlingCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full idle-pulse"
              style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)', fontSize: 10 }}>
              {idlingCount}
            </span>
          )}
        />
        <NavItem to="/idle" svgIcon={color => <IdleIcon size={16} color={color} />} label="Idle Games" />
        <NavItem
          to="/auto-idle"
          svgIcon={color => <AutoIdleIcon size={16} color={color} />}
          label="Auto-Idle"
          badge={idlingCount > 0 ? (
            <span className="w-1.5 h-1.5 rounded-full shrink-0 idle-pulse" style={{ background: 'var(--green)' }} />
          ) : undefined}
        />
      </nav>

      {/* ── Last Played ── */}
      {recentGames.length > 0 && (
        <div className="px-2 pt-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <SectionLabel label="Last Played" />
          <div className="space-y-0.5">
            {recentGames.slice(0, 2).map(game => (
              <button
                key={game.appId}
                onClick={() => navigate(`/achievements/${game.appId}`)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all duration-150 group text-left"
                style={{ color: 'var(--sub)', border: '1px solid transparent' }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                <div className="w-8 h-5 rounded overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
                  <GameImage appId={game.appId} name={game.name} />
                </div>
                <p className="text-xs font-medium truncate flex-1 min-w-0" style={{ color: 'var(--text)' }}>
                  {game.name}
                </p>
                <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" style={{ color: 'var(--sub)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-auto p-2.5 space-y-1.5">

        {/* More Apps */}
        <NavLink
          to="/portfolio"
          className="group block rounded-xl overflow-hidden transition-all duration-200"
          style={{ border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.background = 'rgba(167,139,250,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.2)'; e.currentTarget.style.background = 'rgba(167,139,250,0.05)' }}
        >
          <div className="px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(167,139,250,0.15)' }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight" style={{ color: '#a78bfa' }}>More Apps</p>
              <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'rgba(167,139,250,0.6)' }}>by ThomasThanos</p>
            </div>
            <ChevronRight className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-90 group-hover:translate-x-0.5 transition-all" style={{ color: '#a78bfa' }} />
          </div>
        </NavLink>

        {/* Profile + Settings icon */}
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

          {/* Avatar with steam status dot */}
          <div className="relative shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} className="w-7 h-7 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
                <User className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
              </div>
            )}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{
                background: steamRunning ? 'var(--green)' : 'var(--muted)',
                borderColor: 'var(--card)',
                boxShadow: steamRunning ? '0 0 5px var(--green)' : 'none',
              }}
            />
          </div>

          {/* Name + SteamID */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
              {user?.personaName ?? (steamRunning ? 'Loading…' : 'Steam offline')}
            </p>
            {user?.steamId && (
              <p className="text-[10px] font-mono truncate" style={{ color: 'var(--muted)' }}>{user.steamId}</p>
            )}
          </div>

          {/* Settings — icon only */}
          <NavLink
            to="/settings"
            className={({ isActive }) => clsx(
              'shrink-0 p-1.5 rounded-lg transition-colors',
              isActive
                ? 'text-[var(--accent)] bg-[rgba(59,130,246,0.12)]'
                : 'text-[var(--muted)] hover:text-[var(--sub)] hover:bg-[var(--hover-overlay)]',
            )}
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
