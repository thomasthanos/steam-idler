import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { useUpdater } from '../hooks/useUpdater'
import { useState, useEffect } from 'react'

export default function UpdateBanner() {
  const { state } = useUpdater()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (state.status !== 'downloaded') { setCountdown(3); return }
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [state.status])

  // Only show when the user needs to act or know something.
  // 'checking' and 'downloading' happen silently in the background — no banner.
  const visible =
    state.status === 'downloaded' ||
    state.status === 'error'

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        key="update-banner"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="overflow-hidden shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="px-4 py-2 flex items-center gap-3"
          style={{
            background:
              state.status === 'error'
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(34,197,94,0.08)',
          }}
        >
          {/* Icon */}
          {state.status === 'downloaded' && (
            <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--green)' }} />
          )}
          {state.status === 'error' && (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--red)' }} />
          )}

          {/* Text */}
          <div className="flex-1 min-w-0">
            {state.status === 'downloaded' && (
              <p className="text-xs" style={{ color: 'var(--text)' }}>
                <span className="font-semibold" style={{ color: 'var(--green)' }}>
                  v{state.version} ready
                </span>
                <span style={{ color: 'var(--muted)' }}> — restarting in {countdown}s…</span>
              </p>
            )}
            {state.status === 'error' && (
              <p className="text-xs truncate" style={{ color: 'var(--red)' }}>
                Update error: {state.message}
              </p>
            )}
          </div>

          {/* Restart now button */}
          {state.status === 'downloaded' && (
            <button
              onClick={() => window.steam.restartAndInstall()}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg transition-all"
              style={{ background: 'var(--green)', color: '#fff' }}
            >
              <RefreshCw className="w-3 h-3" />
              Restart now
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
