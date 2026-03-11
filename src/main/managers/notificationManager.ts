/**
 * notificationManager.ts
 * Custom Electron overlay notifications — replaces native OS notifications.
 * The notification HTML is inlined here so it's always bundled with the app.
 */

import { BrowserWindow, screen } from 'electron'

export type NotificationVariant = 'warning' | 'error' | 'success' | 'info'

interface NotificationOptions {
  title: string
  body: string
  variant?: NotificationVariant
  duration?: number
  onClick?: () => void
}

const WIDTH     = 360
const HEIGHT    = 110
const MARGIN    = 16
const STACK_GAP = 8

const activeWindows: BrowserWindow[] = []

// ── Inline HTML ───────────────────────────────────────────────────────────────
const NOTIFICATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    width: 100%; height: 100%;
    background: transparent;
    overflow: hidden;
    font-family: -apple-system, 'BlinkMacSystemFont', 'Segoe UI', Roboto, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    user-select: none;
  }
  .card {
    position: absolute;
    inset: 8px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    border-radius: 16px;
    background: #1e1e26;
    border: 2px solid #2c2c38;
    border-top-color: #3a3a48;
    border-left-color: #3a3a48;
    border-bottom-color: #15151c;
    border-right-color: #15151c;
    opacity: 0;
    transform: translateY(12px) scale(0.98);
    transition: opacity 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1), transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1);
    padding: 12px 16px 12px 12px;
  }
  .card.show { opacity: 1; transform: translateY(0) scale(1); }
  .card.hide { opacity: 0; transform: translateY(-8px) scale(0.98); transition: opacity 0.2s ease, transform 0.2s ease; }
  .icon {
    width: 42px; height: 42px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    border: 2px solid;
    border-top-color: rgba(255,255,255,0.3);
    border-left-color: rgba(255,255,255,0.3);
    border-bottom-color: rgba(0,0,0,0.3);
    border-right-color: rgba(0,0,0,0.3);
  }
  .icon svg { width: 22px; height: 22px; }
  .text { flex: 1; min-width: 0; }
  .app-name {
    font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
    text-transform: uppercase; color: rgba(255,255,255,0.5);
    line-height: 1.2; margin-bottom: 4px;
  }
  .title {
    font-size: 14px; font-weight: 600; color: #ffffff;
    line-height: 1.3; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; margin-bottom: 4px; letter-spacing: -0.01em;
  }
  .body {
    font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.4;
    overflow: hidden; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word;
  }
  .close {
    width: 32px; height: 32px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border-radius: 10px; cursor: pointer; color: rgba(255,255,255,0.4);
    transition: all 0.1s ease; background: #1e1e26;
    border: 2px solid;
    border-top-color: #3a3a48; border-left-color: #3a3a48;
    border-bottom-color: #15151c; border-right-color: #15151c;
    margin-left: 4px;
  }
  .close:hover {
    border-top-color: #4a4a5a; border-left-color: #4a4a5a;
    border-bottom-color: #252530; border-right-color: #252530;
    color: rgba(255,255,255,0.9);
  }
  .close:active {
    border-top-color: #15151c; border-left-color: #15151c;
    border-bottom-color: #3a3a48; border-right-color: #3a3a48;
    transform: translateY(1px);
  }
  .close svg { width: 12px; height: 12px; }
</style>
</head>
<body>
<div class="card" id="card">
  <div class="icon" id="icon">
    <svg id="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
  </div>
  <div class="text">
    <div class="app-name">Souvlatzidiko-Unlocker</div>
    <div class="title" id="title"></div>
    <div class="body"  id="body"></div>
  </div>
  <div class="close" id="close">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6"  y1="6" x2="18" y2="18"/>
    </svg>
  </div>
</div>
<script>
  const q = new URLSearchParams(location.search)
  const title = q.get('t') || ''
  const body  = q.get('b') || ''
  const dur   = parseInt(q.get('d') || '5000', 10)
  const v     = q.get('v') || 'info'
  const V = {
    info:    { bg:'#2a3a5a', icon:'#60a5fa', paths:['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z','M12 16v-4','M12 8h.01'] },
    success: { bg:'#1a4730', icon:'#34d399', paths:['M22 11.08V12a10 10 0 1 1-5.93-9.14','M22 4 12 14.01l-3-3'] },
    warning: { bg:'#4a3a1a', icon:'#fbbf24', paths:['M12 9v4','M12 17h.01','M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'] },
    error:   { bg:'#4a2424', icon:'#f87171', paths:['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z','M15 9l-6 6','M9 9l6 6'] },
  }
  const cfg = V[v] || V.info
  document.getElementById('title').textContent = title
  document.getElementById('body').textContent  = body
  document.getElementById('icon').style.background = cfg.bg
  document.getElementById('icon').style.color      = cfg.icon
  document.getElementById('svg').innerHTML = cfg.paths.map(d => '<path d="' + d + '"/>').join('')
  const card = document.getElementById('card')
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')))
  let gone = false
  function dismiss() {
    if (gone) return; gone = true
    card.classList.remove('show')
    card.classList.add('hide')
    setTimeout(() => window.close(), 250)
  }
  document.getElementById('close').addEventListener('click', dismiss)
  setTimeout(dismiss, dur)
<\/script>
</body>
</html>`

// ── Manager ───────────────────────────────────────────────────────────────────

function repositionAll(): void {
  const display = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = display.workAreaSize
  const origin = display.workArea

  activeWindows.forEach((win, i) => {
    if (win.isDestroyed()) return
    const x = origin.x + sw - WIDTH  - MARGIN
    const y = origin.y + sh - HEIGHT - MARGIN - i * (HEIGHT + STACK_GAP)
    win.setPosition(x, y, false)
  })
}

export function showNotification(opts: NotificationOptions): void {
  const {
    title,
    body,
    variant  = 'info',
    duration = 5000,
    onClick,
  } = opts

  const display = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = display.workAreaSize
  const origin = display.workArea

  const x = origin.x + sw - WIDTH  - MARGIN
  const y = origin.y + sh - HEIGHT - MARGIN

  const win = new BrowserWindow({
    width:  WIDTH,
    height: HEIGHT,
    x,
    y,
    frame:          false,
    transparent:    true,
    resizable:      false,
    movable:        false,
    minimizable:    false,
    maximizable:    false,
    fullscreenable: false,
    skipTaskbar:    true,
    alwaysOnTop:    true,
    focusable:      false,
    show:           false,
    hasShadow:      false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // data: URLs don’t support query strings — inject params directly into the HTML
  const injected = NOTIFICATION_HTML.replace(
    "const q = new URLSearchParams(location.search)",
    `const q = new URLSearchParams(${JSON.stringify(
      `t=${encodeURIComponent(title)}&b=${encodeURIComponent(body)}&v=${encodeURIComponent(variant)}&d=${duration}`
    )})`
  )
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(injected)}`)

  win.once('ready-to-show', () => {
    activeWindows.unshift(win)
    repositionAll()
    win.showInactive()
  })

  win.on('closed', () => {
    const idx = activeWindows.indexOf(win)
    if (idx !== -1) activeWindows.splice(idx, 1)
    repositionAll()
  })

  win.on('focus', () => onClick?.())

  setTimeout(() => {
    if (!win.isDestroyed()) win.close()
  }, duration + 400)
}
