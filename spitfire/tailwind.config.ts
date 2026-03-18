import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  "#E6F7F6",
          100: "#B3EAE7",
          200: "#80DDD8",
          300: "#4DD0C9",
          400: "#00A39B",   // PRIMARY ACCENT
          500: "#007A74",
          600: "#005C57",
          700: "#003D3A",
        },
        red: {
          50:  "#FDE8E8",
          100: "#FACBCC",
          200: "#F59A9D",
          300: "#EF6A6E",
          400: "#E54D53",   // WARNING ACCENT
          500: "#C0392B",
          600: "#962D22",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        "xl":  "16px",
        "2xl": "20px",
        "3xl": "24px",
      },
      boxShadow: {
        "glass":   "8px 8px 20px rgba(0,0,0,0.06), -4px -4px 12px rgba(255,255,255,0.80), inset 0 1px 0 rgba(255,255,255,0.70)",
        "inner-g": "4px 4px 12px rgba(0,0,0,0.04), -2px -2px 8px rgba(255,255,255,0.70), inset 0 1px 0 rgba(255,255,255,0.60)",
        "pressed": "inset 3px 3px 8px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.60)",
        "btn":     "4px 4px 10px rgba(0,0,0,0.06), -2px -2px 6px rgba(255,255,255,0.80)",
        "teal":    "0 4px 14px rgba(0,163,155,0.35)",
        "red":     "0 4px 14px rgba(229,77,83,0.30)",
      },
      backdropBlur: {
        "glass": "24px",
        "inner": "12px",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.4s ease-out forwards",
        "scale-in":   "scaleIn 0.3s ease-out forwards",
        "shimmer":    "shimmer 2s infinite",
      },
      keyframes: {
        fadeInUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%":   { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
