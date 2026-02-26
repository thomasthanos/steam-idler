import { useState, useEffect, useCallback } from 'react'
import { UpdaterState } from '@shared/types'

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({ status: 'idle' })

  useEffect(() => {
    const unsub = window.steam.onUpdaterStatus((s) => setState(s))
    return unsub
  }, [])

  // Manually trigger an update check from the UI (e.g. Settings page button).
  // The actual download + restart are fully automatic once an update is found.
  const check = useCallback(async () => {
    setState({ status: 'checking' })
    await window.steam.checkForUpdates()
  }, [])

  return { state, check }
}
