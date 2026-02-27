import { useState, useEffect, useRef } from 'react'
import { Settings, Moon, Sun, Monitor, Key, Shield, Bell, Eye, Power, Volume2, RefreshCw, Download, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react'
import { useUpdater } from '../hooks/useUpdater'
import { AppSettings, PartnerAppRelease, PartnerAppDownloadProgress } from '@shared/types'
import { useAppContext } from '../hooks/useAppContext'
import { applyTheme } from '../hooks/useTheme'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function SettingsPage() {
  const { settings, updateSettings } = useAppContext()
  const { state: updaterState, check: checkUpdate } = useUpdater()
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

  // ── Partner apps state ────────────────────────────────────────────────────────────
  const [partnerReleases, setPartnerReleases] = useState<Record<string, PartnerAppRelease>>({})
  const [partnerProgress, setPartnerProgress] = useState<Record<string, PartnerAppDownloadProgress>>({})

  useEffect(() => {
    window.steam.getPartnerAppReleases().then(res => {
      if (res.success && res.data) {
        const map: Record<string, PartnerAppRelease> = {}
        for (const r of res.data) map[r.key] = r
        setPartnerReleases(map)
      }
    }).catch(() => {})

    const unsub = window.steam.onPartnerAppDownloadProgress(p => {
      setPartnerProgress(prev => ({ ...prev, [p.key]: p }))
      if (p.done && !p.error) toast.success('Download complete — installer launched!')
      if (p.done && p.error) toast.error(`Download failed: ${p.error}`)
    })
    return unsub
  }, [])

  const handlePartnerDownload = async (key: string) => {
    const rel = partnerReleases[key]
    if (!rel) return
    setPartnerProgress(prev => ({ ...prev, [key]: { key, percent: 0, done: false } }))
    await window.steam.downloadPartnerApp(key, rel.downloadUrl, rel.fileName)
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
              disabled={updaterState.status === 'checking' || updaterState.status === 'available' || updaterState.status === 'downloading' || updaterState.status === 'downloaded'}
              className="btn-ghost text-xs shrink-0 flex items-center gap-1.5"
              style={
                updaterState.status === 'downloaded'
                  ? { color: 'var(--green)', borderColor: 'rgba(34,197,94,0.3)' }
                  : updaterState.status === 'available'
                    ? { color: 'var(--accent)', borderColor: 'rgba(59,130,246,0.3)' }
                    : {}
              }
            >
              {updaterState.status === 'checking'                         && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {(updaterState.status === 'available' || updaterState.status === 'downloading') && <Download className="w-3.5 h-3.5 animate-pulse" />}
              {updaterState.status === 'downloaded'                        && <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--green)' }} />}
              {(updaterState.status === 'idle' || updaterState.status === 'not-available' || updaterState.status === 'error') && <RefreshCw className="w-3.5 h-3.5" />}

              {updaterState.status === 'idle'          && 'Check for updates'}
              {updaterState.status === 'checking'      && 'Checking…'}
              {updaterState.status === 'not-available' && 'Up to date'}
              {updaterState.status === 'available'     && `Downloading v${updaterState.version}…`}
              {updaterState.status === 'downloading'   && `Downloading — ${updaterState.percent}%`}
              {updaterState.status === 'downloaded'    && `v${updaterState.version} ready`}
              {updaterState.status === 'error'         && 'Retry check'}
            </button>
          </div>

          {/* Downloading — auto-started when update found */}
          {(updaterState.status === 'available' || updaterState.status === 'downloading') && (
            <div className="rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                {updaterState.status === 'available'
                  ? `Downloading v${updaterState.version}…`
                  : `Downloading v${updaterState.version} — ${updaterState.percent}%`}
              </p>
              {updaterState.status === 'downloading' && (
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${updaterState.percent}%`, background: 'var(--accent)' }} />
                </div>
              )}
              {(updaterState as any).releaseNotes && (
                <p className="text-xs mt-1 max-w-xs truncate" style={{ color: 'var(--muted)' }}>{(updaterState as any).releaseNotes}</p>
              )}
            </div>
          )}

          {/* Error details */}
          {updaterState.status === 'error' && updaterState.message && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <p className="text-xs" style={{ color: 'var(--red)' }}>{updaterState.message}</p>
            </div>
          )}

          {/* Downloaded — restarting automatically */}
          {updaterState.status === 'downloaded' && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--green)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
                v{updaterState.version} downloaded — restarting automatically…
              </p>
            </div>
          )}
        </section>

        {/* ── More Apps by ThomasThanos ── */}
        <section className="card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <ExternalLink className="w-3.5 h-3.5" /> More Apps by ThomasThanos
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                key: 'myle',
                name: 'Make Your Life Easier',
                desc: 'Password manager, system tools, software installer & more — all in one app.',
                accent: '#7c3aed',
                bg: 'rgba(124,58,237,0.12)',
                border: 'rgba(124,58,237,0.2)',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="#7c3aed" strokeWidth="1.8"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="1.5" fill="#7c3aed"/>
                  </svg>
                ),
              },
              {
                key: 'gbr',
                name: 'GitHub Build & Release',
                desc: 'GUI για build, δημιουργία & διαχείριση GitHub releases με ένα κλικ.',
                accent: '#3b82f6',
                bg: 'rgba(59,130,246,0.10)',
                border: 'rgba(59,130,246,0.2)',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" fill="#3b82f6"/>
                  </svg>
                ),
              },
            ].map(({ key, name, desc, accent, bg, border, icon }) => {
              const rel = partnerReleases[key]
              const prog = partnerProgress[key]
              const isDownloading = prog && !prog.done
              const isDone = prog?.done && !prog.error
              const isError = prog?.done && !!prog.error

              return (
                <div
                  key={key}
                  className="rounded-xl p-4 flex flex-col gap-3 transition-all duration-200"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--borderhov)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: bg, border: `1px solid ${border}` }}>
                    {icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>{name}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
                  </div>

                  {/* Progress bar (while downloading) */}
                  {isDownloading && (
                    <div className="space-y-1">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{ width: `${prog.percent}%`, background: accent }}
                        />
                      </div>
                      <p className="text-xs" style={{ color: accent }}>{prog.percent}%</p>
                    </div>
                  )}

                  {/* Download button */}
                  <button
                    onClick={() => handlePartnerDownload(key)}
                    disabled={isDownloading || isDone}
                    className="btn-primary text-xs flex items-center justify-center gap-1.5"
                    style={
                      isDone ? { background: 'rgba(34,197,94,0.15)', color: 'var(--green)', borderColor: 'rgba(34,197,94,0.3)' }
                      : isError ? { background: 'rgba(239,68,68,0.10)', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.25)' }
                      : {}
                    }
                  >
                    {isDownloading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {isDone       && <CheckCircle className="w-3.5 h-3.5" />}
                    {isError      && <AlertCircle className="w-3.5 h-3.5" />}
                    {!isDownloading && !isDone && !isError && <Download className="w-3.5 h-3.5" />}

                    {isDownloading && `Downloading… ${prog.percent}%`}
                    {isDone        && 'Installed!'}
                    {isError       && 'Retry'}
                    {!isDownloading && !isDone && !isError && (
                      rel ? `Download v${rel.version}` : 'Download'
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
