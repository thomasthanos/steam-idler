import { useState, memo, useEffect, useRef } from 'react'

interface GameImageProps {
  appId: number
  name: string
  className?: string
}

// Steam CDN image candidates, tried in order.
// header.jpg   → 460×215 — most common
// capsule_231x87.jpg → smaller capsule, present on most games
// capsule_sm_120.jpg → tiny capsule, almost always present
const getCandidates = (appId: number) => [
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`,
]

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
  const candidates    = getCandidates(appId)
  const indexRef      = useRef(0)
  const [src, setSrc] = useState(candidates[0])
  const [failed, setFailed]  = useState(false)

  // Reset when appId changes
  useEffect(() => {
    indexRef.current = 0
    setSrc(getCandidates(appId)[0])
    setFailed(false)
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
          setFailed(true)   // all candidates exhausted → letter avatar
        }
      }}
    />
  )
})

GameImage.displayName = 'GameImage'
export default GameImage
