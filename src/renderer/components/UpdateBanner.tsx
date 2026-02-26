import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { useUpdater } from '../hooks/useUpdater'

export default function UpdateBanner() {
  const { state } = useUpdater()

  const visible =
    state.status === 'available'   ||
    state.status === 'downloading' ||
    state.status === 'downloaded'  ||
    state.status === 'error'

  if (!visible) return null

  const isError      = state.status === 'error'
  const isDownloaded = state.status === 'downloaded'
  const isProgress   = state.status === 'available' || state.status === 'downloading'

  const bgColor = isError
    ? 'rgba(239,68,68,0.08)'
    : isDownloaded
    ? 'rgba(34,197,94,0.08)'
    : 'rgba(59,130,246,0.08)'

  const accentColor = isError ? 'var(--red)' : isDownloaded ? 'var(--green)' : '#3b82f6'

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
        <div className="px-4 py-2 flex flex-col gap-1" style={{ background: bgColor }}>
          <div className="flex items-center gap-3">
            {/* Icon */}
            {isError && (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
            )}
            {isDownloaded && (
              <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ color: accentColor }} />
            )}
            {isProgress && (
              <Download className="w-3.5 h-3.5 shrink-0 animate-pulse" style={{ color: accentColor }} />
            )}

            {/* Message */}
            <p className="text-xs flex-1 min-w-0" style={{ color: 'var(--text)' }}>
              {isError && (
                <span style={{ color: accentColor }}>Update error: {(state as any).message}</span>
              )}
              {isDownloaded && (
                <>
                  <span className="font-semibold" style={{ color: accentColor }}>
                    v{(state as any).version} ready
                  </span>
                  <span style={{ color: 'var(--muted)' }}> — restarting automatically…</span>
                </>
              )}
              {state.status === 'available' && (
                <>
                  <span className="font-semibold" style={{ color: accentColor }}>
                    New update found
                  </span>
                  <span style={{ color: 'var(--muted)' }}> — downloading v{(state as any).version}…</span>
                </>
              )}
              {state.status === 'downloading' && (
                <>
                  <span className="font-semibold" style={{ color: accentColor }}>
                    Downloading v{(state as any).version}
                  </span>
                  <span style={{ color: 'var(--muted)' }}> — {(state as any).percent ?? 0}%</span>
                </>
              )}
            </p>
          </div>

          {/* Progress bar */}
          {state.status === 'downloading' && (
            <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: accentColor }}
                animate={{ width: `${(state as any).percent ?? 0}%` }}
                transition={{ ease: 'linear', duration: 0.3 }}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
