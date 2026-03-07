import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Moon, Sun, Monitor, Bell, Eye, Power, User,
  EyeOff, LogIn, LogOut, QrCode, Cookie, RefreshCw, Palette, Sliders, Key,
  type LucideIcon, Shield, Clock, Gamepad2,
  HelpCircle, Info, ChevronRight, Laptop, CheckCircle2,
  AlertCircle, Loader2, Settings2, Volume2, Globe,
  Sparkles, Timer, X
} from 'lucide-react'
import { AppSettings, SteamAccountStatusInfo, QrLoginEvent } from '@shared/types'
import { useAppContext } from '../hooks/useAppContext'
import { applyTheme } from '../hooks/useTheme'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Theme = 'dark' | 'light' | 'system'

type SectionId = 'appearance' | 'account' | 'idle' | 'notifications' | 'advanced'

interface Section {
  id: SectionId
  icon: LucideIcon
  label: string
  description: string
  color: string
  gradient: string
  badge?: string
}

const SECTIONS: Section[] = [
  { 
    id: 'appearance', 
    icon: Palette, 
    label: 'Appearance', 
    description: 'Theme, colors and visual preferences',
    color: '#8b5cf6',
    gradient: 'from-[#8b5cf6] to-[#a78bfa]',
    badge: 'New'
  },
  { 
    id: 'account', 
    icon: Shield, 
    label: 'Steam Account', 
    description: 'API key, login and privacy settings',
    color: '#3b82f6',
    gradient: 'from-[#3b82f6] to-[#60a5fa]'
  },
  { 
    id: 'idle', 
    icon: Clock, 
    label: 'Idling', 
    description: 'Game idling behaviour and automation',
    color: '#10b981',
    gradient: 'from-[#10b981] to-[#34d399]'
  },
  { 
    id: 'notifications', 
    icon: Bell, 
    label: 'Notifications', 
    description: 'Alerts, sounds and desktop notifications',
    color: '#f59e0b',
    gradient: 'from-[#f59e0b] to-[#fbbf24]'
  },
  { 
    id: 'advanced', 
    icon: Sliders, 
    label: 'Advanced', 
    description: 'System, startup and power user options',
    color: '#ec4899',
    gradient: 'from-[#ec4899] to-[#f472b6]'
  },
]

function SectionHeader({ section }: { section: Section }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div
          className={clsx(
            "w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br",
            section.gradient
          )}
        >
          <section.icon className="w-4 h-4 text-white" />
        </div>

      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{section.label}</p>
        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{section.description}</p>
      </div>
    </div>
  )
}

function SettingCard({ children, className = '', interactive = false, comingSoon = false }: { children: ReactNode; className?: string; interactive?: boolean; comingSoon?: boolean }) {
  return (
    <div 
      className={clsx(
        'relative rounded-2xl overflow-hidden transition-all duration-300',
        interactive && 'hover:shadow-xl hover:shadow-[var(--accent)]/5 hover:scale-[1.02]',
        className
      )}
      style={{ 
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
      }}
    >
      {comingSoon && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-[2px]" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg tracking-wide">
            Coming Soon
          </span>
        </div>
      )}
      {children}
    </div>
  )
}

function SettingItem({ 
  icon: Icon,
  label,
  description,
  children,
  disabled = false,
  badge,
  onClick,
  className = '',
  highlight = false,
  comingSoon = false,
}: { 
  icon?: LucideIcon
  label: string
  description?: string
  children?: ReactNode
  disabled?: boolean
  badge?: ReactNode
  onClick?: () => void
  className?: string
  highlight?: boolean
  comingSoon?: boolean
}) {
  return (
    <div 
      className={clsx(
        'flex items-center gap-4 px-6 py-5 transition-all duration-300 relative',
        !disabled && onClick && 'cursor-pointer hover:bg-[var(--hover-overlay)]',
        disabled && 'opacity-50 pointer-events-none',
        highlight && 'bg-gradient-to-r from-[var(--accent)]/5 to-transparent',
        className
      )}
      onClick={onClick}
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {comingSoon && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
            Coming Soon
          </span>
        </div>
      )}
      
      {Icon && (
        <div className={clsx(
          "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all",
          "group-hover:scale-110"
        )}
          style={{ background: 'rgba(59,130,246,0.1)' }}>
          <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        {description && (
          <p className="text-sm leading-relaxed flex items-center gap-1" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        )}
      </div>
      
      {children && (
        <div className="shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}

function Toggle({ value, onChange, size = 'md', disabled = false }: { value: boolean; onChange: () => void; size?: 'sm' | 'md'; disabled?: boolean }) {
  const dimensions = size === 'sm' ? { width: 40, height: 22, knob: 16, translate: 20 } : { width: 52, height: 28, knob: 22, translate: 26 }
  
  return (
    <button 
      onClick={onChange} 
      disabled={disabled}
      className={clsx(
        'relative rounded-full transition-all duration-300',
        'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]',
        value ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accenthov)]' : 'bg-[var(--border)]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      style={{ width: dimensions.width, height: dimensions.height }}
      role="switch"
      aria-checked={value}
    >
      <span 
        className={clsx(
          "absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-300",
          "shadow-lg"
        )}
        style={{ 
          left: value ? dimensions.width - dimensions.knob - 3 : 3,
          width: dimensions.knob,
          height: dimensions.knob,
        }}
      />
    </button>
  )
}

function StatusBadge({ status, label, pulse = false }: { status: 'success' | 'warning' | 'error' | 'info'; label: string; pulse?: boolean }) {
  const config = {
    success: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.3)', icon: CheckCircle2 },
    warning: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: 'rgba(234,179,8,0.3)', icon: AlertCircle },
    error: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)', icon: AlertCircle },
    info: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)', icon: Info },
  }
  
  const { bg, text, border, icon: Icon } = config[status]
  
  return (
    <span 
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
        pulse && 'animate-pulse'
      )}
      style={{ background: bg, color: text, border: `1px solid ${border}` }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

function Input({ icon: Icon, ...props }: { icon?: LucideIcon } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Icon className="w-4 h-4" style={{ color: 'var(--muted)' }} />
        </div>
      )}
      <input
        {...props}
        className={clsx(
          'w-full px-4 py-3 rounded-xl text-sm transition-all',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50',
          'placeholder:text-[var(--muted)]/50',
          Icon && 'pl-10',
          props.className
        )}
        style={{ 
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      />
    </div>
  )
}

function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  ...props 
}: { 
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  className?: string
  icon?: LucideIcon
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  }
  
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'linear-gradient(135deg, var(--accent), var(--accenthov))',
          color: 'white',
        }
      case 'success':
        return {
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          color: 'white',
        }
      case 'secondary':
        return {
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
        }
      case 'danger':
        return {
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: 'white',
        }
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--muted)',
        }
    }
  }
  
  const style = getButtonStyle()
  
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-300',
        'disabled:opacity-50 disabled:pointer-events-none',
        'hover:shadow-lg hover:scale-105 active:scale-95',
        variant !== 'ghost' && 'hover:opacity-90',
        variant === 'ghost' && 'hover:bg-[var(--hover-overlay)]',
        sizeClasses[size],
        className
      )}
      style={style}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {Icon && !loading && <Icon className={clsx('w-4 h-4', size === 'lg' && 'w-5 h-5')} />}
      {children}
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, updateSettings } = useAppContext()
  const [activeSection, setActiveSection] = useState<SectionId>('appearance')
  const [apiKey, setApiKey] = useState(settings.steamApiKey ?? '')
  const [autostart, setAutostart] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hoveredSection, setHoveredSection] = useState<SectionId | null>(null)
  const [accountInfo, setAccountInfo] = useState<SteamAccountStatusInfo>({ 
    status: 'disconnected', 
    username: null 
  })
  const [accountLoading, setAccountLoading] = useState(false)
  const [authMethod, setAuthMethod] = useState<'qr' | 'cookie'>('qr')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'waiting' | 'scanned' | 'success' | 'timeout' | 'error'>('idle')
  const [qrError, setQrError] = useState<string | null>(null)
  const [cookieValue, setCookieValue] = useState('')
  const [showCookie, setShowCookie] = useState(false)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [idleStats, setIdleStats] = useState<import('@shared/types').IdleStats | null>(null)
  
  const unsubAccountRef = useRef<(() => void) | null>(null)
  const unsubQrRef = useRef<(() => void) | null>(null)

  useEffect(() => { 
    setApiKey(settings.steamApiKey ?? '') 
  }, [settings.steamApiKey])

  useEffect(() => {
    if (!settings.steamId) {
      window.steam.getUserInfo().then(res => {
        if (res.success && res.data?.steamId) 
          updateSettings({ steamId: res.data.steamId }).catch(() => {})
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    window.steam.getAutostart().then(res => {
      if (res.success) setAutostart(res.data ?? false)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    window.steam.getIdleStats().then(res => {
      if (res.success && res.data) setIdleStats(res.data)
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
    
    return () => { 
      unsubAccountRef.current?.(); 
      unsubQrRef.current?.() 
    }
  }, [])

  const save = async (partial: Partial<AppSettings>) => {
    setIsSaving(true)
    try { 
      await updateSettings(partial)
      toast.success('Settings saved successfully!', { 
        icon: '✨',
        style: { 
          background: 'var(--card)', 
          color: 'var(--text)',
          border: '1px solid var(--border)'
        }
      })
    } catch { 
      toast.error('Failed to save settings', {
        icon: '❌',
        style: { 
          background: 'var(--card)', 
          color: 'var(--text)',
          border: '1px solid var(--border)'
        }
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleAutostart = async () => {
    const next = !autostart
    try {
      const res = await window.steam.setAutostart(next)
      if (res.success) { 
        setAutostart(next)
        toast.success(next ? 'Auto-start enabled' : 'Auto-start disabled', {
          icon: next ? '🚀' : '💤'
        })
      } else toast.error('Failed to update startup setting')
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
      if (res.success) { 
        toast.success('Account connected successfully!', { icon: '🔗' })
        setCookieValue('') 
      } else toast.error(res.error ?? 'Login failed')
    } catch { toast.error('Login failed') }
    finally { setAccountLoading(false) }
  }

  const disconnectSteamAccount = async () => {
    setAccountLoading(true); cancelQr()
    try { 
      await window.steam.steamAccountLogout()
      toast.success('Account disconnected', { icon: '👋' })
    } catch { toast.error('Logout failed') }
    finally { setAccountLoading(false) }
  }

  const renderAppearance = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <SettingCard interactive>
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                  Theme Preferences
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Choose your preferred color scheme</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'dark', icon: Moon, label: 'Dark Mode', preview: '#09090b', desc: 'Easy on the eyes' },
                { value: 'light', icon: Sun, label: 'Light Mode', preview: '#f1f5f9', desc: 'Clean and bright' },
                { value: 'system', icon: Monitor, label: 'System', preview: 'linear-gradient(135deg, #09090b 50%, #f1f5f9 50%)', desc: 'Follows your system' },
              ].map(({ value, icon: Icon, label, preview, desc }) => {
                const active = settings.theme === value
                return (
                  <button
                    key={value}
                    onClick={() => { save({ theme: value as Theme }); applyTheme(value as Theme) }}
                    className={clsx(
                      'relative group flex flex-col items-center p-6 rounded-xl transition-all duration-300',
                      'border-2 hover:scale-105 hover:shadow-xl',
                      active ? 'border-[var(--accent)]' : 'border-transparent hover:border-[var(--border)]'
                    )}
                    style={{ background: 'var(--surface)' }}
                  >
                    {/* Preview strip */}
                    <div 
                      className="w-full h-20 rounded-lg mb-4 overflow-hidden"
                      style={{ 
                        background: preview,
                        border: '1px solid var(--border)'
                      }}
                    />
                    
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                         style={{ background: active ? 'var(--accent)' : 'var(--border)' }}>
                      <Icon className={clsx("w-5 h-5", active ? 'text-white' : 'text-[var(--muted)]')} />
                    </div>
                    
                    <span className="text-sm font-semibold mb-1" style={{ color: active ? 'var(--accent)' : 'var(--text)' }}>
                      {label}
                    </span>
                    
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {desc}
                    </span>
                    
                    {active && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg animate-in zoom-in">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </SettingCard>
      </div>
    )
  }

  const renderAccount = () => {
    const apiKeySet = !!settings.steamApiKey
    const isConnected = accountInfo.status === 'connected'

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        <SettingCard>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                  <Key className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Steam API Key</h3>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Required for Steam features</p>
                </div>
              </div>
              <StatusBadge status={apiKeySet ? 'success' : 'warning'} label={apiKeySet ? 'Configured' : 'Required'} pulse={!apiKeySet} />
            </div>

            <div className="space-y-3">
              {!apiKeySet && (
                <p className="text-xs flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                  <Info className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  Get your key from the{' '}
                  <a
                    href="https://steamcommunity.com/dev/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline inline-flex items-center gap-0.5 font-medium"
                  >
                    Steam Developer portal
                    <ChevronRight className="w-3 h-3" />
                  </a>
                </p>
              )}

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type={apiKeyVisible ? 'text' : 'password'}
                    placeholder="Enter your API key"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && apiKey.trim() && save({ steamApiKey: apiKey })}
                    icon={Key}
                  />
                  <button
                    onClick={() => setApiKeyVisible(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted)' }}
                  >
                    {apiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!apiKey.trim() || isSaving}
                  loading={isSaving}
                  onClick={() => save({ steamApiKey: apiKey })}
                  icon={CheckCircle2}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </SettingCard>

        <SettingCard>
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 flex items-center justify-center">
                  <Shield className="w-6 h-6" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Account Connection</h3>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Link your Steam account</p>
                </div>
              </div>
              {accountInfo.status === 'connected' ? (
                <StatusBadge status="success" label={accountInfo.username ?? 'Connected'} pulse />
              ) : accountInfo.status === 'connecting' ? (
                <StatusBadge status="warning" label="Connecting..." pulse />
              ) : (
                <StatusBadge status="info" label="Not connected" />
              )}
            </div>

            {isConnected ? (
              <div className="flex items-center justify-between p-6 rounded-xl bg-gradient-to-r from-[var(--accent)]/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/50 flex items-center justify-center">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--green)] border-4" style={{ borderColor: 'var(--card)' }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{accountInfo.username}</p>
                    <p className="text-sm flex items-center gap-2 mt-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
                      <span style={{ color: 'var(--green)' }}>Online</span>
                      <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border)' }} />
                      <span style={{ color: 'var(--muted)' }}>Steam Guard Active</span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={disconnectSteamAccount}
                  disabled={accountLoading}
                  icon={LogOut}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-1.5 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
                  {[
                    { id: 'qr', icon: QrCode, label: 'QR Code', desc: 'Scan with phone', color: '#3b82f6' },
                    { id: 'cookie', icon: Cookie, label: 'Session Cookie', desc: 'Browser login', color: '#8b5cf6' },
                  ].map(({ id, icon: Icon, label, desc, color }) => (
                    <button
                      key={id}
                      onClick={() => { setAuthMethod(id as 'qr' | 'cookie'); cancelQr() }}
                      className={clsx(
                        'flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-300',
                        authMethod === id && 'bg-[var(--card)] shadow-md'
                      )}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
                        style={{ background: authMethod === id ? `${color}20` : 'transparent' }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: authMethod === id ? color : 'var(--muted)' }} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium" style={{ color: authMethod === id ? color : 'var(--text)' }}>{label}</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {authMethod === 'qr' && (
                  <div className="p-6 rounded-xl" style={{ background: 'var(--surface)' }}>
                    {qrStatus === 'idle' && (
                      <button
                        onClick={startQr}
                        className="w-full py-10 flex flex-col items-center gap-4 rounded-xl border-2 border-dashed transition-all duration-300 hover:border-[var(--accent)] group"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="p-4 rounded-xl bg-[var(--accent)]/5 group-hover:bg-[var(--accent)]/10 transition-all group-hover:scale-110">
                          <QrCode className="w-12 h-12" style={{ color: 'var(--accent)' }} />
                        </div>
                        <div className="text-center">
                          <span className="text-base font-semibold block" style={{ color: 'var(--text)' }}>Generate QR Code</span>
                          <span className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Scan with Steam mobile app</span>
                        </div>
                      </button>
                    )}

                    {qrStatus === 'loading' && (
                      <div className="py-12 flex flex-col items-center gap-4">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 animate-spin" style={{ color: 'var(--accent)' }} />
                          <div className="absolute inset-0 animate-ping opacity-20">
                            <QrCode className="w-12 h-12" style={{ color: 'var(--accent)' }} />
                          </div>
                        </div>
                        <span className="text-sm" style={{ color: 'var(--muted)' }}>Generating QR code...</span>
                      </div>
                    )}

                    {(qrStatus === 'waiting' || qrStatus === 'scanned') && qrDataUrl && (
                      <div className="space-y-6">
                        <div className="flex justify-center p-6 bg-white rounded-2xl shadow-xl">
                          <img src={qrDataUrl} alt="Steam QR code" className="w-48 h-48" />
                        </div>
                        <div className="text-center">
                          <p className="text-base font-semibold mb-2 flex items-center justify-center gap-2" style={{ 
                            color: qrStatus === 'scanned' ? 'var(--green)' : 'var(--text)' 
                          }}>
                            {qrStatus === 'scanned' ? (
                              <>
                                <CheckCircle2 className="w-5 h-5" />
                                QR Code scanned!
                              </>
                            ) : (
                              'Scan with Steam app'
                            )}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--muted)' }}>
                            {qrStatus === 'scanned' 
                              ? 'Approve the login request on your phone'
                              : 'Open Steam → Steam Guard → Scan QR Code'}
                          </p>
                        </div>
                        <button
                          onClick={cancelQr}
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-[var(--hover-overlay)] active:scale-95"
                          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    )}

                    {(qrStatus === 'timeout' || qrStatus === 'error') && (
                      <div className="py-6 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                          <AlertCircle className="w-6 h-6" style={{ color: 'var(--red)' }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            {qrStatus === 'timeout' ? 'QR code expired' : 'Connection failed'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {qrError || 'Please try again'}
                          </p>
                        </div>
                        <Button variant="primary" size="sm" onClick={startQr} icon={RefreshCw}>
                          Try Again
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {authMethod === 'cookie' && (
                  <div className="p-6 rounded-xl space-y-6" style={{ background: 'var(--surface)' }}>
                    <div className="p-4 rounded-lg bg-gradient-to-r from-[var(--accent)]/5 to-transparent">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                        <Info className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                        How to get your session cookie
                      </h4>
                      <ol className="text-sm space-y-2" style={{ color: 'var(--muted)' }}>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-xs shrink-0">1</span>
                          Go to store.steampowered.com and login
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-xs shrink-0">2</span>
                          Open DevTools (F12) → Application → Cookies
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-xs shrink-0">3</span>
                          Copy the value of "steamLoginSecure"
                        </li>
                      </ol>
                    </div>

                    <div className="relative">
                      <Input
                        type={showCookie ? 'text' : 'password'}
                        placeholder="Paste steamLoginSecure value"
                        value={cookieValue}
                        onChange={e => setCookieValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && connectWithCookie()}
                        icon={Cookie}
                      />
                      <button
                        onClick={() => setShowCookie(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--muted)' }}
                      >
                        {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={connectWithCookie}
                      disabled={accountLoading || !cookieValue.trim()}
                      loading={accountLoading}
                      icon={LogIn}
                    >
                      Connect Account
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </SettingCard>
      </div>
    )
  }

  const renderIdle = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <SettingCard>
          <SettingItem
            icon={Eye}
            label="Auto-invisible when idling"
            description="Automatically switch to invisible mode when idling starts"
            highlight={settings.autoInvisibleWhenIdling}
            disabled={accountInfo.status !== 'connected'}
          >
            <Toggle
              value={settings.autoInvisibleWhenIdling}
              onChange={() => save({ autoInvisibleWhenIdling: !settings.autoInvisibleWhenIdling })}
              disabled={accountInfo.status !== 'connected'}
            />
          </SettingItem>

          <SettingItem
            icon={Gamepad2}
            label="Stop on game launch"
            description="Pause idling when you launch any game"
            highlight={settings.stopIdleOnGameLaunch}
          >
            <Toggle
              value={settings.stopIdleOnGameLaunch}
              onChange={() => save({ stopIdleOnGameLaunch: !settings.stopIdleOnGameLaunch })}
            />
          </SettingItem>

          <SettingItem
            icon={Gamepad2}
            label="Resume after game"
            description="Automatically resume idling when your game closes"
            highlight={settings.resumeIdleAfterGame}
            disabled={!settings.stopIdleOnGameLaunch}
            className="border-b-0"
          >
            <Toggle
              value={settings.resumeIdleAfterGame}
              onChange={() => save({ resumeIdleAfterGame: !settings.resumeIdleAfterGame })}
              disabled={!settings.stopIdleOnGameLaunch}
            />
          </SettingItem>
        </SettingCard>

        <SettingCard>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Idling Statistics</h3>
              </div>
            </div>
            {idleStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Games today', value: idleStats.todayGamesIdled },
                    { label: 'All-time games', value: idleStats.totalGamesIdled },
                    { label: 'Hours today', value: (idleStats.todaySecondsIdled / 3600).toFixed(1) },
                    { label: 'Total hours', value: (idleStats.totalSecondsIdled / 3600).toFixed(1) },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-xl" style={{ background: 'var(--surface)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
              </div>
            )}
          </div>
        </SettingCard>
      </div>
    )
  }

  const renderNotifications = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <SettingCard>
          <SettingItem
            icon={Bell}
            label="Desktop notifications"
            description="Show alerts for idle events and achievements"
            highlight={settings.notificationsEnabled}
          >
            <Toggle 
              value={settings.notificationsEnabled} 
              onChange={() => save({ notificationsEnabled: !settings.notificationsEnabled })} 
            />
          </SettingItem>

          <SettingItem
            icon={Volume2}
            label="Notification sound"
            description="Play a sound with notifications"
            disabled={!settings.notificationsEnabled}
            highlight={settings.notificationSound}
            className="border-b-0"
          >
            <Toggle 
              value={settings.notificationSound} 
              onChange={() => save({ notificationSound: !settings.notificationSound })} 
              disabled={!settings.notificationsEnabled}
            />
          </SettingItem>
        </SettingCard>


      </div>
    )
  }

  const renderAdvanced = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <SettingCard>
          <SettingItem
            icon={Power}
            label="Launch at startup"
            description="Start automatically when you log into Windows"
            badge={<span className="text-[10px] px-2 py-1 rounded-full bg-gradient-to-r from-[var(--accent)]/20 to-[var(--accent)]/5 text-[var(--accent)] font-medium">System</span>}
          >
            <Toggle value={autostart} onChange={toggleAutostart} />
          </SettingItem>

          <SettingItem
            icon={Laptop}
            label="Minimize to tray"
            description="Keep running in the background when closed"
          >
            <Toggle 
              value={settings.minimizeToTray} 
              onChange={() => save({ minimizeToTray: !settings.minimizeToTray })} 
            />
          </SettingItem>

          <SettingItem
            icon={Eye}
            label="Show hidden achievements"
            description="Reveal hidden achievements before unlocking them"
          >
            <Toggle 
              value={settings.showHiddenAchievements} 
              onChange={() => save({ showHiddenAchievements: !settings.showHiddenAchievements })} 
            />
          </SettingItem>

          <SettingItem
            icon={Globe}
            label="Global completion percentage"
            description="Show worldwide unlock statistics for achievements"
          >
            <Toggle 
              value={settings.showGlobalPercent} 
              onChange={() => save({ showGlobalPercent: !settings.showGlobalPercent })} 
            />
          </SettingItem>

          <SettingItem
            icon={HelpCircle}
            label="Confirm bulk actions"
            description="Ask for confirmation before modifying multiple achievements"
            className="border-b-0"
          >
            <Toggle 
              value={settings.confirmBulkActions} 
              onChange={() => save({ confirmBulkActions: !settings.confirmBulkActions })} 
            />
          </SettingItem>
        </SettingCard>

        <div className="flex items-center justify-between px-6 py-4 rounded-xl bg-gradient-to-r from-[var(--accent)]/5 to-transparent">
          <div className="flex items-center gap-6">
            <button
              onClick={() => window.open('https://github.com/thomasthanos/steam-idler#readme', '_blank')}
              className="text-sm hover:underline flex items-center gap-1 transition-colors hover:text-[var(--accent)] cursor-pointer"
              style={{ color: 'var(--muted)', background: 'none', border: 'none', padding: 0 }}
            >
              <HelpCircle className="w-4 h-4" />
              Documentation
            </button>
          </div>
          <span className="text-sm flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            <Settings2 className="w-4 h-4" />
            v{__APP_VERSION__}
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            <span className="text-[var(--green)]">Stable</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden relative" style={{ background: 'var(--bg)' }}>
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 right-4 z-50 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        title="Close settings"
      >
        <X className="w-4 h-4" />
      </button>
      <aside 
        className="w-64 shrink-0 flex flex-col border-r overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="px-5 py-5 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/70 flex items-center justify-center shrink-0 shadow-sm">
            <Settings2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Settings</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Customize your app</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {SECTIONS.map((section) => {
            const active = activeSection === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                onMouseEnter={() => setHoveredSection(section.id)}
                onMouseLeave={() => setHoveredSection(null)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left relative',
                  active ? 'bg-[var(--hover-overlay)]' : 'hover:bg-[var(--hover-overlay)]/60'
                )}
                style={active ? { background: `linear-gradient(135deg, ${section.color}15, transparent)` } : undefined}
              >
                {active && (
                  <div className="absolute left-0 w-0.5 h-6 rounded-r-full" style={{ background: section.color }} />
                )}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{
                    background: active ? `${section.color}20` : 'var(--border)',
                    boxShadow: hoveredSection === section.id && !active ? `0 0 12px ${section.color}30` : 'none',
                  }}
                >
                  <section.icon
                    className={clsx('w-4 h-4 transition-transform duration-200', hoveredSection === section.id && !active && 'scale-110')}
                    style={{ color: active ? section.color : hoveredSection === section.id ? section.color : 'var(--muted)' }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>
                    {section.label}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>
                    {section.description}
                  </p>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--green)] shrink-0" />
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>All systems operational</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 py-5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          {activeSection === 'appearance' && <SectionHeader section={SECTIONS.find(s => s.id === 'appearance')!} />}
          {activeSection === 'account' && <SectionHeader section={SECTIONS.find(s => s.id === 'account')!} />}
          {activeSection === 'idle' && <SectionHeader section={SECTIONS.find(s => s.id === 'idle')!} />}
          {activeSection === 'notifications' && <SectionHeader section={SECTIONS.find(s => s.id === 'notifications')!} />}
          {activeSection === 'advanced' && <SectionHeader section={SECTIONS.find(s => s.id === 'advanced')!} />}
        </div>
        <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-8">
          {activeSection === 'appearance' && renderAppearance()}
          {activeSection === 'account' && renderAccount()}
          {activeSection === 'idle' && renderIdle()}
          {activeSection === 'notifications' && renderNotifications()}
          {activeSection === 'advanced' && renderAdvanced()}
        </div>
        </div>
      </main>
    </div>
  )
}