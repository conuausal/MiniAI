/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 用 CSS 变量，让主题切换无需重新生成 class
        bg:        'var(--bg)',
        'bg-soft': 'var(--bg-soft)',
        surface:   'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border:    'var(--border)',
        text:      'var(--text)',
        'text-soft': 'var(--text-soft)',
        'text-mute': 'var(--text-mute)',
        brand: {
          50:  'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
        },
        accent: {
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
        },
        warm: {
          500: 'var(--warm-500)',
          600: 'var(--warm-600)',
        },
      },
      fontFamily: {
        sans:   ['var(--font-sans)'],
        serif:  ['var(--font-serif)'],
        mono:   ['var(--font-mono)'],
      },
      borderRadius: {
        'xl2': '14px',
        'xl3': '20px',
      },
      boxShadow: {
        'soft-xs': 'var(--shadow-xs)',
        'soft-sm': 'var(--shadow-sm)',
        'soft-md': 'var(--shadow-md)',
        'soft-lg': 'var(--shadow-lg)',
        'soft-xl': 'var(--shadow-xl)',
      },
    },
  },
  plugins: [],
};
