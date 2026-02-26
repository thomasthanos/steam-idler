/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
  ],
  // We use a .light class on <html> instead of 'media' strategy
  darkMode: ['class', '.dark'],
  theme: {
    extend: {
      colors: {
        ui: {
          bg:        'var(--bg)',
          surface:   'var(--surface)',
          panel:     'var(--panel)',
          card:      'var(--card)',
          border:    'var(--border)',
          borderhov: 'var(--borderhov)',
          accent:    'var(--accent)',
          accenthov: 'var(--accenthov)',
          green:     'var(--green)',
          red:       'var(--red)',
          purple:    'var(--purple)',
          text:      'var(--text)',
          sub:       'var(--sub)',
          muted:     'var(--muted)',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', '"Fira Code"', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 0.35s ease-out both',
        'fade-in': 'fadeIn 0.25s ease-out both',
        'shimmer': 'shimmer 1.8s infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400% 0' },
          '100%': { backgroundPosition: '400% 0' },
        },
      },
    },
  },
  plugins: [],
}
