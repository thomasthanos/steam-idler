/**
 * workerPath.ts
 * Single source of truth for resolving the worker.js path.
 * In a packaged app, worker.js is extracted from app.asar into
 * app.asar.unpacked so it can be spawned as a child process.
 * In dev, __dirname does not contain 'app.asar' so the replace is a no-op.
 */
import * as path from 'path'

export function getWorkerPath(): string {
  return path.join(__dirname, 'worker.js')
    .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
}
