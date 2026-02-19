/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: '#070d1a',
          secondary: '#0d1a2e',
          card: 'rgba(13,26,46,0.85)',
        },
        accent: {
          primary: '#17c5c8',
          dim: '#17a2b8',
          danger: '#E53E3E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-teal': '0 0 15px rgba(23,197,200,0.5)',
        'glow-teal-lg': '0 0 30px rgba(23,197,200,0.4)',
      },
    },
  },
  plugins: [],
}
