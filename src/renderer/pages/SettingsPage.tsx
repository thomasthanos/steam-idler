import { useState, useEffect } from 'react'
import { Settings, Moon, Sun, Monitor, Key, Shield, Bell, Eye, Power, BellOff, Volume2, RefreshCw, Download, CheckCircle } from 'lucide-react'
import { useUpdater } from '../hooks/useUpdater'
import { AppSettings } from '@shared/types'
import { useAppContext } from '../hooks/useAppContext'
import { applyTheme } from '../hooks/useTheme'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function SettingsPage() {
  const { settings, updateSettings, fetchGames } = useAppContext()
  const { state: updaterState, check: checkUpdate, install: installUpdate } = useUpdater()
  const [apiKey, setApiKey] = useState(settings.steamApiKey ?? '')
  const [steamId, setSteamId] = useState(settings.steamId ?? '')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    { key: 'confirmBulkActions'    as const, icon: Bell,    label: 'Confirm bulk actions',       desc: 'Show dialog before unlock/lock all' },
    { key: 'showGlobalPercent'     as const, icon: Eye,     label: 'Show global completion %',   desc: 'Show % of players who have each achievement' },
    { key: 'showHiddenAchievements'as const, icon: Eye,     label: 'Show hidden achievements',   desc: 'Reveal hidden achievements before unlock' },
    { key: 'minimizeToTray'        as const, icon: Monitor, label: 'Minimize to tray',            desc: 'Keep running in background when closed' },
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
                onKeyDown={e => e.key === 'Enter' && customAppIds.trim() && save({ customAppIds }).then(() => fetchGames(true))}
              />
              <button
                className="btn-primary"
                disabled={!customAppIds.trim()}
                onClick={() => save({ customAppIds }).then(() => fetchGames(true))}
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

        {/* ── About / Updates ── */}
        <section className="card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <RefreshCw className="w-3.5 h-3.5" /> About
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Souvlatzidiko-Unlocker</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Built with Electron, React &amp; TypeScript. Not affiliated with Valve.
              </p>
            </div>
            {/* Check for updates button */}
            <button
              onClick={checkUpdate}
              disabled={updaterState.status === 'checking' || updaterState.status === 'downloading'}
              className="btn-ghost text-xs shrink-0 flex items-center gap-1.5"
              style={
                updaterState.status === 'downloaded'
                  ? { color: 'var(--green)', borderColor: 'rgba(34,197,94,0.3)' }
                  : updaterState.status === 'available'
                    ? { color: 'var(--accent)', borderColor: 'rgba(59,130,246,0.3)' }
                    : {}
              }
            >
              {updaterState.status === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {updaterState.status === 'downloading' && <Download className="w-3.5 h-3.5 animate-pulse" />}
              {updaterState.status === 'downloaded' && <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--green)' }} />}
              {(updaterState.status === 'idle' || updaterState.status === 'not-available' || updaterState.status === 'error') && <RefreshCw className="w-3.5 h-3.5" />}
              {updaterState.status === 'available' && <Download className="w-3.5 h-3.5" />}

              {updaterState.status === 'idle'          && 'Check for updates'}
              {updaterState.status === 'checking'      && 'Checking…'}
              {updaterState.status === 'not-available' && 'Up to date'}
              {updaterState.status === 'available'     && `v${updaterState.version} available`}
              {updaterState.status === 'downloading'   && `${updaterState.percent}%`}
              {updaterState.status === 'downloaded'    && 'Restart to install'}
              {updaterState.status === 'error'         && 'Retry check'}
            </button>
          </div>

          {/* Download action when available */}
          {updaterState.status === 'available' && (
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>v{updaterState.version} ready to download</p>
                {updaterState.releaseNotes && (
                  <p className="text-xs mt-0.5 max-w-xs truncate" style={{ color: 'var(--muted)' }}>{updaterState.releaseNotes}</p>
                )}
              </div>
              <button onClick={installUpdate} className="btn-primary text-xs">
                <Download className="w-3 h-3" /> Download
              </button>
            </div>
          )}

          {/* Restart when downloaded */}
          {updaterState.status === 'downloaded' && (
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--green)' }}>v{updaterState.version} downloaded — restart to apply</p>
              <button onClick={() => window.steam.installUpdate()} className="btn-ghost text-xs" style={{ color: 'var(--green)', borderColor: 'rgba(34,197,94,0.3)' }}>
                <RefreshCw className="w-3 h-3" /> Restart
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
