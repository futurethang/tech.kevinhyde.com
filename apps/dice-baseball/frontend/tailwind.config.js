/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stadium Green
        green: {
          900: '#0f2417',
          800: '#1a3d28',
          700: '#1e5631',
          600: '#2d7a47',
          500: '#3d9b5d',
          400: '#4fb871',
          300: '#6dd58f',
        },
        // Dirt Brown
        brown: {
          900: '#2d1f14',
          800: '#4a3425',
          700: '#6b4d36',
          600: '#8b6848',
          500: '#a67c52',
        },
        // Baseball Red
        baseball: {
          red: '#c9302c',
          'red-dark': '#a02622',
        },
        // Gold for special outcomes
        gold: '#fbbf24',
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
