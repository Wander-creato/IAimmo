import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#05070f",
        foreground: "#f5f7ff",
        card: "#0d1220",
        border: "#263149",
        muted: "#8c97b2",
        accent: "#57b6ff",
      },
      fontFamily: {
        sans: ["Inter", "Geist", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass:
          "0 8px 32px 0 rgba(28, 41, 73, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      },
      backgroundImage: {
        glass:
          "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
      },
    },
  },
  plugins: [],
};

export default config;
