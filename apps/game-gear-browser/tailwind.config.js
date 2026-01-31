/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gg-dark': '#0a0a12',
        'gg-darker': '#05050a',
        'gg-blue': '#1a1a2e',
        'gg-accent': '#16213e',
        'gg-teal': '#0f3460',
        'gg-highlight': '#e94560',
        'gg-screen': '#9bbc0f',
        'gg-screen-dark': '#306230',
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
      }
    },
  },
  plugins: [],
}
