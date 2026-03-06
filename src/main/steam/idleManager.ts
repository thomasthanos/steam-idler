/**
 * idleManager.ts – manages "idling" worker processes.
 * Each game gets its own child process with SteamAppId set,
 * so Steam shows the game as "currently playing."
 *
 * Fix #1  – tree-kill ensures the entire process tree (not just the root pid)
 *           is terminated on stopIdle.  Without this, child processes spawned
 *           by the worker (native addons, etc.) could linger after proc.kill().
 * Fix #10 – IdleManager extends EventEmitter so the main window can subscribe
 *           to 'changed' events and update the tray icon immediately instead of
 *           waiting for the 5 s polling interval.
 *
 * NOTE: Auto-invisible via steam-user is intentionally disabled.
 * steam-user.setPlayingGame() opens a second CM session which conflicts with
 * the steamworks.js worker → Steam sends LoggedInElsewhere to the worker →
 * worker exits → idle stops. The worker already advertises the playing state
 * natively via sw.init(appId), so steam-user is not needed for idle.
 */

import { ChildProcess, spawn, execFile } from 'child_process'
import * as path from 'path'
import { EventEmitter } from 'events'
import treeKill from 'tree-kill'
import { SteamAccountManager } from './steamUser'
import { getStore, DEFAULT_IDLE_STATS } from '../store'

export class IdleManager extends EventEmitter {
  private idlers = new Map<number, ChildProcess>()
  private names  = new Map<number, string>()
  // Track start time per appId for session duration calculation
  private _startTimes = new Map<number, number>()
  // Track which appIds have been counted as "idled today" in the current session
  private _countedToday = new Set<number>()
  private steamAccountManager: SteamAccountManager | null = null
  // Timer for delayed status restore — gives Steam time to fully close
  // the game process before we change persona state back.
  private _restoreTimer: ReturnType<typeof setTimeout> | null = null
  private static readonly RESTORE_DELAY_MS = 3000
  // Pending worker spawns — games where we set invisible first and are
  // waiting for the delay before actually spawning the worker process.
  private _pendingSpawns = new Map<number, ReturnType<typeof setTimeout>>()
  private static readonly INVISIBLE_FIRST_DELAY_MS = 2500
  // Polling interval for detecting manual game launches via Windows registry.
  // Steam sets HKCU\Software\Valve\Steam\RunningAppID when a game is launched.
  private _gameDetectionInterval: ReturnType<typeof setInterval> | null = null
  private static readonly GAME_DETECTION_POLL_MS = 5000
  // Games that were already running when idle started — excluded from
  // manual launch detection so the polling doesn't immediately kill the idle.
  // Cleared when the game quits (RunningAppID → 0) or when all idle stops.
  private _knownRunningAtStart = new Set<number>()

  private get workerPath(): string {
    return path.join(__dirname, 'worker.js')
      .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
  }

  setSteamAccountManager(manager: SteamAccountManager): void {
    this.steamAccountManager = manager

    // When the steam account connects AFTER games are already idling
    // (e.g. auto-idle starts immediately at startup but the account
    // reconnect is delayed by 2 seconds), trigger setInvisible at that
    // point so auto-invisible actually works on startup.
    manager.on('status-changed', (info: { status: string }) => {
      if (info.status === 'connected' && this.idlers.size > 0) {
        const { autoInvisibleWhenIdling } = getStore().get('settings')
        if (autoInvisibleWhenIdling) {
          console.log('[idle] Steam account connected while idling — setting invisible now')
          manager.setInvisible()
        }
      }
    })

    // When the user launches a game manually from Steam, stop all idling
    // and restore status. The steam-user CM session fires 'game-launched'
    // (forwarded from the 'appLaunched' CM event) when any app starts.
    // If the appId is NOT one we're currently idling, it's a manual launch.
    // Only active when stopIdleOnGameLaunch is enabled.
    manager.on('game-launched', (appId: number) => {
      if (!getStore().get('settings').stopIdleOnGameLaunch) return
      if (this.idlers.size > 0 && !this.isIdling(appId)) {
        console.log(`[idle] Manual game launch detected (appId=${appId}) — stopping all idle`)
        this.stopAll()
      }
    })
  }

  startIdle(appId: number, name?: string): void {
    if (this.idlers.has(appId) || this._pendingSpawns.has(appId)) return
    if (name) this.names.set(appId, name)

    // Cancel any pending restore timer — we're starting a new idle session
    this._cancelRestoreTimer()

    const totalActive = this.idlers.size + this._pendingSpawns.size
    const shouldGoInvisible = totalActive === 0
      && this.steamAccountManager?.hasAccount
      && getStore().get('settings').autoInvisibleWhenIdling

    if (shouldGoInvisible) {
      // Set invisible FIRST, then wait for Steam to process the status
      // change before spawning the worker (which shows "In-Game").
      this.steamAccountManager!.setInvisible()
      console.log(`[idle] Set invisible — waiting ${IdleManager.INVISIBLE_FIRST_DELAY_MS}ms before spawning worker for appId=${appId}`)
      const timer = setTimeout(() => {
        this._pendingSpawns.delete(appId)
        this._spawnWorker(appId)
      }, IdleManager.INVISIBLE_FIRST_DELAY_MS)
      this._pendingSpawns.set(appId, timer)
    } else {
      this._spawnWorker(appId)
    }

    // Game detection + warnings only when stopIdleOnGameLaunch is enabled.
    // When disabled, idle runs "autonomously" without any of this.
    if (getStore().get('settings').stopIdleOnGameLaunch) {
      // Start polling for manual game launches (registry-based detection)
      this._startGameDetectionPolling()

      // One-time check: warn if a Steam game is already running
      this._warnIfGameRunning()
    }

    this.emit('changed')
  }

  // ─── Stats helpers ──────────────────────────────────────────────────────

  private _getTodayStr(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private _recordIdleStart(appId: number): void {
    this._startTimes.set(appId, Date.now())
    const store = getStore()
    const today = this._getTodayStr()
    const stats = { ...DEFAULT_IDLE_STATS, ...store.get('idleStats') }

    // Reset today's counters if it's a new day
    if (stats.lastResetDate !== today) {
      stats.todayGamesIdled = 0
      stats.todaySecondsIdled = 0
      stats.lastResetDate = today
      this._countedToday.clear()
    }

    // Count unique game for today + all-time
    if (!this._countedToday.has(appId)) {
      this._countedToday.add(appId)
      stats.todayGamesIdled += 1
      stats.totalGamesIdled += 1
    }

    store.set('idleStats', stats)
  }

  private _recordIdleStop(appId: number): void {
    const startTime = this._startTimes.get(appId)
    if (!startTime) return
    this._startTimes.delete(appId)

    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    if (elapsed <= 0) return

    const store = getStore()
    const today = this._getTodayStr()
    const stats = { ...DEFAULT_IDLE_STATS, ...store.get('idleStats') }

    // Reset today if new day
    if (stats.lastResetDate !== today) {
      stats.todaySecondsIdled = 0
      stats.todayGamesIdled = 0
      stats.lastResetDate = today
    }

    stats.totalSecondsIdled += elapsed
    stats.todaySecondsIdled += elapsed
    store.set('idleStats', stats)
  }

  /** Spawn the actual child process worker for an appId. */
  private _spawnWorker(appId: number): void {
    // Guard: stopIdle may have been called while waiting for the delay
    if (this.idlers.has(appId)) return

    const proc = spawn(process.execPath, [this.workerPath], {
      env: {
        ...process.env,
        SteamAppId: String(appId),
        ELECTRON_RUN_AS_NODE: '1',
        ELECTRON_NO_ASAR: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    })

    proc.stderr?.setEncoding('utf8')
    proc.stderr?.on('data', (chunk: string) => {
      console.error(`[idle:${appId}] ${chunk.trim()}`)
    })
    proc.stdout?.resume()
    proc.stdin?.on('error', () => { /* ok */ })

    try {
      proc.stdin!.write(JSON.stringify({ id: 1, type: 'INIT', appId }) + '\n')
      proc.stdin!.write(JSON.stringify({ id: 2, type: 'IDLE' }) + '\n')
    } catch (e) {
      console.error(`[idle:${appId}] Failed to write to worker stdin:`, e)
    }

    proc.on('exit', () => {
      if (!this.idlers.has(appId)) return
      this.idlers.delete(appId)
      this.names.delete(appId)
      console.log(`[idle] Worker exited unexpectedly for appId=${appId}`)

      if (this.idlers.size === 0 && this._pendingSpawns.size === 0) {
        this._scheduleRestore()
      }
      this.emit('changed')
    })

    this.idlers.set(appId, proc)
    this._recordIdleStart(appId)
    console.log(`[idle] Spawned worker for appId=${appId}`)
    this.emit('changed')
  }

  stopIdle(appId: number): void {
    // Cancel pending spawn if the worker hasn't been created yet
    const pendingTimer = this._pendingSpawns.get(appId)
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      this._pendingSpawns.delete(appId)
      this.names.delete(appId)
      console.log(`[idle] Cancelled pending spawn for appId=${appId}`)
      if (this.idlers.size === 0 && this._pendingSpawns.size === 0) {
        this._scheduleRestore()
      }
      this.emit('changed')
      return
    }

    const proc = this.idlers.get(appId)
    if (!proc) return

    try { proc.stdin!.end() } catch { /* ok */ }

    const pid = proc.pid
    if (pid !== undefined) {
      treeKill(pid, 'SIGKILL', (err) => {
        if (err) {
          try { proc.kill('SIGKILL') } catch { /* ok */ }
        }
      })
    } else {
      try { proc.kill('SIGKILL') } catch { /* ok */ }
    }

    this._recordIdleStop(appId)
    this.idlers.delete(appId)
    this.names.delete(appId)
    console.log(`[idle] Stopped idling appId=${appId}`)

    if (this.idlers.size === 0 && this._pendingSpawns.size === 0) {
      this._scheduleRestore()
    }

    this.emit('changed')
  }

  getIdlingAppIds(): number[] {
    return [...this.idlers.keys(), ...this._pendingSpawns.keys()]
  }

  getIdlingGames(): { appId: number; name: string }[] {
    const ids = this.getIdlingAppIds()
    return ids.map(id => ({
      appId: id,
      name: this.names.get(id) ?? `App ${id}`,
    }))
  }

  isIdling(appId: number): boolean {
    return this.idlers.has(appId) || this._pendingSpawns.has(appId)
  }

  stopAll(opts: { skipRestore?: boolean } = {}): void {
    // Cancel all pending spawns and game detection polling
    for (const [appId, timer] of this._pendingSpawns) {
      clearTimeout(timer)
      console.log(`[idle] Cancelled pending spawn for appId=${appId}`)
    }
    const hadPending = this._pendingSpawns.size > 0
    this._pendingSpawns.clear()
    this._knownRunningAtStart.clear()
    this._stopGameDetectionPolling()

    if (opts.skipRestore) {
      // During app quit: kill processes without touching Steam persona state
      for (const [appId, proc] of [...this.idlers.entries()]) {
        try { proc.stdin!.end() } catch { /* ok */ }
        const pid = proc.pid
        if (pid !== undefined) {
          treeKill(pid, 'SIGKILL', () => {})
        } else {
          try { proc.kill('SIGKILL') } catch { /* ok */ }
        }
        console.log(`[idle] Stopped idling appId=${appId}`)
      }
      this.idlers.clear()
      this.names.clear()
      this.emit('changed')
    } else {
      const hadIdlers = this.idlers.size > 0 || hadPending
      for (const [appId, proc] of [...this.idlers.entries()]) {
        try { proc.stdin!.end() } catch { /* ok */ }
        const pid = proc.pid
        if (pid !== undefined) {
          treeKill(pid, 'SIGKILL', () => {})
        } else {
          try { proc.kill('SIGKILL') } catch { /* ok */ }
        }
        this.idlers.delete(appId)
        this.names.delete(appId)
        console.log(`[idle] Stopped idling appId=${appId}`)
      }
      if (hadIdlers) {
        this._scheduleRestore()
      }
      this.emit('changed')
    }
  }

  // ─── Private: manual game launch detection (Windows registry polling) ─────

  /** Start polling the Windows registry for manual game launches. */
  private _startGameDetectionPolling(): void {
    if (process.platform !== 'win32') return
    if (this._gameDetectionInterval) return  // already polling
    this._gameDetectionInterval = setInterval(
      () => this._checkRunningGame(),
      IdleManager.GAME_DETECTION_POLL_MS,
    )
  }

  /** Stop polling when no games are idling. */
  private _stopGameDetectionPolling(): void {
    if (this._gameDetectionInterval) {
      clearInterval(this._gameDetectionInterval)
      this._gameDetectionInterval = null
    }
  }

  /**
   * Read Steam's RunningAppID from the Windows registry.
   * When the user launches a game from Steam, this value changes to the
   * game's appId. Our idle workers do NOT set this — they only register
   * via steamworks.js IPC, so RunningAppID stays 0 during idle.
   * If a non-zero appId appears that we're not idling → manual launch.
   */
  private _checkRunningGame(): void {
    if (this.idlers.size === 0 && this._pendingSpawns.size === 0) return

    execFile('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'], {
      timeout: 3000,
      windowsHide: true,
    }, (err, stdout) => {
      if (err) return
      // Output format: "    RunningAppID    REG_DWORD    0x000000XX"
      const match = stdout.match(/RunningAppID\s+REG_DWORD\s+0x([0-9a-fA-F]+)/)
      if (!match) return
      const appId = parseInt(match[1], 16)

      if (appId === 0 && this._knownRunningAtStart.size > 0) {
        // The game that was running at idle start has quit — clear the
        // exclusion set so relaunching the same game IS detected next time.
        console.log('[idle] Previously running game quit — clearing known-at-start exclusion')
        this._knownRunningAtStart.clear()
        return
      }

      if (appId > 0 && !this.isIdling(appId) && !this._knownRunningAtStart.has(appId)) {
        console.log(`[idle] Manual game launch detected via registry (appId=${appId}) — stopping all idle`)
        this.emit('manual-game-detected', appId)
        this.stopAll()
      }
    })
  }

  /**
   * One-time check when idle starts: emit 'game-already-running' if a Steam
   * game is currently running so the UI can show a warning notification.
   */
  private _warnIfGameRunning(): void {
    if (process.platform !== 'win32') return

    execFile('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'], {
      timeout: 3000,
      windowsHide: true,
    }, (err, stdout) => {
      if (err) return
      const match = stdout.match(/RunningAppID\s+REG_DWORD\s+0x([0-9a-fA-F]+)/)
      if (!match) return
      const appId = parseInt(match[1], 16)
      if (appId > 0) {
        // Add to exclusion set so the polling doesn't immediately kill the idle
        // for a game that was already running BEFORE the user started idling.
        this._knownRunningAtStart.add(appId)
        console.log(`[idle] Warning: Steam game already running (appId=${appId}) while starting idle — added to exclusion set`)
        this.emit('game-already-running', appId)
      }
    })
  }

  // ─── Private: delayed status restore ──────────────────────────────────────

  /**
   * Schedule a delayed restoreStatus call.
   * The 3-second delay gives Steam time to fully terminate the game
   * process before we change the persona state — without it, Steam
   * may still show "In-Game" briefly after the restore.
   * If a timer is already pending, it is replaced (only one fires).
   */
  private _scheduleRestore(): void {
    this._cancelRestoreTimer()
    if (!this.steamAccountManager?.hasAccount) return
    const { autoInvisibleWhenIdling } = getStore().get('settings')
    if (!autoInvisibleWhenIdling) return

    this._restoreTimer = setTimeout(() => {
      this._restoreTimer = null
      // Double-check: only restore if no new idle started during the delay
      if (this.idlers.size === 0 && this._pendingSpawns.size === 0 && this.steamAccountManager?.hasAccount) {
        this._stopGameDetectionPolling()
        this.steamAccountManager.restoreStatus()
      }
    }, IdleManager.RESTORE_DELAY_MS)
  }

  private _cancelRestoreTimer(): void {
    if (this._restoreTimer) {
      clearTimeout(this._restoreTimer)
      this._restoreTimer = null
    }
  }
}
