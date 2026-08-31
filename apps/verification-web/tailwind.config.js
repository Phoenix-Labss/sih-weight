/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#0F2942',
          dark: '#0B192C',
          blue: '#1E40AF',
          gold: '#D97706',
          goldDeep: '#B45309',
          emerald: '#059669',
          green: '#047857',
          surface: '#F8FAFC',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'Noto Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 41 66 / 0.05), 0 1px 3px 0 rgb(15 41 66 / 0.04)',
        overlay: '0 10px 25px -5px rgb(15 41 66 / 0.18), 0 8px 10px -6px rgb(15 41 66 / 0.08)',
      },
      maxWidth: {
        screen: '1280px',
      },
    },
  },
  plugins: [],
}
