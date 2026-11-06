/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f0f0f",
        fg: "#f2f2f2",
        accent: {
          DEFAULT: "#FAFF00",
        },
        border: {
          DEFAULT: "#b3b3b3",
        },
        muted: {
          DEFAULT: "#262626",
          text: "#b3b3b3",
        },
        plus: {
          DEFAULT: "#4ade80",
          bg: "rgba(74,222,128,0.15)",
        },
        minus: {
          DEFAULT: "#f87171",
          bg: "rgba(248,113,113,0.15)",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        none: "0",
        0: "0",
      },
      boxShadow: {
        brutal: "4px 4px 0px #FAFF00",
        "brutal-sm": "2px 2px 0px #FAFF00",
        none: "none",
      },
      letterSpacing: {
        label: "0.1em",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};