/**
 * GameImage.tsx
 *
 * Fix #8 – Replace the unbounded module-level Map with an LRU cache so
 *          memory doesn't grow indefinitely when a user browses a large Steam
 *          library.  The cache is capped at MAX_CACHE_SIZE entries; the least-
 *          recently-used entry is evicted when the cap is reached.
 */

import { useState, memo, useEffect, useRef } from 'react'

interface GameImageProps {
  appId: number
  name: string
  className?: string
}

// Steam CDN image candidates, tried in order.
const getCandidates = (appId: number) => [
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
]

// ── LRU Cache ────────────────────────────────────────────────────────────────
// Stores either the first working URL (string) or null (all candidates failed).
// The insertion-order of Map entries is exploited: the oldest entry is always
// `map.keys().next().value`.

const MAX_CACHE_SIZE = 500

class LRUCache<K, V> {
  private map = new Map<K, V>()

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined
    const val = this.map.get(key)!
    // Move to end (most-recently-used position)
    this.map.delete(key)
    this.map.set(key, val)
    return val
  }

  set(key: K, val: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, val)
    if (this.map.size > MAX_CACHE_SIZE) {
      // Evict least-recently-used (first) entry
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  has(key: K): boolean {
    return this.map.has(key)
  }
}

// Module-level so results persist across remounts and page navigation.
const imageCache = new LRUCache<number, string | null>()

// ── Letter avatar ─────────────────────────────────────────────────────────────
function LetterAvatar({ name }: { name: string }) {
  const letter = (name.trim().charAt(0) || '?').toUpperCase()
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return (
    <div
      className="w-full h-full flex items-center justify-center font-semibold text-white/80 text-base select-none"
      style={{ background: `linear-gradient(135deg, hsl(${hue},40%,20%), hsl(${(hue + 40) % 360},50%,28%))` }}
    >
      {letter}
    </div>
  )
}

const GameImage = memo(({ appId, name, className = '' }: GameImageProps) => {
  const cached = imageCache.get(appId)
  const candidates = getCandidates(appId)

  const indexRef      = useRef(0)
  const [src, setSrc] = useState<string>(cached !== undefined && cached !== null ? cached : candidates[0])
  const [failed, setFailed] = useState<boolean>(cached === null)

  useEffect(() => {
    const hit = imageCache.get(appId)
    if (hit !== undefined) {
      indexRef.current = 0
      setSrc(hit ?? candidates[0])
      setFailed(hit === null)
    } else {
      indexRef.current = 0
      setSrc(getCandidates(appId)[0])
      setFailed(false)
    }
  }, [appId])

  if (failed) return <LetterAvatar name={name} />

  return (
    <img
      src={src}
      alt={name}
      className={`w-full h-full object-cover ${className}`}
      loading="lazy"
      onError={() => {
        const next = indexRef.current + 1
        indexRef.current = next
        const nextUrl = getCandidates(appId)[next]
        if (nextUrl) {
          setSrc(nextUrl)
        } else {
          imageCache.set(appId, null)
          setFailed(true)
        }
      }}
      onLoad={() => {
        if (imageCache.get(appId) === undefined) imageCache.set(appId, src)
      }}
    />
  )
})

GameImage.displayName = 'GameImage'
export default GameImage
