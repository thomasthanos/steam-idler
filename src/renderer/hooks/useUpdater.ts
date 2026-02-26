import { useState, useEffect, useCallback } from 'react'
import { UpdaterState } from '@shared/types'

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({ status: 'idle' })

  useEffect(() => {
    const unsub = window.steam.onUpdaterStatus((s) => setState(s))
    return unsub
  }, [])

  const check = useCallback(async () => {
    setState({ status: 'checking' })
    await window.steam.checkForUpdates()
  }, [])

  const install = useCallback(async () => {
    await window.steam.installUpdate()
  }, [])

  return { state, check, install }
}
