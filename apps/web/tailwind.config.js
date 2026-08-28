/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        farm: {
          50: '#f2f9f3',
          100: '#e1f2e4',
          500: '#2e7d32',
          600: '#256729',
          700: '#1e5220',
          800: '#1b411d',
          900: '#163618',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Segoe UI', 'Tahoma', 'Arial', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
