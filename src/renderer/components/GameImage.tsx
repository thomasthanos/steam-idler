import { useState, memo, useEffect, useRef } from 'react'

interface GameImageProps {
  appId: number
  name: string
  className?: string
}

// Steam CDN image candidates, tried in order.
// header.jpg         → 460×215 — most common, present on virtually all games
// capsule_231x87.jpg → smaller capsule, present on most games
// capsule_sm_120.jpg intentionally omitted — almost never exists on the CDN
//                    and only adds 404 noise to the browser console.
const getCandidates = (appId: number) => [
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
]

// Module-level cache so results persist across remounts and page navigation.
// Stores either the first working URL, or null if all candidates failed.
const imageCache = new Map<number, string | null>()

// Deterministic letter avatar — zero HTTP requests
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
  // Check cache first — avoids re-firing 404 requests on remount/re-render
  const cached = imageCache.get(appId)
  const candidates = getCandidates(appId)

  const indexRef      = useRef(0)
  const [src, setSrc] = useState<string>(cached !== undefined && cached !== null ? cached : candidates[0])
  const [failed, setFailed] = useState<boolean>(cached === null)

  // Reset when appId changes, respecting cache
  useEffect(() => {
    const hit = imageCache.get(appId)
    if (hit !== undefined) {
      // Already resolved: jump straight to known-good URL or letter avatar
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
          setSrc(nextUrl)   // try next candidate silently
        } else {
          // All candidates exhausted — cache the failure so we never retry
          imageCache.set(appId, null)
          setFailed(true)
        }
      }}
      onLoad={() => {
        // Cache the first URL that loads successfully
        if (!imageCache.has(appId)) imageCache.set(appId, src)
      }}
    />
  )
})

GameImage.displayName = 'GameImage'
export default GameImage
