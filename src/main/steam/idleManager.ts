/**
 * idleManager.ts – manages "idling" worker processes.
 * Each game gets its own child process with SteamAppId set,
 * so Steam shows the game as "currently playing."
 */

import { ChildProcess, spawn } from 'child_process'
import * as path from 'path'

export class IdleManager {
  private idlers = new Map<number, ChildProcess>()
  private names  = new Map<number, string>()

  private get workerPath(): string {
    return path.join(__dirname, 'worker.js')
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
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    proc.stderr?.setEncoding('utf8')
    proc.stderr?.on('data', (chunk: string) => {
      console.error(`[idle:${appId}] ${chunk.trim()}`)
    })

    // Init steamworks with the game's appId, then start idle loop
    proc.stdin!.write(JSON.stringify({ id: 1, type: 'INIT', appId }) + '\n')
    proc.stdin!.write(JSON.stringify({ id: 2, type: 'IDLE' }) + '\n')

    proc.on('exit', () => {
      this.idlers.delete(appId)
      this.names.delete(appId)  // keep names in sync so getIdlingGames() stays consistent
    })

    this.idlers.set(appId, proc)
    console.log(`[idle] Started idling appId=${appId}`)
  }

  stopIdle(appId: number): void {
    const proc = this.idlers.get(appId)
    if (!proc) return
    try { proc.stdin!.end() } catch { /* ok */ }
    try { proc.kill() } catch { /* ok */ }
    this.idlers.delete(appId)
    this.names.delete(appId)
    console.log(`[idle] Stopped idling appId=${appId}`)
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
