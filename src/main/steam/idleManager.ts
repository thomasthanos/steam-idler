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

export class IdleManager extends EventEmitter {
  private idlers = new Map<number, ChildProcess>()
  private names  = new Map<number, string>()

  private get workerPath(): string {
    return path.join(__dirname, 'worker.js')
      .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
  }

  startIdle(appId: number, name?: string): void {
    if (this.idlers.has(appId)) return
    if (name) this.names.set(appId, name)

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
}
