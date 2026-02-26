import { motion, AnimatePresence } from 'framer-motion'
import { Download, RefreshCw, CheckCircle, AlertTriangle, Loader } from 'lucide-react'
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

  // Only show when there's something actionable
  const visible =
    state.status === 'available' ||
    state.status === 'downloading' ||
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
        <div className="px-4 py-2 flex items-center gap-3"
          style={{
            background: state.status === 'error'
              ? 'rgba(239,68,68,0.08)'
              : state.status === 'downloaded'
                ? 'rgba(34,197,94,0.08)'
                : 'rgba(59,130,246,0.08)',
          }}
        >
          {/* Icon */}
          {state.status === 'available' && (
            <Download className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
          )}
          {state.status === 'downloading' && (
            <Loader className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ color: 'var(--accent)' }} />
          )}
          {state.status === 'downloaded' && (
            <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--green)' }} />
          )}
          {state.status === 'error' && (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--red)' }} />
          )}

          {/* Text */}
          <div className="flex-1 min-w-0">
            {state.status === 'available' && (
              <p className="text-xs" style={{ color: 'var(--text)' }}>
                <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                  v{state.version} is available
                </span>
                <span style={{ color: 'var(--muted)' }}> — download and install?</span>
              </p>
            )}
            {state.status === 'downloading' && (
              <div className="flex items-center gap-2">
                <p className="text-xs" style={{ color: 'var(--text)' }}>
                  <span className="font-semibold">Downloading v{state.version}</span>
                  <span style={{ color: 'var(--muted)' }}> — {state.percent}%</span>
                </p>
                {/* Progress bar */}
                <div className="flex-1 max-w-[120px] h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <motion.div
                    animate={{ width: `${state.percent}%` }}
                    transition={{ duration: 0.3 }}
                    className="h-full rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                </div>
              </div>
            )}
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


        </div>
      </motion.div>
    </AnimatePresence>
  )
}
