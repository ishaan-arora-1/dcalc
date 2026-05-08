import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 15, 15, 0.04), 0 4px 16px rgba(15, 15, 15, 0.04)",
        soft: "0 1px 1px rgba(15, 15, 15, 0.03)",
      },
    },
  },
  plugins: [],
} satisfies Config;
