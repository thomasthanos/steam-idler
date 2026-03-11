/**
 * Type declaration for the `tree-kill` package.
 * tree-kill 1.x ships its own index.d.ts, but this file acts as a fallback
 * in case the bundled types are missing or the version changes.
 *
 * Fix #1 – used in idleManager.ts to cleanly terminate worker process trees.
 */

declare module 'tree-kill' {
  /**
   * Kill `pid` and all its descendants using `signal` (default: 'SIGTERM').
   * On Windows, uses `taskkill /F /T /PID`.
   *
   * @param pid     Root process ID
   * @param signal  Signal name or number (ignored on Windows — always force-kills)
   * @param callback Called when done or if an error occurs
   */
  function treeKill(pid: number, signal?: string | number, callback?: (err?: Error) => void): void
  function treeKill(pid: number, callback?: (err?: Error) => void): void

  export = treeKill
}
