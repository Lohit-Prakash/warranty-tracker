/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0effe',
          100: '#e4e1fd',
          200: '#ccc7fb',
          300: '#aba2f7',
          400: '#8876f1',
          500: '#6d51e8',
          600: '#534AB7',
          700: '#4a3fa0',
          800: '#3d3482',
          900: '#332d6b',
        }
      }
    }
  },
  plugins: []
}
