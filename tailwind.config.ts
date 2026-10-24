import type { Config } from "tailwindcss";

// BuildFlow palette: concrete greys, steel ink, and a safety-orange accent.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#1c2127", 900: "#14181c", 800: "#1c2127", 700: "#2a3038", 600: "#3b434d", 500: "#59626d" },
        concrete: { 50: "#f7f6f3", 100: "#efede8", 200: "#e2dfd7", 300: "#cfcbc0", 400: "#a9a498" },
        safety: { 50: "#fff4ec", 100: "#ffe3cc", 400: "#ff8a3d", 500: "#f26b1d", 600: "#d65611", 700: "#a8420d" },
        // Accessible action colour: white text on it passes WCAG AA (5.2:1).
        // The brighter safety-500 stays for decoration, icons and large display.
        action: { DEFAULT: "#c2410c", hover: "#a8420d", active: "#8a360b" },
        site: { green: "#2f7d4f", blue: "#2c5d8f", yellow: "#c99a06", red: "#b83a2e" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: { xl: "0.875rem" },
      boxShadow: { card: "0 1px 2px rgba(20,24,28,0.06), 0 1px 1px rgba(20,24,28,0.04)" },
    },
  },
  plugins: [],
};
export default config;
