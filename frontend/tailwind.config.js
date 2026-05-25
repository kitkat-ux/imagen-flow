/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0a0a0a',
        paper: '#fafaf9',
        panel: '#171717',
        line: '#262626',
        accent: '#84cc16',
        warn: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
}
