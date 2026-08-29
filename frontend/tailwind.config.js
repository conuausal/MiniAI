/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bdd2fe',
          300: '#92b4fc',
          400: '#608afa',
          500: '#3d65f6',
          600: '#2746ea',
          700: '#1f37d4',
          800: '#1f2faa',
          900: '#1f2d86',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        blink: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        'blink': 'blink 1s steps(2) infinite',
      },
    },
  },
  plugins: [],
};
