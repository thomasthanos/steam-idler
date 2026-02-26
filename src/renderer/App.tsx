import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useTheme } from './hooks/useTheme'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import UpdateBanner from './components/UpdateBanner'
import HomePage from './pages/HomePage'
import GamesPage from './pages/GamesPage'
import AchievementsPage from './pages/AchievementsPage'
import SettingsPage from './pages/SettingsPage'
import IdlePage from './pages/IdlePage'
import AutoIdlePage from './pages/AutoIdlePage'
import { AppProvider, useAppContext } from './hooks/useAppContext'
import { useEffect } from 'react'

function AppShell() {
  useTheme()
  const { refreshUser } = useAppContext()

  // Global keyboard shortcut: Ctrl+R → refresh Steam connection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        refreshUser()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [refreshUser])

  return (
    <div className="flex flex-col h-screen font-sans select-none overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <TitleBar />
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative" style={{ background: 'var(--bg)' }}>
          <Routes>
            <Route path="/"                    element={<Navigate to="/home" replace />} />
            <Route path="/home"                element={<HomePage />} />
            <Route path="/games"               element={<GamesPage />} />
            <Route path="/achievements/:appId" element={<AchievementsPage />} />
            <Route path="/settings"            element={<SettingsPage />} />
            <Route path="/idle"                element={<IdlePage />} />
            <Route path="/auto-idle"           element={<AutoIdlePage />} />
          </Routes>
        </main>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--card)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontFamily: 'Outfit, system-ui, sans-serif',
            fontSize: '13px',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: 'var(--green)', secondary: 'var(--card)' } },
          error:   { iconTheme: { primary: 'var(--red)',   secondary: 'var(--card)' } },
        }}
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
