/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        // Colour lives in styles/globals.css :root. These reference it rather
        // than repeating it — the two files previously held duplicate literals
        // with nothing keeping them in step.
        primary: "var(--color-primary)",
        "primary-dark": "var(--color-primary-dark)",
        space: "var(--color-space)",
        "space-panel": "var(--color-space-panel)",
        "space-border": "var(--color-space-border)",
        "satellite-gold": "#ffd700",
        "satellite-orange": "#ffa726",
        "satellite-blue": "#4a9eff",
        "satellite-purple": "#ba68c8",
        "satellite-green": "#8aff8a",
        "satellite-pink": "#ff80ab",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-tertiary": "var(--color-text-tertiary)",
        // Deprecated alias, kept so nothing breaks mid-refactor.
        "text-muted": "var(--color-text-secondary)",
      },
      fontFamily: {
        // Use the faces next/font actually loads. `mono` used to be hardcoded
        // to "Monaco", so the Roboto Mono being downloaded on every page load
        // never rendered, and Inter was never mapped to any utility.
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // A scale, so sizes stop being per-component guesses. Paired line
        // heights: tight for dense readouts, looser for prose.
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.875rem", { lineHeight: "1.4rem" }],
        lg: ["1rem", { lineHeight: "1.5rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.02em" }],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 20s linear infinite",
      },
    },
  },
  plugins: [],
};
