/**
 * Module augmentation for steamworks.js.
 *
 * IMPORTANT: The `export {}` at the top makes this file a TypeScript *module*
 * rather than an ambient script.  Without it, `declare module 'steamworks.js'`
 * is treated as an ambient module declaration that *replaces* the package's own
 * types entirely — stripping sw.Client, sw.init, etc.
 *
 * With `export {}` the compiler treats this as a module augmentation that only
 * *adds* the missing `runCallbacks` export to the existing type definitions.
 *
 * Fix #9 – typed runCallbacks so worker.ts no longer needs `sw as any`.
 */

export {}  // ← required: turns this into a module, enabling augmentation mode

declare module 'steamworks.js' {
  /**
   * Pump the Steamworks callback queue manually.
   * Must be called periodically (e.g. every 100–250 ms) in worker processes
   * that cannot rely on the native addon's own timer to fire.
   */
  export function runCallbacks(): void
}
