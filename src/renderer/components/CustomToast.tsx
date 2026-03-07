import React from 'react'
import { Toast, toast } from 'react-hot-toast'
import { X, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'

type ToastVariant = 'warning' | 'error' | 'success' | 'info'

interface CustomToastProps {
  t: Toast
  title: string
  message: string
  variant: ToastVariant
}

interface VariantConfig {
  icon: (props: { color: string }) => React.ReactNode
  accent: string
  iconBg: string
  borderTop: string
  borderLeft: string
  borderBottom: string
  borderRight: string
}

const variantConfig: Record<ToastVariant, VariantConfig> = {
  warning: {
    icon: ({ color }) => <AlertTriangle style={{ width: 18, height: 18, color }} />,
    accent: '#f59e0b',
    iconBg: '#4a3a1a',
    borderTop: '#fbbf24',
    borderLeft: '#fbbf24',
    borderBottom: '#b45309',
    borderRight: '#b45309',
  },
  error: {
    icon: ({ color }) => <XCircle style={{ width: 18, height: 18, color }} />,
    accent: '#ef4444',
    iconBg: '#4a2424',
    borderTop: '#f87171',
    borderLeft: '#f87171',
    borderBottom: '#b91c1c',
    borderRight: '#b91c1c',
  },
  success: {
    icon: ({ color }) => <CheckCircle style={{ width: 18, height: 18, color }} />,
    accent: '#10b981',
    iconBg: '#1a4730',
    borderTop: '#34d399',
    borderLeft: '#34d399',
    borderBottom: '#047857',
    borderRight: '#047857',
  },
  info: {
    icon: ({ color }) => <Info style={{ width: 18, height: 18, color }} />,
    accent: '#3b82f6',
    iconBg: '#2a3a5a',
    borderTop: '#60a5fa',
    borderLeft: '#60a5fa',
    borderBottom: '#1d4ed8',
    borderRight: '#1d4ed8',
  },
}

export function CustomToast({ t, title, message, variant }: CustomToastProps) {
  const cfg = variantConfig[variant]

  // CSS variables for theme colors
  const cardBg = '#1e1e26'
  const textColor = '#ffffff'
  const subColor = 'rgba(255, 255, 255, 0.7)'
  const mutedColor = 'rgba(255, 255, 255, 0.4)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        background: cardBg,
        border: '2px solid',
        borderTopColor: '#3a3a48',
        borderLeftColor: '#3a3a48',
        borderBottomColor: '#15151c',
        borderRightColor: '#15151c',
        borderRadius: '16px',
        padding: '12px 14px',
        minWidth: '300px',
        maxWidth: '380px',
        fontFamily: "-apple-system, 'BlinkMacSystemFont', 'Segoe UI', Roboto, system-ui, sans-serif",
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}
    >
      {/* Icon with 3D border */}
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          background: cfg.iconBg,
          border: '2px solid',
          borderTopColor: cfg.borderTop,
          borderLeftColor: cfg.borderLeft,
          borderBottomColor: cfg.borderBottom,
          borderRightColor: cfg.borderRight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: cfg.accent,
          flexShrink: 0,
        }}
      >
        <cfg.icon color={cfg.accent} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: textColor,
            marginBottom: '4px',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: subColor,
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      </div>

      {/* Close button with 3D effect */}
      <button
        onClick={() => toast.dismiss(t.id)}
        style={{
          background: cardBg,
          border: '2px solid',
          borderTopColor: '#3a3a48',
          borderLeftColor: '#3a3a48',
          borderBottomColor: '#15151c',
          borderRightColor: '#15151c',
          borderRadius: '10px',
          cursor: 'pointer',
          color: mutedColor,
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.1s ease',
          marginTop: '2px',
          width: '32px',
          height: '32px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderTopColor = '#4a4a5a'
          e.currentTarget.style.borderLeftColor = '#4a4a5a'
          e.currentTarget.style.borderBottomColor = '#252530'
          e.currentTarget.style.borderRightColor = '#252530'
          e.currentTarget.style.color = textColor
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderTopColor = '#3a3a48'
          e.currentTarget.style.borderLeftColor = '#3a3a48'
          e.currentTarget.style.borderBottomColor = '#15151c'
          e.currentTarget.style.borderRightColor = '#15151c'
          e.currentTarget.style.color = mutedColor
        }}
        onMouseDown={e => {
          e.currentTarget.style.borderTopColor = '#15151c'
          e.currentTarget.style.borderLeftColor = '#15151c'
          e.currentTarget.style.borderBottomColor = '#3a3a48'
          e.currentTarget.style.borderRightColor = '#3a3a48'
          e.currentTarget.style.transform = 'translateY(1px)'
        }}
        onMouseUp={e => {
          e.currentTarget.style.borderTopColor = '#4a4a5a'
          e.currentTarget.style.borderLeftColor = '#4a4a5a'
          e.currentTarget.style.borderBottomColor = '#252530'
          e.currentTarget.style.borderRightColor = '#252530'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <X style={{ width: '12px', height: '12px' }} />
      </button>
    </div>
  )
}

// ── Helper functions για εύκολη χρήση παντού ──────────────────────────────

export function showToast(
  variant: ToastVariant, 
  title: string, 
  message: string, 
  duration = 5000
) {
  return toast.custom(
    (t) => <CustomToast t={t} title={title} message={message} variant={variant} />,
    { duration }
  )
}

export const notify = {
  warning: (title: string, message: string, duration?: number) =>
    showToast('warning', title, message, duration),
  error: (title: string, message: string, duration?: number) =>
    showToast('error', title, message, duration),
  success: (title: string, message: string, duration?: number) =>
    showToast('success', title, message, duration),
  info: (title: string, message: string, duration?: number) =>
    showToast('info', title, message, duration),
}