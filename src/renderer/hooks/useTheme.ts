import { useEffect } from 'react'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  const resolved: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.classList.add(resolved)
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
