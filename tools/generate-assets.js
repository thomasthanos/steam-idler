const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', '.github', 'assets');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// 1. Vibrant Dual-Tone Banner
const bannerSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" width="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f141c" />
      <stop offset="50%" stop-color="#141c28" />
      <stop offset="100%" stop-color="#1b2838" />
    </linearGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff9d00" />
      <stop offset="45%" stop-color="#ff6b00" />
      <stop offset="55%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="800" height="200" rx="15" fill="url(#bg)" stroke="#2a475e" stroke-width="1.5" />
  
  <!-- Subtle accent lines in background -->
  <line x1="40" y1="40" x2="200" y2="40" stroke="#ff9d00" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
  <line x1="600" y1="160" x2="760" y2="160" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.4"/>

  <g filter="url(#glow)">
    <text x="400" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="38" font-weight="900" text-anchor="middle" letter-spacing="2" fill="url(#titleGrad)">SOUVLATZIDIKO UNLOCKER</text>
  </g>
  <text x="400" y="148" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#94a3b8" text-anchor="middle" letter-spacing="2">STEAM ACHIEVEMENT MANAGER <tspan fill="#ff9d00">•</tspan> GAME IDLER</text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'hero-banner.svg'), bannerSVG);

// 2. Multi-Color Categorized Features SVG
const features = [
  // Left Column
  { icon: '🏆', title: 'Achievement Manager', desc: 'Unlock or lock achievements instantly', tag: 'CORE', color: '#f59e0b', col: 1 },
  { icon: '🔄', title: 'Stats Reset', desc: 'Reset numeric stats with safe confirmation', tag: 'CORE', color: '#f59e0b', col: 1 },
  { icon: '📚', title: 'Game Library', desc: 'Full Steam library with playtime &amp; progress', tag: 'STEAM', color: '#38bdf8', col: 1 },
  { icon: '🎮', title: 'Game Idler', desc: 'Idle multiple games in background', tag: 'IDLER', color: '#a855f7', col: 1 },
  { icon: '⚡', title: 'Auto-Idle on Boot', desc: 'Automatically start idling selected games', tag: 'IDLER', color: '#a855f7', col: 1 },
  { icon: '👻', title: 'Auto-Invisible Mode', desc: 'Stealth status while idling, auto-restores', tag: 'STEALTH', color: '#10b981', col: 1 },
  { icon: '🛑', title: 'Real Game Detection', desc: 'Stops idle tasks when real game launches', tag: 'STEALTH', color: '#ef4444', col: 1 },
  { icon: '🔐', title: 'Account Login', desc: 'QR code or cookie login with auto-reconnect', tag: 'AUTH', color: '#06b6d4', col: 1 },

  // Right Column
  { icon: '📊', title: 'Live Dashboard', desc: 'Playtime graphs, stats &amp; Steam specials', tag: 'UI', color: '#f97316', col: 2 },
  { icon: '🔍', title: 'Game Search', desc: 'Direct Steam Store search &amp; app lookup', tag: 'STORE', color: '#38bdf8', col: 2 },
  { icon: '🎨', title: 'Theme Engine', desc: 'Dark, Light, and System OS preference', tag: 'UI', color: '#ec4899', col: 2 },
  { icon: '🔔', title: 'Desktop Toasts', desc: 'Notification banners with audio feedback', tag: 'SYSTEM', color: '#eab308', col: 2 },
  { icon: '🔽', title: 'System Tray Hub', desc: 'Full idle controls from Windows tray menu', tag: 'SYSTEM', color: '#6366f1', col: 2 },
  { icon: '🔄', title: 'Silent Updater', desc: 'Automatic background update releases', tag: 'AUTO', color: '#14b8a6', col: 2 },
  { icon: '📦', title: 'App Collection', desc: 'Integrated tools hub by Thomas Thanos', tag: 'HUB', color: '#f43f5e', col: 2 },
  { icon: '🛡️', title: 'Zero Telemetry', desc: '100% offline, local electron-store config', tag: 'PRIVACY', color: '#10b981', col: 2 }
];

let featuresSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 560" width="100%">
  <defs>
    <linearGradient id="featBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f141c" />
      <stop offset="100%" stop-color="#172230" />
    </linearGradient>
  </defs>

  <rect width="850" height="560" rx="12" fill="url(#featBg)" stroke="#223247" stroke-width="1.5" />

  <!-- Header -->
  <path d="M 0 12 Q 0 0 12 0 L 838 0 Q 850 0 850 12 L 850 48 L 0 48 Z" fill="#141c28" />
  <circle cx="24" cy="24" r="5" fill="#f59e0b" />
  <circle cx="40" cy="24" r="5" fill="#38bdf8" />
  <circle cx="56" cy="24" r="5" fill="#a855f7" />

  <text x="80" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#f8fafc" letter-spacing="1">KEY FEATURES &amp; CAPABILITIES</text>
  
  <rect x="680" y="14" width="145" height="22" rx="11" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="752" y="29" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#38bdf8" text-anchor="middle">16 DEDICATED MODULES</text>

  <line x1="0" y1="48" x2="850" y2="48" stroke="#223247" stroke-width="1"/>

  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
`;

let yLeft = 62;
let yRight = 62;

features.forEach((item) => {
  const isLeft = item.col === 1;
  const x = isLeft ? 20 : 435;
  const y = isLeft ? yLeft : yRight;

  featuresSvgContent += `    <!-- Card: ${item.title} -->\n`;
  featuresSvgContent += `    <rect x="${x}" y="${y}" width="395" height="54" rx="8" fill="#131b26" stroke="#223247" stroke-width="1" />\n`;
  featuresSvgContent += `    <rect x="${x}" y="${y}" width="4" height="54" rx="2" fill="${item.color}" />\n`;
  featuresSvgContent += `    <text x="${x + 16}" y="${y + 23}" font-size="16">${item.icon}</text>\n`;
  featuresSvgContent += `    <text x="${x + 44}" y="${y + 22}" font-size="13" font-weight="700" fill="#f1f5f9">${item.title}</text>\n`;
  
  // Tag pill on right
  const tagWidth = item.tag.length * 6.5 + 12;
  const tagX = x + 385 - tagWidth;
  featuresSvgContent += `    <rect x="${tagX}" y="${y + 10}" width="${tagWidth}" height="16" rx="4" fill="${item.color}22" stroke="${item.color}55" stroke-width="1" />\n`;
  featuresSvgContent += `    <text x="${tagX + tagWidth / 2}" y="${y + 22}" font-size="9" font-weight="700" fill="${item.color}" text-anchor="middle">${item.tag}</text>\n`;

  featuresSvgContent += `    <text x="${x + 44}" y="${y + 40}" font-size="11" fill="#94a3b8">${item.desc}</text>\n`;

  if (isLeft) yLeft += 60; else yRight += 60;
});

featuresSvgContent += `
  </g>
</svg>`;

fs.writeFileSync(path.join(outDir, 'features.svg'), featuresSvgContent);

// 3. Multi-Color Grouped Settings SVG
const settingsList = [
  { key: 'Steam API Key', desc: 'Optional — enables full library fetching', cat: 'AUTH', color: '#38bdf8' },
  { key: 'Steam ID', desc: 'Optional — used alongside API key', cat: 'AUTH', color: '#38bdf8' },
  { key: 'Custom App IDs', desc: 'Manually add game IDs not in your library', cat: 'GAMES', color: '#a855f7' },
  { key: 'Theme', desc: 'Dark / Light / System preference', cat: 'UI', color: '#ec4899' },
  { key: 'Show global %', desc: '% of players who have each achievement', cat: 'STATS', color: '#f59e0b' },
  { key: 'Show hidden achievements', desc: 'Reveal hidden names & descriptions', cat: 'STATS', color: '#f59e0b' },
  { key: 'Confirm bulk actions', desc: 'Dialog before unlock-all / lock-all', cat: 'SAFETY', color: '#ef4444' },
  { key: 'Minimize to tray', desc: 'Keep app alive on close', cat: 'SYSTEM', color: '#6366f1' },
  { key: 'Launch on startup', desc: 'Start automatically with Windows', cat: 'SYSTEM', color: '#6366f1' },
  { key: 'Notifications', desc: 'Desktop notifications + sound toggle', cat: 'ALERT', color: '#eab308' },
  { key: 'Auto-Idle list', desc: 'Games to idle automatically on launch', cat: 'IDLER', color: '#10b981' },
  { key: 'Auto-Invisible when idling', desc: 'Switch status to Invisible while idling', cat: 'STEALTH', color: '#14b8a6' },
  { key: 'Stop idle on game launch', desc: 'Stop all idling if a real game is launched', cat: 'SAFETY', color: '#ef4444' }
];

let settingsSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 560" width="100%">
  <defs>
    <linearGradient id="setBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f141c" />
      <stop offset="100%" stop-color="#172230" />
    </linearGradient>
  </defs>

  <rect width="850" height="560" rx="12" fill="url(#setBg)" stroke="#223247" stroke-width="1.5" />

  <!-- Header -->
  <path d="M 0 12 Q 0 0 12 0 L 838 0 Q 850 0 850 12 L 850 48 L 0 48 Z" fill="#141c28" />
  <circle cx="24" cy="24" r="5" fill="#38bdf8" />
  <circle cx="40" cy="24" r="5" fill="#a855f7" />
  <circle cx="56" cy="24" r="5" fill="#10b981" />

  <text x="80" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#f8fafc" letter-spacing="1">APP CONFIGURATION &amp; PREFERENCES</text>
  <line x1="0" y1="48" x2="850" y2="48" stroke="#223247" stroke-width="1"/>

  <!-- Table Header -->
  <text x="35" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">SETTING</text>
  <text x="240" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">CATEGORY</text>
  <text x="360" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">DESCRIPTION</text>
  <line x1="25" y1="84" x2="825" y2="84" stroke="#223247" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- Rows -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13">
`;

let setY = 108;
settingsList.forEach((item, index) => {
  if (index % 2 === 1) {
    settingsSvgContent += `    <rect x="20" y="${setY - 17}" width="810" height="28" rx="6" fill="#1e293b" opacity="0.4" />\n`;
  }
  const cleanKey = item.key.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cleanDesc = item.desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  settingsSvgContent += `    <text x="35" y="${setY}" fill="#f1f5f9" font-weight="600">${cleanKey}</text>\n`;
  
  // Category badge
  settingsSvgContent += `    <rect x="240" y="${setY - 13}" width="65" height="18" rx="4" fill="${item.color}20" stroke="${item.color}50" stroke-width="1" />\n`;
  settingsSvgContent += `    <text x="272.5" y="${setY}" font-size="10" font-weight="700" fill="${item.color}" text-anchor="middle">${item.cat}</text>\n`;

  settingsSvgContent += `    <text x="360" y="${setY}" fill="#94a3b8">${cleanDesc}</text>\n`;
  setY += 31;
});

settingsSvgContent += `
  </g>

  <!-- Footer Banner -->
  <rect x="20" y="505" width="810" height="38" rx="8" fill="#131b26" stroke="#223247" stroke-width="1" />
  <text x="425" y="529" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#94a3b8" text-anchor="middle">
    🔒 Stored locally via <tspan fill="#38bdf8" font-family="monospace">electron-store</tspan> • <tspan fill="#10b981">Zero telemetry</tspan> • 100% offline configuration
  </text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'settings.svg'), settingsSvgContent);

// 4. Multi-Color Auth Flow SVG
let authSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 300" width="100%">
  <defs>
    <linearGradient id="authBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f141c" />
      <stop offset="100%" stop-color="#172230" />
    </linearGradient>
  </defs>

  <rect width="850" height="300" rx="12" fill="url(#authBg)" stroke="#223247" stroke-width="1.5" />

  <!-- Header -->
  <path d="M 0 12 Q 0 0 12 0 L 838 0 Q 850 0 850 12 L 850 48 L 0 48 Z" fill="#141c28" />
  <circle cx="24" cy="24" r="5" fill="#38bdf8" />
  <circle cx="40" cy="24" r="5" fill="#f59e0b" />
  <circle cx="56" cy="24" r="5" fill="#10b981" />

  <text x="80" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#f8fafc" letter-spacing="1">STEAM AUTHENTICATION &amp; AUTO-INVISIBLE PROTOCOL</text>
  <line x1="0" y1="48" x2="850" y2="48" stroke="#223247" stroke-width="1"/>

  <!-- 4 Step Cards (2x2 grid with unique colors) -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
    <!-- Card 1: Blue -->
    <rect x="20" y="65" width="395" height="85" rx="8" fill="#131b26" stroke="#223247" stroke-width="1" />
    <rect x="20" y="65" width="4" height="85" rx="2" fill="#38bdf8" />
    <text x="36" y="96" font-size="20">📱</text>
    <text x="68" y="94" font-size="13" font-weight="700" fill="#38bdf8">QR Code Mobile Auth</text>
    <text x="68" y="115" font-size="11" fill="#e2e8f0">Instant login by scanning with official Steam App</text>
    <text x="68" y="132" font-size="11" fill="#94a3b8">Zero manual password entry required</text>

    <!-- Card 2: Amber -->
    <rect x="435" y="65" width="395" height="85" rx="8" fill="#131b26" stroke="#223247" stroke-width="1" />
    <rect x="435" y="65" width="4" height="85" rx="2" fill="#f59e0b" />
    <text x="451" y="96" font-size="20">🍪</text>
    <text x="483" y="94" font-size="13" font-weight="700" fill="#f59e0b">Cookie Fallback Option</text>
    <text x="483" y="115" font-size="11" fill="#e2e8f0">Paste steamLoginSecure with automatic JWT parsing</text>
    <text x="483" y="132" font-size="11" fill="#94a3b8">Supports steamId||&lt;jwt&gt; format seamlessly</text>

    <!-- Card 3: Green -->
    <rect x="20" y="160" width="395" height="85" rx="8" fill="#131b26" stroke="#223247" stroke-width="1" />
    <rect x="20" y="160" width="4" height="85" rx="2" fill="#10b981" />
    <text x="36" y="191" font-size="20">🔒</text>
    <text x="68" y="189" font-size="13" font-weight="700" fill="#10b981">Local Session Token</text>
    <text x="68" y="210" font-size="11" fill="#e2e8f0">Base64-obfuscated refresh token storage</text>
    <text x="68" y="227" font-size="11" fill="#94a3b8">Silent auto-reconnect on next application launch</text>

    <!-- Card 4: Purple -->
    <rect x="435" y="160" width="395" height="85" rx="8" fill="#131b26" stroke="#223247" stroke-width="1" />
    <rect x="435" y="160" width="4" height="85" rx="2" fill="#a855f7" />
    <text x="451" y="191" font-size="20">👻</text>
    <text x="483" y="189" font-size="13" font-weight="700" fill="#a855f7">Auto-Invisible Protocol</text>
    <text x="483" y="210" font-size="11" fill="#e2e8f0">Native steam://friends protocol switching</text>
    <text x="483" y="227" font-size="11" fill="#94a3b8">Zero CM traffic • Restores state from localconfig.vdf</text>
  </g>

  <!-- Footer Info -->
  <text x="425" y="278" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#94a3b8" text-anchor="middle">
    💡 Status changes operate entirely client-side without interfering with active gaming sessions.
  </text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'auth-flow.svg'), authSvgContent);

// 5. Structure Tree SVG with syntax color variety
const treeLinesColored = [
  { text: 'src/', type: 'root', comment: '', color: '#f59e0b' },
  { text: '├── main/', type: 'folder', comment: '', color: '#38bdf8' },
  { text: '│   ├── index.ts', type: 'file', comment: 'App entry, window, tray, splash flow', color: '#f1f5f9' },
  { text: '│   ├── updater.ts', type: 'file', comment: 'Auto-updater + splash preload', color: '#f1f5f9' },
  { text: '│   ├── store.ts', type: 'file', comment: 'electron-store schema', color: '#f1f5f9' },
  { text: '│   ├── trayIcons.ts', type: 'file', comment: 'Base64 tray icon assets', color: '#f1f5f9' },
  { text: '│   ├── steam/', type: 'folder', comment: '', color: '#a855f7' },
  { text: '│   │   ├── client.ts', type: 'file', comment: 'steamworks.js wrapper + games cache', color: '#f1f5f9' },
  { text: '│   │   ├── idleManager.ts', type: 'file', comment: 'Multi-game idle process manager', color: '#f1f5f9' },
  { text: '│   │   ├── worker.ts', type: 'file', comment: 'Child process: steamworks idle worker', color: '#f1f5f9' },
  { text: '│   │   ├── steamPaths.ts', type: 'file', comment: 'Steam install path & VDF helpers', color: '#f1f5f9' },
  { text: '│   │   └── steamUser.ts', type: 'file', comment: 'Account manager (QR/cookie login)', color: '#f1f5f9' },
  { text: '│   └── ipc/handlers.ts', type: 'file', comment: 'All IPC channel registrations', color: '#f1f5f9' },
  { text: '├── preload/index.ts', type: 'file', comment: 'Secure contextBridge API', color: '#38bdf8' },
  { text: '├── renderer/', type: 'folder', comment: '', color: '#10b981' },
  { text: '│   ├── components/', type: 'folder', comment: 'TitleBar, Sidebar, UpdateBanner, SetupScreen', color: '#10b981' },
  { text: '│   ├── pages/', type: 'folder', comment: 'Home, Games, Achievements, Settings, Idle', color: '#10b981' },
  { text: '│   ├── hooks/', type: 'folder', comment: 'useAppContext, useTheme, useUpdater', color: '#10b981' },
  { text: '│   └── styles/global.css', type: 'file', comment: '', color: '#ec4899' },
  { text: '└── shared/types.ts', type: 'file', comment: 'Shared types, IPC channels & default settings', color: '#eab308' }
];

let treeSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 560" width="100%">
  <rect width="850" height="560" rx="12" fill="#0f141c" stroke="#223247" stroke-width="1.5" />
  
  <circle cx="20" cy="20" r="6" fill="#ff5f56" />
  <circle cx="40" cy="20" r="6" fill="#ffbd2e" />
  <circle cx="60" cy="20" r="6" fill="#27c93f" />
  
  <text x="425" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">PROJECT DIRECTORY STRUCTURE</text>
  <line x1="0" y1="40" x2="850" y2="40" stroke="#223247" stroke-width="1.5"/>

  <g font-family="Consolas, Monaco, 'Courier New', monospace" font-size="14">
`;

let yTree = 75;
for (const line of treeLinesColored) {
  let text = line.text;
  let prefix = '';
  let name = '';
  
  const match = text.match(/^([│├─└\s]*)(.*)$/);
  if (match) {
    prefix = match[1];
    name = match[2];
  } else {
    name = text;
  }
  
  treeSvgContent += `    <text x="25" y="${yTree}" xml:space="preserve"><tspan fill="#475569">${prefix}</tspan><tspan fill="${line.color}" font-weight="${line.type === 'folder' || line.type === 'root' ? 'bold' : 'normal'}">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan></text>\n`;
  
  if (line.comment) {
    treeSvgContent += `    <text x="400" y="${yTree}" fill="#64748b" font-style="italic">// ${line.comment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>\n`;
  }
  
  yTree += 22;
}

treeSvgContent += `
  </g>
</svg>`;

fs.writeFileSync(path.join(outDir, 'structure.svg'), treeSvgContent);

console.log('All 5 enhanced multi-color SVGs generated!');
