/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    // Breakpoints: mobile-first layout starts at 320px body min-width; xs supports compact phones, md switches record cards to tables, lg enables desktop multi-column dashboards.
    screens: {
      xs: "360px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      // Brand color scale: Sakura pink is the primary action/accent, ink is the neutral text/surface scale, and cream is the warm page background.
      colors: {
        brand: {
          50: "#fff1f8",
          100: "#ffe3f0",
          200: "#ffc6df",
          300: "#ff9bc6",
          400: "#fb6fac",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
          800: "#9d174d",
          900: "#831843",
        },
        ink: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#090f1f",
        },
        cream: {
          50: "#fffaf5",
          100: "#fff4e8",
          200: "#ffe4c7",
        },
        sakura: "#ec4899",
        night: "#090f1f",
      },
      // Spacing rhythm: page tokens are horizontal gutters; section tokens define vertical whitespace for repeated page blocks.
      spacing: {
        page: "1rem",
        "page-sm": "1.5rem",
        "page-lg": "2rem",
        section: "4rem",
        "section-lg": "7rem",
      },
      // Shape language: card radius is used for elevated surfaces; pill is reserved for nav chips and badges.
      borderRadius: {
        card: "1.75rem",
        pill: "999px",
      },
      // Typography: Pretendard first for Korean UI legibility, Inter/system fallbacks for Latin and platform consistency.
      fontFamily: {
        sans: [
          "Pretendard",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "Pretendard",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      // Display type: hero uses a clamp so the home heading scales across mobile, tablet, and desktop without custom page CSS.
      fontSize: {
        hero: [
          "clamp(2.5rem,8vw,5.5rem)",
          { lineHeight: "0.95", letterSpacing: "-0.06em" },
        ],
      },
      boxShadow: {
        soft: "0 18px 55px -28px rgb(15 23 42 / 0.35)",
        brand: "0 18px 45px -22px rgb(236 72 153 / 0.65)",
      },
      backgroundImage: {
        "brand-radial":
          "radial-gradient(circle at top left, #ffe3f0, transparent 34rem), radial-gradient(circle at bottom right, #dbeafe, transparent 28rem)",
      },
    },
  },
  plugins: [],
};
