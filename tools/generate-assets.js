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
    <!-- Reduced font-size from 56 to 46 to fit SOUVLATZIDIKO UNLOCKER -->
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
console.log('structure.svg and fixed hero-banner.svg generated!');
