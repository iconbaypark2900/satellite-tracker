/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        // Satellite / space-themed palette
        primary: "#4137ff",
        "primary-dark": "#2a25a3",
        space: "#05051a",
        "space-panel": "rgba(10,10,20,0.92)",
        "satellite-gold": "#ffd700",
        "satellite-orange": "#ffa726",
        "satellite-blue": "#4a9eff",
        "satellite-purple": "#ba68c8",
        "satellite-green": "#8aff8a",
        "satellite-pink": "#ff80ab",
        "text-primary": "#e0e0ff",
        "text-secondary": "#6f6d69",
      },
      fontFamily: {
        mono: ["'Monaco'", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 20s linear infinite",
      },
    },
  },
  plugins: [],
};
