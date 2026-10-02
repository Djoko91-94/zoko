/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./zoko.html",
    "./zoko/**/*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./zoko.js",
    "./zoko/**/*.js",
    "./server.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}