/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a1a1a',
        destijl: {
          red: '#d4202a',
          blue: '#1d3fb0',
          yellow: '#f4c20d',
        },
        panel: '#13151a',
        panel2: '#1b1e26',
        edge: '#2a2e38',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
