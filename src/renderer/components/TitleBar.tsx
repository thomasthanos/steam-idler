import { Minus, Square, X, Settings } from 'lucide-react'
import { useNavigate, useMatch } from 'react-router-dom'

// Steam logo SVG (faithful to the original shape)
function SteamIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" fill="#1b2838" />
      {/* Outer gear ring */}
      <circle cx="16" cy="16" r="10" fill="none" stroke="#c6d4df" strokeWidth="2.2" />
      {/* Gear teeth */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const r = deg * Math.PI / 180
        const x1 = 16 + 10 * Math.sin(r)
        const y1 = 16 - 10 * Math.cos(r)
        const x2 = 16 + 13 * Math.sin(r)
        const y2 = 16 - 13 * Math.cos(r)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c6d4df" strokeWidth="2.2" strokeLinecap="round" />
      })}
      {/* Inner circle cutout */}
      <circle cx="16" cy="16" r="5.5" fill="#1b2838" stroke="#c6d4df" strokeWidth="2" />
      {/* Steam gradient overlay tint */}
      <circle cx="16" cy="16" r="5.5" fill="url(#steamGrad)" fillOpacity="0.6" />
      <defs>
        <radialGradient id="steamGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#66c0f4" />
          <stop offset="100%" stopColor="#1b2838" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}

export default function TitleBar() {
  const navigate = useNavigate()
  const isSettings = useMatch('/settings')
  return (
    <div
      className="flex items-center h-9 drag-region z-50 shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      {/* App logo + name */}
      <div className="flex items-center gap-2 px-3 no-drag">
        <SteamIcon size={16} />
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--sub)' }}>
          Souvlatzidiko<span style={{ color: 'var(--accent)' }}>-Unlocker</span>
        </span>
      </div>

      <div className="flex-1" />

      {/* Settings button */}
      <button
        onClick={() => navigate('/settings')}
        className="no-drag group flex items-center gap-1.5 px-3 h-full transition-all duration-200"
        style={{
          color: isSettings ? 'var(--accent)' : 'var(--muted)',
          background: isSettings ? 'rgba(59,130,246,0.08)' : 'transparent',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
        }}
        onMouseEnter={e => {
          if (!isSettings) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = 'var(--sub)'
          }
        }}
        onMouseLeave={e => {
          if (!isSettings) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--muted)'
          }
        }}
        title="Settings"
      >
        <Settings className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-45" />
        <span className="text-xs font-medium">Settings</span>
      </button>

      {/* Window controls */}
      <div className="flex no-drag h-full">
        {[
          { action: () => window.windowAPI.minimize(), icon: <Minus className="w-3 h-3" />, cls: '' },
          { action: () => window.windowAPI.maximize(), icon: <Square className="w-3 h-3" />, cls: '' },
          { action: () => window.windowAPI.close(),   icon: <X     className="w-3.5 h-3.5" />, cls: ' danger' },
        ].map(({ action, icon, cls }, i) => (
          <button
            key={i}
            onClick={action}
            className={`titlebar-btn${cls} w-11 h-full flex items-center justify-center transition-all duration-150`}
            style={{ color: 'var(--muted)' }}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}
