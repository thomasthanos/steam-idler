import { useState, useEffect, useRef, type ReactNode } from 'react'
import {
  Moon, Sun, Monitor, Key, Bell, Eye, Power, User,
  EyeOff, LogIn, LogOut, QrCode, Cookie, RefreshCw, Palette, Sliders,
  type LucideIcon,
} from 'lucide-react'
import { AppSettings, SteamAccountStatusInfo, QrLoginEvent } from '@shared/types'
import { useAppContext } from '../hooks/useAppContext'
import { applyTheme } from '../hooks/useTheme'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ─── Sidebar nav ──────────────────────────────────────────────────────────
type SectionId = 'appearance' | 'system' | 'api' | 'notifications' | 'account' | 'behaviour'

const NAV: { id: SectionId; icon: LucideIcon; label: string }[] = [
  { id: 'appearance',    icon: Palette,  label: 'Appearance'    },
  { id: 'system',        icon: Power,    label: 'System'        },
  { id: 'api',           icon: Key,      label: 'Steam API'     },
  { id: 'notifications', icon: Bell,     label: 'Notifications' },
  { id: 'account',       icon: User,     label: 'Steam Account' },
  { id: 'behaviour',     icon: Sliders,  label: 'Behaviour'     },
]

// ─── Shared atoms ─────────────────────────────────────────────────────────
function SectionHead({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2.5 rounded-xl shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
        <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{sub}</p>
      </div>
    </div>
  )
}

function Row({ label, desc, dimmed, children }: { label: string; desc?: string; dimmed?: boolean; children: ReactNode }) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-6 py-3.5 border-b last:border-b-0',
        dimmed && 'opacity-40 pointer-events-none',
      )}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={clsx('toggle', value && 'on')} role="switch" aria-checked={value}>
      <span className="toggle-knob" />
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { settings, updateSettings } = useAppContext()
  const [activeSection, setActiveSection] = useState<SectionId>('appearance')
  const [apiKey, setApiKey]           = useState(settings.steamApiKey  ?? '')
  const [customAppIds, setCustomAppIds] = useState(settings.customAppIds ?? '')
  const [autostart, setAutostart]     = useState(false)

  // Steam Account state
  const [accountInfo, setAccountInfo]   = useState<SteamAccountStatusInfo>({ status: 'disconnected', username: null })
  const [accountLoading, setAccountLoading] = useState(false)
  const [authMethod, setAuthMethod]     = useState<'qr' | 'cookie'>('qr')
  const [qrDataUrl, setQrDataUrl]       = useState<string | null>(null)
  const [qrStatus, setQrStatus]         = useState<'idle' | 'loading' | 'waiting' | 'scanned' | 'success' | 'timeout' | 'error'>('idle')
  const [qrError, setQrError]           = useState<string | null>(null)
  const [cookieValue, setCookieValue]   = useState('')
  const [showCookie, setShowCookie]     = useState(false)
  const unsubAccountRef = useRef<(() => void) | null>(null)
  const unsubQrRef      = useRef<(() => void) | null>(null)

  useEffect(() => {
    setApiKey(settings.steamApiKey ?? '')
    setCustomAppIds(settings.customAppIds ?? '')
  }, [settings.steamApiKey, settings.customAppIds])

  useEffect(() => {
    if (!settings.steamId) {
      window.steam.getUserInfo().then(res => {
        if (res.success && res.data?.steamId) updateSettings({ steamId: res.data.steamId }).catch(() => {})
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    window.steam.getAutostart().then(res => {
      if (res.success) setAutostart(res.data ?? false)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    window.steam.steamAccountStatus().then(res => {
      if (res.success && res.data) setAccountInfo(res.data)
    }).catch(() => {})

    unsubAccountRef.current = window.steam.onSteamAccountStatusChanged(setAccountInfo)
    unsubQrRef.current = window.steam.onSteamAccountQrEvent((evt: QrLoginEvent) => {
      if (evt.type === 'qr-code') { setQrDataUrl(evt.dataUrl); setQrStatus('waiting') }
      if (evt.type === 'scanned') { setQrStatus('scanned') }
      if (evt.type === 'success') { setQrStatus('success') }
      if (evt.type === 'timeout') { setQrStatus('timeout'); setQrDataUrl(null) }
      if (evt.type === 'error')   { setQrStatus('error'); setQrError(evt.message); setQrDataUrl(null) }
    })
    return () => { unsubAccountRef.current?.(); unsubQrRef.current?.() }
  }, [])

  // ─── Handlers ──────────────────────────────────────────────────────────
  const save = async (partial: Partial<AppSettings>) => {
    try { await updateSettings(partial); toast.success('Saved') }
    catch { toast.error('Failed to save') }
  }

  const toggleAutostart = async () => {
    const next = !autostart
    try {
      const res = await window.steam.setAutostart(next)
      if (res.success) { setAutostart(next); toast.success(next ? 'Will launch on startup' : 'Removed from startup') }
      else toast.error('Failed to update startup setting')
    } catch { toast.error('Error updating startup') }
  }

  const startQr = async () => {
    setQrStatus('loading'); setQrDataUrl(null); setQrError(null)
    await window.steam.steamAccountQrStart()
  }

  const cancelQr = () => {
    window.steam.steamAccountQrCancel(); setQrStatus('idle'); setQrDataUrl(null)
  }

  const connectWithCookie = async () => {
    if (!cookieValue.trim()) return
    setAccountLoading(true)
    try {
      const res = await window.steam.steamAccountTokenLogin(cookieValue.trim())
      if (res.success) { toast.success('Connected'); setCookieValue('') }
      else toast.error(res.error ?? 'Login failed')
    } catch { toast.error('Login failed') }
    finally { setAccountLoading(false) }
  }

  const disconnectSteamAccount = async () => {
    setAccountLoading(true); cancelQr()
    try { await window.steam.steamAccountLogout(); toast.success('Disconnected') }
    catch { toast.error('Logout failed') }
    finally { setAccountLoading(false) }
  }

  // ─── Section renderers ─────────────────────────────────────────────────
  const renderAppearance = () => (
    <>
      <SectionHead icon={Palette} title="Appearance" sub="Customize the look and feel of the app" />
      <div className="card">
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted)' }}>Theme</p>
        <div className="flex gap-2">
          {([
            { value: 'dark',   icon: Moon,    label: 'Dark'   },
            { value: 'light',  icon: Sun,     label: 'Light'  },
            { value: 'system', icon: Monitor, label: 'System' },
          ] as const).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => { save({ theme: value }); applyTheme(value) }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all"
              style={settings.theme === value
                ? { background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', borderColor: 'rgba(59,130,246,0.35)' }
                : { background: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--border)' }
              }
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>
    </>
  )

  const renderSystem = () => (
    <>
      <SectionHead icon={Power} title="System" sub="Control startup and window behaviour" />
      <div className="card">
        <Row label="Launch at startup" desc="Automatically start when Windows boots">
          <Toggle value={autostart} onChange={toggleAutostart} />
        </Row>
        <Row label="Minimize to tray" desc="Keep running in the background when the window is closed">
          <Toggle value={settings.minimizeToTray} onChange={() => save({ minimizeToTray: !settings.minimizeToTray })} />
        </Row>
      </div>
    </>
  )

  const renderApi = () => (
    <>
      <SectionHead icon={Key} title="Steam API" sub="Configure your API key and custom game IDs" />
      <div className="space-y-3">
        <div className="card space-y-3">
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--sub)' }}>Steam API Key</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Required for your full game library, avatars and achievement stats.{' '}
              <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer"
                className="hover:underline" style={{ color: 'var(--accent)' }}>Get your key →</a>
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              className="input flex-1 font-mono text-sm"
              placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && apiKey.trim() && save({ steamApiKey: apiKey })}
            />
            <button className="btn-primary" disabled={!apiKey.trim()} onClick={() => save({ steamApiKey: apiKey })}>Save</button>
          </div>
        </div>

        <div className="card space-y-3">
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--sub)' }}>Custom AppIDs</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Force-show specific games in your library (e.g.{' '}
              <span className="font-mono" style={{ color: 'var(--sub)' }}>218, 4000</span>).
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono text-sm"
              placeholder="218, 4000, …"
              value={customAppIds}
              onChange={e => setCustomAppIds(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && customAppIds.trim() && save({ customAppIds })}
            />
            <button className="btn-primary" disabled={!customAppIds.trim()} onClick={() => save({ customAppIds })}>Save</button>
          </div>
          <p className="text-xs -mt-1" style={{ color: 'var(--muted)' }}>Library refreshes automatically after saving.</p>
        </div>
      </div>
    </>
  )

  const renderNotifications = () => (
    <>
      <SectionHead icon={Bell} title="Notifications" sub="Configure desktop alerts and sounds" />
      <div className="card">
        <Row label="Desktop notifications" desc="Show alerts for achievements, idle start and stop">
          <Toggle value={settings.notificationsEnabled} onChange={() => save({ notificationsEnabled: !settings.notificationsEnabled })} />
        </Row>
        <Row label="Notification sound" desc="Play the Windows notification ding" dimmed={!settings.notificationsEnabled}>
          <Toggle value={settings.notificationSound} onChange={() => save({ notificationSound: !settings.notificationSound })} />
        </Row>
      </div>
    </>
  )

  const renderAccount = () => (
    <>
      <SectionHead icon={User} title="Steam Account" sub="Link your account to enable auto-invisible" />
      <div className="space-y-3">

        {/* Connection card */}
        <div className="card">
          {accountInfo.status === 'connected' ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--sub)' }}>
                    {accountInfo.username
                      ? <>Connected as <span style={{ color: 'var(--accent)' }}>{accountInfo.username}</span></>
                      : 'Connected'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Auto-invisible activates when idling starts</p>
                </div>
              </div>
              <button onClick={disconnectSteamAccount} disabled={accountLoading} className="btn-danger shrink-0">
                <LogOut className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>

          ) : accountInfo.status === 'connecting' ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse bg-yellow-500 shrink-0" />
              Connecting to Steam…
            </div>

          ) : (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                Connect your Steam account to automatically go{' '}
                <strong style={{ color: 'var(--sub)' }}>Invisible</strong> when idling starts.
              </p>

              {/* Auth method tabs */}
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
                {([
                  { id: 'qr'     as const, icon: QrCode, label: 'QR Code'       },
                  { id: 'cookie' as const, icon: Cookie, label: 'Session Cookie' },
                ] as const).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => { setAuthMethod(id); cancelQr() }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={authMethod === id
                      ? { background: 'var(--card)', color: 'var(--sub)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }
                      : { color: 'var(--muted)' }
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              {/* ── QR Code panel ── */}
              {authMethod === 'qr' && (
                <div className="space-y-3">
                  {qrStatus === 'idle' && (
                    <button onClick={startQr} className="btn-primary w-full justify-center">
                      <QrCode className="w-4 h-4" /> Generate QR Code
                    </button>
                  )}
                  {qrStatus === 'loading' && (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs" style={{ color: 'var(--muted)' }}>
                      <span className="w-2 h-2 rounded-full animate-pulse bg-blue-400" /> Generating…
                    </div>
                  )}
                  {(qrStatus === 'waiting' || qrStatus === 'scanned') && qrDataUrl && (
                    <div className="space-y-2.5">
                      <div className="flex justify-center">
                        <div className="rounded-xl p-3" style={{ background: '#ffffff' }}>
                          <img src={qrDataUrl} alt="Steam QR code" width={176} height={176} />
                        </div>
                      </div>
                      <p className="text-center text-xs" style={{ color: qrStatus === 'scanned' ? 'var(--green)' : 'var(--muted)' }}>
                        {qrStatus === 'scanned'
                          ? '✓ Scanned — approve in the Steam mobile app'
                          : 'Open Steam app → Steam Guard → Scan QR Code'}
                      </p>
                      <button onClick={cancelQr} className="btn-ghost w-full justify-center text-xs">Cancel</button>
                    </div>
                  )}
                  {qrStatus === 'success' && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--green)' }}>
                      <span className="w-2 h-2 rounded-full animate-pulse bg-green-500 shrink-0" /> Approved — logging in…
                    </div>
                  )}
                  {(qrStatus === 'timeout' || qrStatus === 'error') && (
                    <div className="space-y-2">
                      <p className="text-xs" style={{ color: 'var(--red)' }}>
                        {qrStatus === 'timeout' ? 'QR code expired — generate a new one.' : (qrError ?? 'Unknown error')}
                      </p>
                      <button onClick={startQr} className="btn-primary w-full justify-center">
                        <RefreshCw className="w-3.5 h-3.5" />{qrStatus === 'timeout' ? 'New QR Code' : 'Retry'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Session Cookie panel ── */}
              {authMethod === 'cookie' && (
                <div className="space-y-3">
                  <div className="rounded-xl p-3 text-xs space-y-1.5"
                    style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <p className="font-semibold" style={{ color: 'var(--sub)' }}>How to get your cookie</p>
                    <ol className="space-y-1 list-decimal list-inside leading-relaxed" style={{ color: 'var(--muted)' }}>
                      <li>Open <span className="font-mono" style={{ color: 'var(--sub)' }}>store.steampowered.com</span> in your browser</li>
                      <li>Open DevTools → Application → Cookies</li>
                      <li>Copy the value of <span className="font-mono" style={{ color: 'var(--sub)' }}>steamLoginSecure</span></li>
                    </ol>
                  </div>
                  <div className="relative">
                    <input
                      type={showCookie ? 'text' : 'password'}
                      className="input w-full text-xs font-mono pr-9"
                      placeholder="Paste steamLoginSecure value…"
                      value={cookieValue}
                      onChange={e => setCookieValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && connectWithCookie()}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCookie(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--muted)' }}
                      tabIndex={-1}
                    >
                      {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={connectWithCookie}
                    disabled={accountLoading || !cookieValue.trim()}
                    className="btn-primary w-full justify-center"
                  >
                    <LogIn className="w-4 h-4" />{accountLoading ? 'Connecting…' : 'Connect'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Auto-invisible toggle */}
        <div className="card">
          <Row label="Auto-invisible when idling" desc="Set status to Invisible when idling starts, restore on stop">
            <Toggle value={settings.autoInvisibleWhenIdling} onChange={() => save({ autoInvisibleWhenIdling: !settings.autoInvisibleWhenIdling })} />
          </Row>
        </div>

        {/* Stop idle on game launch toggle */}
        <div className="card">
          <Row label="Stop idle on game launch" desc="Detect running games and stop idling automatically when you launch a game">
            <Toggle value={settings.stopIdleOnGameLaunch} onChange={() => save({ stopIdleOnGameLaunch: !settings.stopIdleOnGameLaunch })} />
          </Row>
        </div>
      </div>
    </>
  )

  const renderBehaviour = () => (
    <>
      <SectionHead icon={Sliders} title="Behaviour" sub="Achievement viewer and action preferences" />
      <div className="card">
        <Row label="Confirm bulk actions" desc="Show a dialog before unlocking or locking all achievements">
          <Toggle value={settings.confirmBulkActions} onChange={() => save({ confirmBulkActions: !settings.confirmBulkActions })} />
        </Row>
        <Row label="Show global completion %" desc="Display the percentage of players who have each achievement">
          <Toggle value={settings.showGlobalPercent} onChange={() => save({ showGlobalPercent: !settings.showGlobalPercent })} />
        </Row>
        <Row label="Show hidden achievements" desc="Reveal names and icons before the achievement is unlocked">
          <Toggle value={settings.showHiddenAchievements} onChange={() => save({ showHiddenAchievements: !settings.showHiddenAchievements })} />
        </Row>
      </div>
    </>
  )

  // ─── Layout ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside
        className="w-44 shrink-0 flex flex-col py-5 px-2 border-r"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-3" style={{ color: 'var(--muted)' }}>
          Settings
        </p>
        <nav className="space-y-0.5">
          {NAV.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                activeSection === id
                  ? 'bg-[rgba(59,130,246,0.12)] text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--sub)] hover:bg-[var(--hover-overlay)]',
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        <div className="px-7 py-7">
          {activeSection === 'appearance'    && renderAppearance()}
          {activeSection === 'system'        && renderSystem()}
          {activeSection === 'api'           && renderApi()}
          {activeSection === 'notifications' && renderNotifications()}
          {activeSection === 'account'       && renderAccount()}
          {activeSection === 'behaviour'     && renderBehaviour()}
        </div>
      </main>
    </div>
  )
}
