const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', '.github', 'assets');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Banner
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
    <text x="400" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="56" font-weight="900" fill="#66c0f4" text-anchor="middle" letter-spacing="2">SOUVLATZIDIKO UNLOCKER</text>
  </g>
  <text x="400" y="150" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18" font-weight="400" fill="#c7d5e0" text-anchor="middle" letter-spacing="1">STEAM ACHIEVEMENT MANAGER &amp; GAME IDLER</text>
</svg>`;

// Divider
const dividerSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 20" width="100%">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#66c0f4" stop-opacity="0" />
      <stop offset="50%" stop-color="#66c0f4" stop-opacity="1" />
      <stop offset="100%" stop-color="#66c0f4" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect x="0" y="9" width="800" height="2" fill="url(#grad)" rx="1" />
</svg>`;

// Badges
function createBadge(leftText, rightText, color) {
  const leftWidth = leftText.length * 7 + 20;
  const rightWidth = rightText.length * 7 + 20;
  const total = leftWidth + rightWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="24">
  <clipPath id="rc"><rect width="${total}" height="24" rx="4"/></clipPath>
  <g clip-path="url(#rc)">
    <rect width="${leftWidth}" height="24" fill="#2a475e"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="24" fill="${color}"/>
  </g>
  <g fill="#fff" font-family="Verdana,sans-serif" font-size="11" font-weight="bold">
    <text x="${leftWidth/2}" y="16" text-anchor="middle">${leftText}</text>
    <text x="${leftWidth + rightWidth/2}" y="16" text-anchor="middle">${rightText}</text>
  </g>
</svg>`;
}

// Icon Gamepad
const iconGamepadSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24">
  <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 9 18.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="#66c0f4"/>
</svg>`;

// Footer
const footerSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 40" width="300">
  <text x="150" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="#8b949e" text-anchor="middle">Engineered by Thomas Thanos</text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'banner.svg'), bannerSVG);
fs.writeFileSync(path.join(outDir, 'divider.svg'), dividerSVG);
fs.writeFileSync(path.join(outDir, 'icon-gamepad.svg'), iconGamepadSVG);
fs.writeFileSync(path.join(outDir, 'badge-ts.svg'), createBadge('build', 'TypeScript', '#3178C6'));
fs.writeFileSync(path.join(outDir, 'badge-electron.svg'), createBadge('framework', 'Electron', '#47848F'));
fs.writeFileSync(path.join(outDir, 'badge-react.svg'), createBadge('ui', 'React 18', '#61DAFB'));
fs.writeFileSync(path.join(outDir, 'badge-license.svg'), createBadge('license', 'Proprietary', '#d92626'));
fs.writeFileSync(path.join(outDir, 'footer-author.svg'), footerSVG);

console.log('SVGs generated successfully');
