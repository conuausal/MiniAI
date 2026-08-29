/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        'var(--bg)',
        'bg-soft': 'var(--bg-soft)',
        surface:   'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border:    'var(--border)',
        text:      'var(--text)',
        'text-soft': 'var(--text-soft)',
        'text-mute': 'var(--text-mute)',
        primary:   'var(--primary)',
        'accent-pink':   'var(--accent-pink)',
        'accent-purple': 'var(--accent-purple)',
        'accent-indigo': 'var(--accent-indigo)',
        'accent-teal':   'var(--accent-teal)',
        'accent-cyan':   'var(--accent-cyan)',
        'accent-mint':   'var(--accent-mint)',
        'accent-orange': 'var(--accent-orange)',
        'accent-yellow': 'var(--accent-yellow)',
        'accent-red':    'var(--accent-red)',
        brand: {
          500: 'var(--primary)',
          600: 'var(--primary)',
        },
      },
      fontFamily: {
        sans:    ['var(--font-sans)'],
        serif:   ['var(--font-serif)'],
        display: ['var(--font-display)'],
        mono:    ['var(--font-mono)'],
      },
      borderRadius: {
        'xl2': '14px',
        'xl3': '20px',
        'xl4': '28px',
      },
      boxShadow: {
        'soft-xs': 'var(--shadow-xs)',
        'soft-sm': 'var(--shadow-sm)',
        'soft-md': 'var(--shadow-md)',
        'soft-lg': 'var(--shadow-lg)',
        'soft-xl': 'var(--shadow-xl)',
        'glow-blue':   'var(--shadow-glow-blue)',
        'glow-pink':   'var(--shadow-glow-pink)',
        'glow-purple': 'var(--shadow-glow-purple)',
      },
      backdropBlur: {
        xs: '4px',
        '4xl': '72px',
      },
    },
  },
  plugins: [],
};
