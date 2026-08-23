/**
 * GameImage.tsx
 *
 * Probes URLs silently via the Electron main process (IPC → axios HEAD).
 * No CORS issues, no 404 errors in the browser console.
 */

import { useState, memo, useEffect, useRef } from 'react'

interface GameImageProps {
  appId: number
  name: string
  className?: string
}

const getCandidates = (appId: number) => [
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
]

// ── LRU Cache ─────────────────────────────────────────────────────────────────
const MAX_CACHE_SIZE = 500

class LRUCache<K, V> {
  private map = new Map<K, V>()

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined
    const val = this.map.get(key)!
    this.map.delete(key)
    this.map.set(key, val)
    return val
  }

  set(key: K, val: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, val)
    if (this.map.size > MAX_CACHE_SIZE) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }
}

const imageCache = new LRUCache<number, string | null>()
const inFlight   = new Map<number, Promise<string | null>>()

async function resolveUrl(appId: number): Promise<string | null> {
  const cached = imageCache.get(appId)
  if (cached !== undefined) return cached
  if (inFlight.has(appId)) return inFlight.get(appId)!

  const probe = (async () => {
    for (const url of getCandidates(appId)) {
      try {
        const ok = await (window as any).steam.probeImage(url)
        if (ok) { imageCache.set(appId, url); return url }
      } catch { /* ignore */ }
    }
    imageCache.set(appId, null)
    return null
  })()

  inFlight.set(appId, probe)
  probe.finally(() => inFlight.delete(appId))
  return probe
}

// ── Letter avatar ──────────────────────────────────────────────────────────────
function LetterAvatar({ appId, name }: { appId: number; name: string }) {
  // If the name is a generic placeholder (e.g. "App 12345") show the last 4
  // digits of the AppID instead — it's more useful than the letter "A".
  const isGeneric = /^app\s+\d+$/i.test(name.trim())
  const label = isGeneric
    ? String(appId).slice(-4)           // e.g. "6230"
    : (name.trim().charAt(0) || '?').toUpperCase()

  // Derive a stable hue: use appId for generic names, name hash otherwise
  const seed = isGeneric
    ? appId
    : name.split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)
  const hue = Math.abs(seed) % 360

  return (
    <div
      className="w-full h-full flex items-center justify-center font-semibold text-white/80 select-none"
      style={{
        background: `linear-gradient(135deg, hsl(${hue},40%,20%), hsl(${(hue + 40) % 360},50%,28%))`,
        fontSize: isGeneric ? '0.55em' : '1em',
        letterSpacing: isGeneric ? '-0.03em' : undefined,
      }}
    >
      {label}
    </div>
  )
}

const GameImage = memo(({ appId, name, className = '' }: GameImageProps) => {
  const [src, setSrc] = useState<string | null>(() => imageCache.get(appId) ?? null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const hit = imageCache.get(appId)
    if (hit !== undefined) { setSrc(hit); return }
    setSrc(null)
    resolveUrl(appId).then(url => { if (mountedRef.current) setSrc(url) })
    return () => { mountedRef.current = false }
  }, [appId])

  if (!src) return <LetterAvatar appId={appId} name={name} />

  return (
    <img
      src={src}
      alt={name}
      className={`w-full h-full object-cover ${className}`}
      loading="lazy"
    />
  )
})

GameImage.displayName = 'GameImage'
export default GameImage
