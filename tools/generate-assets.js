const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', '.github', 'assets');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// 1. Fix Banner
const bannerSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" width="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#171a21" />
      <stop offset="50%" stop-color="#1b2838" />
      <stop offset="100%" stop-color="#2a475e" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="800" height="200" rx="15" fill="url(#bg)" />
  <g filter="url(#glow)">
    <text x="400" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="38" font-weight="900" fill="#66c0f4" text-anchor="middle" letter-spacing="2">SOUVLATZIDIKO UNLOCKER</text>
  </g>
  <text x="400" y="150" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="400" fill="#c7d5e0" text-anchor="middle" letter-spacing="1">STEAM ACHIEVEMENT MANAGER &amp; GAME IDLER</text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'hero-banner.svg'), bannerSVG);

// 2. Tree SVG
const treeLines = [
  { text: 'src/', type: 'root', comment: '' },
  { text: '├── main/', type: 'folder', comment: '' },
  { text: '│   ├── index.ts', type: 'file', comment: 'App entry, window, tray, splash flow' },
  { text: '│   ├── updater.ts', type: 'file', comment: 'Auto-updater + splash preload' },
  { text: '│   ├── store.ts', type: 'file', comment: 'electron-store schema' },
  { text: '│   ├── trayIcons.ts', type: 'file', comment: 'Base64 tray icon assets' },
  { text: '│   ├── steam/', type: 'folder', comment: '' },
  { text: '│   │   ├── client.ts', type: 'file', comment: 'steamworks.js wrapper + games cache' },
  { text: '│   │   ├── idleManager.ts', type: 'file', comment: 'Multi-game idle process manager' },
  { text: '│   │   ├── worker.ts', type: 'file', comment: 'Child process: steamworks idle worker' },
  { text: '│   │   ├── steamPaths.ts', type: 'file', comment: 'Steam install path & VDF helpers' },
  { text: '│   │   └── steamUser.ts', type: 'file', comment: 'Account manager (QR/cookie login)' },
  { text: '│   └── ipc/handlers.ts', type: 'file', comment: 'All IPC channel registrations' },
  { text: '├── preload/index.ts', type: 'file', comment: 'Secure contextBridge API' },
  { text: '├── renderer/', type: 'folder', comment: '' },
  { text: '│   ├── components/', type: 'folder', comment: 'TitleBar, Sidebar, UpdateBanner, SetupScreen' },
  { text: '│   ├── pages/', type: 'folder', comment: 'Home, Games, Achievements, Settings, Idle' },
  { text: '│   ├── hooks/', type: 'folder', comment: 'useAppContext, useTheme, useUpdater' },
  { text: '│   └── styles/global.css', type: 'file', comment: '' },
  { text: '└── shared/types.ts', type: 'file', comment: 'Shared types, IPC channels & default settings' }
];

let treeSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 560" width="100%">
  <rect width="850" height="560" rx="10" fill="#1e1f22" />
  
  <circle cx="20" cy="20" r="6" fill="#ff5f56" />
  <circle cx="40" cy="20" r="6" fill="#ffbd2e" />
  <circle cx="60" cy="20" r="6" fill="#27c93f" />
  
  <text x="425" y="24" font-family="-apple-system, sans-serif" font-size="12" fill="#8b949e" text-anchor="middle">Project Structure</text>
  <line x1="0" y1="40" x2="850" y2="40" stroke="#313338" stroke-width="2"/>

  <g font-family="Consolas, Monaco, 'Courier New', monospace" font-size="14">
`;

let y = 75;
for (const line of treeLines) {
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
  
  let nameColor = line.type === 'folder' || line.type === 'root' ? '#66c0f4' : '#c7d5e0';
  if (line.type === 'root') nameColor = '#ff7b72'; 
  
  treeSvgContent += `    <text x="25" y="${y}" xml:space="preserve"><tspan fill="#484f58">${prefix}</tspan><tspan fill="${nameColor}" font-weight="${line.type === 'folder' ? 'bold' : 'normal'}">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan></text>\n`;
  
  if (line.comment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')) {
    treeSvgContent += `    <text x="400" y="${y}" fill="#8b949e" font-style="italic">// ${line.comment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>\n`;
  }
  
  y += 22;
}

treeSvgContent += `
  </g>
</svg>`;

fs.writeFileSync(path.join(outDir, 'structure.svg'), treeSvgContent);

// 3. Settings SVG
const settingsList = [
  { key: 'Steam API Key', desc: 'Optional — enables full library fetching' },
  { key: 'Steam ID', desc: 'Optional — used alongside API key' },
  { key: 'Custom App IDs', desc: 'Manually add game IDs not in your library' },
  { key: 'Theme', desc: 'Dark / Light / System preference' },
  { key: 'Show global %', desc: '% of players who have each achievement' },
  { key: 'Show hidden achievements', desc: 'Reveal hidden names & descriptions' },
  { key: 'Confirm bulk actions', desc: 'Dialog before unlock-all / lock-all' },
  { key: 'Minimize to tray', desc: 'Keep app alive on close' },
  { key: 'Launch on startup', desc: 'Start automatically with Windows' },
  { key: 'Notifications', desc: 'Desktop notifications + sound toggle' },
  { key: 'Auto-Idle list', desc: 'Games to idle automatically on launch' },
  { key: 'Auto-Invisible when idling', desc: 'Switch status to Invisible while idling' },
  { key: 'Stop idle on game launch', desc: 'Stop all idling if a real game is launched' }
];

let settingsSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 560" width="100%">
  <defs>
    <linearGradient id="setBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#171a21" />
      <stop offset="100%" stop-color="#1b2838" />
    </linearGradient>
    <linearGradient id="rowAlt" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2a475e" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#2a475e" stop-opacity="0.05" />
    </linearGradient>
  </defs>

  <rect width="850" height="560" rx="12" fill="url(#setBg)" stroke="#2a475e" stroke-width="1.5" />

  <!-- Header -->
  <path d="M 0 12 Q 0 0 12 0 L 838 0 Q 850 0 850 12 L 850 48 L 0 48 Z" fill="#1b2838" />
  <circle cx="24" cy="24" r="5" fill="#66c0f4" opacity="0.8" />
  <circle cx="40" cy="24" r="5" fill="#66c0f4" opacity="0.4" />
  <circle cx="56" cy="24" r="5" fill="#66c0f4" opacity="0.2" />

  <text x="80" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#66c0f4" letter-spacing="1">APP SETTINGS &amp; CONFIGURATION</text>
  <line x1="0" y1="48" x2="850" y2="48" stroke="#2a475e" stroke-width="1"/>

  <!-- Table Header -->
  <text x="35" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#8f98a0" letter-spacing="1">SETTING</text>
  <text x="320" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#8f98a0" letter-spacing="1">DESCRIPTION</text>
  <line x1="25" y1="84" x2="825" y2="84" stroke="#2a475e" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- Rows -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13">
`;

let setY = 108;
settingsList.forEach((item, index) => {
  if (index % 2 === 1) {
    settingsSvgContent += `    <rect x="20" y="${setY - 17}" width="810" height="28" rx="6" fill="url(#rowAlt)" />\n`;
  }
  const cleanKey = item.key.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cleanDesc = item.desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  settingsSvgContent += `    <text x="35" y="${setY}" fill="#66c0f4" font-weight="600">${cleanKey}</text>\n`;
  settingsSvgContent += `    <text x="320" y="${setY}" fill="#c7d5e0">${cleanDesc}</text>\n`;
  setY += 31;
});

settingsSvgContent += `
  </g>

  <!-- Footer Banner -->
  <rect x="20" y="505" width="810" height="38" rx="8" fill="#171a21" stroke="#2a475e" stroke-width="1" />
  <text x="425" y="529" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#8f98a0" text-anchor="middle">
    🔒 Stored locally via <tspan fill="#66c0f4" font-family="monospace">electron-store</tspan> • Zero telemetry • 100% offline config
  </text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'settings.svg'), settingsSvgContent);

// 4. Features SVG
const leftFeatures = [
  { icon: '🏆', title: 'Achievement Manager', desc: 'Unlock or lock achievements individually or all at once' },
  { icon: '🔄', title: 'Stats Reset', desc: 'Reset numeric game statistics with a single click' },
  { icon: '📚', title: 'Game Library', desc: 'Browse full Steam library with playtime &amp; progress' },
  { icon: '🎮', title: 'Game Idler', desc: 'Idle any game in the background to accumulate hours' },
  { icon: '⚡', title: 'Auto-Idle', desc: 'Automatically launch idler for selected games on startup' },
  { icon: '👻', title: 'Auto-Invisible', desc: 'Set Steam status to Invisible while idling, auto-restores' },
  { icon: '🛑', title: 'Launch Detection', desc: 'Stops all idling tasks immediately if a real game starts' },
  { icon: '🔐', title: 'Steam Account Login', desc: 'QR code or steamLoginSecure cookie with auto-reconnect' }
];

const rightFeatures = [
  { icon: '📊', title: 'Live Dashboard', desc: 'Playtime stats, top played games &amp; Steam Store deals' },
  { icon: '🔍', title: 'Game Search', desc: 'Search and inspect games in Steam Store from within app' },
  { icon: '🎨', title: 'Dark / Light / System', desc: 'Sleek UI adhering to your native OS theme preference' },
  { icon: '🔔', title: 'Desktop Notifications', desc: 'Instant toast feedback with optional sound effects' },
  { icon: '🔽', title: 'System Tray', desc: 'Minimize to background tray and manage idling on the fly' },
  { icon: '🔄', title: 'Silent Auto-Updater', desc: 'Automatic background update flow via GitHub Releases' },
  { icon: '📦', title: 'App Collection', desc: 'Browse &amp; access companion tools by Thomas Thanos' },
  { icon: '🛡️', title: '100% Offline &amp; Private', desc: 'No cloud sync, zero telemetry, local electron-store' }
];

let featuresSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 560" width="100%">
  <defs>
    <linearGradient id="featBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#171a21" />
      <stop offset="100%" stop-color="#1b2838" />
    </linearGradient>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2a475e" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#1b2838" stop-opacity="0.4" />
    </linearGradient>
  </defs>

  <rect width="850" height="560" rx="12" fill="url(#featBg)" stroke="#2a475e" stroke-width="1.5" />

  <!-- Header -->
  <path d="M 0 12 Q 0 0 12 0 L 838 0 Q 850 0 850 12 L 850 48 L 0 48 Z" fill="#1b2838" />
  <circle cx="24" cy="24" r="5" fill="#66c0f4" opacity="0.8" />
  <circle cx="40" cy="24" r="5" fill="#66c0f4" opacity="0.4" />
  <circle cx="56" cy="24" r="5" fill="#66c0f4" opacity="0.2" />

  <text x="80" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#66c0f4" letter-spacing="1">KEY FEATURES &amp; CAPABILITIES</text>
  <line x1="0" y1="48" x2="850" y2="48" stroke="#2a475e" stroke-width="1"/>

  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
`;

// Render Left Column
let featY = 62;
leftFeatures.forEach((item) => {
  featuresSvgContent += `    <rect x="20" y="${featY}" width="395" height="54" rx="8" fill="url(#cardBg)" stroke="#2a475e" stroke-width="1" />\n`;
  featuresSvgContent += `    <text x="34" y="${featY + 22}" font-size="16">${item.icon}</text>\n`;
  featuresSvgContent += `    <text x="60" y="${featY + 22}" font-size="13" font-weight="700" fill="#66c0f4">${item.title}</text>\n`;
  featuresSvgContent += `    <text x="60" y="${featY + 40}" font-size="11" fill="#8f98a0">${item.desc}</text>\n`;
  featY += 60;
});

// Render Right Column
featY = 62;
rightFeatures.forEach((item) => {
  featuresSvgContent += `    <rect x="435" y="${featY}" width="395" height="54" rx="8" fill="url(#cardBg)" stroke="#2a475e" stroke-width="1" />\n`;
  featuresSvgContent += `    <text x="449" y="${featY + 22}" font-size="16">${item.icon}</text>\n`;
  featuresSvgContent += `    <text x="475" y="${featY + 22}" font-size="13" font-weight="700" fill="#66c0f4">${item.title}</text>\n`;
  featuresSvgContent += `    <text x="475" y="${featY + 40}" font-size="11" fill="#8f98a0">${item.desc}</text>\n`;
  featY += 60;
});

featuresSvgContent += `
  </g>
</svg>`;

fs.writeFileSync(path.join(outDir, 'features.svg'), featuresSvgContent);

console.log('All SVGs generated successfully!');
