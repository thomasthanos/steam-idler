import { useState, useEffect } from 'react'
import { Settings, Moon, Sun, Monitor, Key, Shield, Bell, Eye, Power, Volume2 } from 'lucide-react'
import { AppSettings } from '@shared/types'
import { useAppContext } from '../hooks/useAppContext'
import { applyTheme } from '../hooks/useTheme'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function SettingsPage() {
  const { settings, updateSettings } = useAppContext()
  const [apiKey, setApiKey] = useState(settings.steamApiKey ?? '')
  const [steamId, setSteamId] = useState(settings.steamId ?? '')
  const [customAppIds, setCustomAppIds] = useState(settings.customAppIds ?? '')
  const [autostart, setAutostart] = useState(false)

  useEffect(() => {
    setApiKey(settings.steamApiKey ?? '')
    setSteamId(settings.steamId ?? '')
    setCustomAppIds(settings.customAppIds ?? '')
  }, [settings.steamApiKey, settings.steamId, settings.customAppIds])

  // Auto-detect and save Steam ID on mount
  useEffect(() => {
    if (!settings.steamId) {
      window.steam.getUserInfo().then(res => {
        if (res.success && res.data?.steamId) {
          setSteamId(res.data.steamId)
          updateSettings({ steamId: res.data.steamId }).catch(() => {})
        }
      }).catch(() => {})
    }
  }, [])

  // Fetch real autostart state from OS
  useEffect(() => {
    window.steam.getAutostart().then(res => {
      if (res.success) setAutostart(res.data ?? false)
    }).catch(() => {})
  }, [])

  const save = async (partial: Partial<AppSettings>) => {
    try {
      await updateSettings(partial)
      toast.success('Saved')
    } catch {
      toast.error('Failed to save')
    }
  }

  const toggleAutostart = async () => {
    const next = !autostart
    try {
      const res = await window.steam.setAutostart(next)
      if (res.success) {
        setAutostart(next)
        toast.success(next ? 'Will launch on startup' : 'Removed from startup')
      } else {
        toast.error('Failed to update startup setting')
      }
    } catch {
      toast.error('Error updating startup')
    }
  }

  const behaviorToggles = [
    { key: 'confirmBulkActions'     as const, icon: Bell, label: 'Confirm bulk actions',     desc: 'Show dialog before unlock/lock all' },
    { key: 'showGlobalPercent'      as const, icon: Eye,  label: 'Show global completion %', desc: 'Show % of players who have each achievement' },
    { key: 'showHiddenAchievements' as const, icon: Eye,  label: 'Show hidden achievements', desc: 'Reveal hidden achievements before unlock' },
    // NOTE: minimizeToTray is already in the System section above — do NOT add it here again
  ]

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-5">

        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Settings</h1>
        </div>

        {/* ── Appearance ── */}
        <section className="card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Appearance</h2>
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--sub)' }}>Theme</label>
            <div className="flex gap-2">
              {([
                { value: 'dark',   icon: Moon,    label: 'Dark' },
                { value: 'light',  icon: Sun,     label: 'Light' },
                { value: 'system', icon: Monitor, label: 'System' },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => { save({ theme: value }); applyTheme(value) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
                  style={settings.theme === value
                    ? { background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', borderColor: 'rgba(59,130,246,0.3)' }
                    : { background: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--border)' }
                  }
                  onMouseEnter={e => {
                    if (settings.theme !== value) {
                      e.currentTarget.style.borderColor = 'var(--borderhov)'
                      e.currentTarget.style.color = 'var(--sub)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (settings.theme !== value) {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.color = 'var(--muted)'
                    }
                  }}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── System ── */}
        <section className="card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <Power className="w-3.5 h-3.5" /> System
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Power className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>Launch at startup</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Start Souvlatzidiko-Unlocker when Windows boots
                </p>
              </div>
            </div>
            <button
              onClick={toggleAutostart}
              className={clsx('toggle', autostart && 'on')}
              aria-checked={autostart}
              role="switch"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Monitor className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>Minimize to tray</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Keep running in background when closed
                </p>
              </div>
            </div>
            <button
              onClick={() => save({ minimizeToTray: !settings.minimizeToTray })}
              className={clsx('toggle', settings.minimizeToTray && 'on')}
              aria-checked={settings.minimizeToTray}
              role="switch"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </section>

        {/* ── Steam Web API ── */}
        <section className="card space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <Key className="w-3.5 h-3.5" /> Steam Web API
          </h2>

          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--sub)' }}>Custom Game AppIDs</label>
            <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
              Comma-separated AppIDs to force-show in your library (e.g. <span className="font-mono" style={{ color: 'var(--sub)' }}>218, 4000</span>).
            </p>
            <div className="flex gap-2">
              <input
                className="input flex-1 font-mono text-sm"
                placeholder="218, 4000, …"
                value={customAppIds}
                onChange={e => setCustomAppIds(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && customAppIds.trim() && save({ customAppIds })}
              />
              <button
                className="btn-primary"
                disabled={!customAppIds.trim()}
                onClick={() => save({ customAppIds })}
              >
                Save
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>Library reloads automatically after saving.</p>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--sub)' }}>Steam API Key</label>
            <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
              Required for the full game list, avatars and achievement stats.{' '}
              <a
                href="https://steamcommunity.com/dev/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}
                className="hover:underline"
              >
                Get yours here
              </a>
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                className="input flex-1 font-mono text-sm"
                placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && apiKey.trim() && save({ steamApiKey: apiKey })}
              />
              <button
                className="btn-primary"
                disabled={!apiKey.trim()}
                onClick={() => save({ steamApiKey: apiKey })}
              >
                Save
              </button>
            </div>
          </div>
        </section>

        {/* ── Notifications ── */}
        <section className="card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <Bell className="w-3.5 h-3.5" /> Notifications
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Bell className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>Desktop notifications</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Show Windows notifications for achievements, idle start/stop
                </p>
              </div>
            </div>
            <button
              onClick={() => save({ notificationsEnabled: !settings.notificationsEnabled })}
              className={clsx('toggle', settings.notificationsEnabled && 'on')}
              aria-checked={settings.notificationsEnabled}
              role="switch"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4" style={{ opacity: settings.notificationsEnabled ? 1 : 0.4, pointerEvents: settings.notificationsEnabled ? 'auto' : 'none' }}>
            <div className="flex items-start gap-3">
              <Volume2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>Notification sound</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Play Windows notification sound (ding)
                </p>
              </div>
            </div>
            <button
              onClick={() => save({ notificationSound: !settings.notificationSound })}
              className={clsx('toggle', settings.notificationSound && 'on')}
              aria-checked={settings.notificationSound}
              role="switch"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </section>

        {/* ── Behaviour ── */}
        <section className="card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <Shield className="w-3.5 h-3.5" /> Behaviour
          </h2>

          {behaviorToggles.map(({ key, icon: Icon, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</p>
                </div>
              </div>
              <button
                onClick={() => save({ [key]: !settings[key] })}
                className={clsx('toggle', settings[key] && 'on')}
                aria-checked={settings[key]}
                role="switch"
              >
                <span className="toggle-knob" />
              </button>
            </div>
          ))}
        </section>

      </div>
    </div>
  )
}
