/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          pink: '#FF006E',
          cyan: '#00D9FF',
          purple: '#B700FF',
          yellow: '#FFBE0B',
          green: '#00FF41',
        },
        brutalist: {
          black: '#0a0a0a',
          gray: '#1a1a1a',
          white: '#F5F5F5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        bold: ['Space Mono', 'monospace'],
      },
      fontSize: {
        '2xl': '2rem',
        '3xl': '2.5rem',
        '4xl': '3rem',
      },
      borderWidth: {
        3: '3px',
        4: '4px',
        5: '5px',
      },
      spacing: {
        '2px': '2px',
        '4px': '4px',
      },
    },
  },
  plugins: [],
}
