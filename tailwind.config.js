/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0b3161',    // Logo ka blue
          orange: '#f58220',  // 'Balance' orange
          red: '#e53e3e',     // Arc red
          grey: '#9ca3af',    // 'Pro' grey
          light: '#f4f7fa',   // Soft background
        },
      },
    },
  },
  plugins: [],
}
