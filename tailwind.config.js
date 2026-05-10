/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1a2e',
          card: '#16213e',
          hover: '#0f3460',
          border: '#2a2a50',
          deep: '#0d0d1a',
        },
        accent: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          light: '#a78bfa',
          muted: '#4c1d95',
          bg: '#1e0545',
        },
      },
    },
  },
  plugins: [],
}
