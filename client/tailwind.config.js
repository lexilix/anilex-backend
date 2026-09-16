/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
      },
      colors: {
        brand: {
          50: '#f6f6f7',
          100: '#e1e2e5',
          200: '#c5c6cc',
          300: '#a3a4af',
          400: '#7f8090',
          500: '#646577',
          600: '#4f505f',
          700: '#3f404c',
          800: '#2c2d35',
          900: '#18191f',
          950: '#0f1013',
        }
      }
    },
  },
  plugins: [],
}
