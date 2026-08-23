import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { notify } from './components/CustomToast'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from './hooks/useTheme'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import UpdateBanner from './components/UpdateBanner'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'
import GamesPage from './pages/GamesPage'
import AchievementsPage from './pages/AchievementsPage'
import SettingsPage from './pages/SettingsPage'
import IdlePage from './pages/IdlePage'
import AutoIdlePage from './pages/AutoIdlePage'
import PortfolioPage from './pages/PortfolioPage'
import SetupScreen from './components/SetupScreen'
import { AppProvider, useAppContext } from './hooks/useAppContext'
import { useEffect } from 'react'


function AppShell() {
  useTheme()
  const { refreshUser, settings } = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()

  const isSettings = location.pathname === '/settings'

  // Global keyboard shortcut: Ctrl+R → refresh Steam connection, Escape → close settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        refreshUser()
      }
      if (e.key === 'Escape' && isSettings) {
        navigate(-1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [refreshUser, isSettings, navigate])

  // In-app toast notifications for idle warnings
  useEffect(() => {
    const cleanup = window.steam.onIdleWarning((data) => {
      if (data.type === 'game-already-running') {
        notify.warning(
          'Game Conflict Detected',
          `A Steam game is already running (AppID: ${data.appId}). Idling may conflict.`,
          6000
        )
      } else if (data.type === 'manual-game-detected') {
        notify.error(
          'Idling Stopped',
          `A Steam game was launched (AppID: ${data.appId}). All idling has been stopped.`,
          5000
        )
      } else if (data.type === 'auto-idle-resumed') {
        notify.success(
          'Auto-Idle Resumed',
          'Game closed. Auto-idle has been resumed.',
          4000
        )
      }
    })
    return cleanup
  }, [])

  const needsSetup = !settings.steamApiKey

  return (
    <div className="flex flex-col h-screen font-sans select-none overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <TitleBar />
      <UpdateBanner />

      {needsSetup ? (
        <SetupScreen />
      ) : (
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* Normal app shell */}
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-hidden relative" style={{ background: 'var(--bg)' }}>
              <ErrorBoundary label="page" key={location.pathname}>
                <Routes>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/games" element={<GamesPage />} />
                  <Route path="/achievements/:appId" element={<AchievementsPage />} />
                  <Route path="/idle" element={<IdlePage />} />
                  <Route path="/auto-idle" element={<AutoIdlePage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route path="/settings" element={null} />
                  {/* /settings is handled by the overlay below */}
                </Routes>
              </ErrorBoundary>
            </main>
          </div>

          {/* Settings full-screen overlay */}
          <AnimatePresence>
            {isSettings && (
              <motion.div
                key="settings-overlay"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-50"
                style={{ background: 'var(--bg)' }}
              >
                <SettingsPage />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <Toaster
        position="bottom-right"
        toastOptions={{
          custom: { style: { background: 'transparent', boxShadow: 'none', padding: 0 } },
        }}
        containerStyle={{ bottom: 16, right: 16 }}
      />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
