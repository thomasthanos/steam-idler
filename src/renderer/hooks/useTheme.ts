import { useEffect } from 'react'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

// Fix #5 – key used by both this module and the inline script in index.html
// to sync the theme preference without a flash-of-wrong-theme on first paint.
export const THEME_STORAGE_KEY = '__suv_theme'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  const resolved: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.classList.add(resolved)

  // Persist so the inline script in index.html can read it synchronously on
  // the next page load — eliminating the flash of unstyled content (FOUC).
  try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* ok */ }
}

// Called once at app startup — reads saved theme and applies it
export function useTheme() {
  useEffect(() => {
    window.steam.getSettings().then(res => {
      applyTheme(res.data?.theme ?? 'dark')
    }).catch(() => applyTheme('dark'))
  }, [])

  // Watch system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      window.steam.getSettings().then(res => {
        if (res.data?.theme === 'system') applyTheme('system')
      })
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
}
