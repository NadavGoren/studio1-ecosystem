/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Monochrome technical theme
        paper: '#ffffff',
        canvas: '#f5f5f5',
        ink: '#000000',
        'ink-light': '#666666',
        'ink-lighter': '#999999',
        border: '#e0e0e0',
        'border-dark': '#cccccc',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}









