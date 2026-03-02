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
 */

import { ChildProcess, spawn } from 'child_process'
import * as path from 'path'
import { EventEmitter } from 'events'
import treeKill from 'tree-kill'
import { SteamAccountManager } from './steamUser'
import { getStore } from '../store'

export class IdleManager extends EventEmitter {
  private idlers = new Map<number, ChildProcess>()
  private names  = new Map<number, string>()
  private steamAccountManager: SteamAccountManager | null = null
  private statusChangeAttempted = false

  private get workerPath(): string {
    return path.join(__dirname, 'worker.js')
      .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
  }

  setSteamAccountManager(manager: SteamAccountManager): void {
    this.steamAccountManager = manager
  }

  startIdle(appId: number, name?: string): void {
    if (this.idlers.has(appId)) return
    if (name) this.names.set(appId, name)

    const wasEmpty = this.idlers.size === 0

    const proc = spawn(process.execPath, [this.workerPath], {
      env: {
        ...process.env,
        SteamAppId: String(appId),
        ELECTRON_RUN_AS_NODE: '1',
        ELECTRON_NO_ASAR: '1',
      },
      // detached: false keeps the child in the same session so tree-kill can
      // walk the full process tree on all platforms.
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    })

    proc.stderr?.setEncoding('utf8')
    proc.stderr?.on('data', (chunk: string) => {
      console.error(`[idle:${appId}] ${chunk.trim()}`)
    })

    proc.stdin!.write(JSON.stringify({ id: 1, type: 'INIT', appId }) + '\n')
    proc.stdin!.write(JSON.stringify({ id: 2, type: 'IDLE' }) + '\n')

    proc.on('exit', () => {
      this.idlers.delete(appId)
      this.names.delete(appId)
      // Notify listeners so the tray can refresh without waiting for the poll.
      this.emit('changed')
    })

    this.idlers.set(appId, proc)
    console.log(`[idle] Started idling appId=${appId}`)
    this.emit('changed')

    // ── Auto-invisible: trigger on first game ────────────────────────────
    if (wasEmpty && !this.statusChangeAttempted) {
      this._trySetInvisible(appId)
    }
  }

  stopIdle(appId: number): void {
    const proc = this.idlers.get(appId)
    if (!proc) return

    // 1. Close stdin so the worker's 'end' handler fires and it calls process.exit(0)
    try { proc.stdin!.end() } catch { /* ok */ }

    // 2. Use tree-kill to SIGKILL the entire process subtree (works on Windows too).
    //    Fall back to proc.kill() if the pid is unavailable.
    const pid = proc.pid
    if (pid !== undefined) {
      treeKill(pid, 'SIGKILL', (err) => {
        if (err) {
          // Tree-kill failed (process may have already exited) — best-effort fallback.
          try { proc.kill('SIGKILL') } catch { /* ok */ }
        }
      })
    } else {
      try { proc.kill('SIGKILL') } catch { /* ok */ }
    }

    this.idlers.delete(appId)
    this.names.delete(appId)
    console.log(`[idle] Stopped idling appId=${appId}`)
    this.emit('changed')

    // ── Auto-invisible: restore on last game ─────────────────────────────
    if (this.idlers.size === 0 && this.statusChangeAttempted) {
      this._tryRestoreStatus()
    }
  }

  getIdlingAppIds(): number[] {
    return [...this.idlers.keys()]
  }

  getIdlingGames(): { appId: number; name: string }[] {
    return [...this.idlers.keys()].map(id => ({
      appId: id,
      name: this.names.get(id) ?? `App ${id}`,
    }))
  }

  isIdling(appId: number): boolean {
    return this.idlers.has(appId)
  }

  stopAll(): void {
    for (const appId of [...this.idlers.keys()]) {
      this.stopIdle(appId)
    }
    this.names.clear()
  }

  // ─── Private helpers ─────────────────────────────────────────────────────
  private _trySetInvisible(appId: number): void {
    const mgr = this.steamAccountManager
    if (!mgr?.isConnected) return

    try {
      const settings = getStore().get('settings')
      if (!settings.autoInvisibleWhenIdling) return
    } catch { return }

    try {
      mgr.setInvisible()
      mgr.setPlayingGame(appId)
      this.statusChangeAttempted = true
      console.log('[idle] Auto-invisible activated')
    } catch (e) {
      console.error('[idle] Failed to set invisible:', e)
    }
  }

  private _tryRestoreStatus(): void {
    const mgr = this.steamAccountManager
    if (!mgr?.isConnected) {
      this.statusChangeAttempted = false
      return
    }

    try {
      mgr.restoreStatus()
      mgr.clearPlayingGame()
      this.statusChangeAttempted = false
      console.log('[idle] Auto-invisible restored')
    } catch (e) {
      console.error('[idle] Failed to restore status:', e)
      this.statusChangeAttempted = false
    }
  }
}
