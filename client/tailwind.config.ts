import type { Config } from "tailwindcss";

/**
 * Jetons de conception du Géoportail du Parc National de Belezma.
 * Palette et typographie reprises à l'identique du prototype (§10).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "forest-deep": "#16332A",
        forest: "#2D6A4F",
        "forest-light": "#74A78E",
        earth: "#8A5A34",
        sand: "#F1EAD9",
        paper: "#FBF9F4",
        gold: "#B8912C",
        ink: "#1E2620",
        iucn: {
          cr: "#B91C1C",
          en: "#DC2626",
          vu: "#EA580C",
          nt: "#CA8A04",
          lc: "#16A34A",
          dd: "#6B7280",
        },
      },
      fontFamily: {
        display: ["'Fraunces Variable'", "Fraunces", "Georgia", "serif"],
        sans: ["'Public Sans Variable'", "'Public Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        // Échelle éditoriale — ratio 1,25, interlignage serré sur les titres.
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
        lg: ["1.0625rem", { lineHeight: "1.625rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "1.9rem", letterSpacing: "-0.01em" }],
        "3xl": ["1.875rem", { lineHeight: "2.2rem", letterSpacing: "-0.015em" }],
        "4xl": ["2.375rem", { lineHeight: "2.6rem", letterSpacing: "-0.02em" }],
        "5xl": ["3.125rem", { lineHeight: "3.3rem", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        // Échelle délibérée : 4 px sur les contrôles, 8 px sur les cartes,
        // 0 sur les tableaux de données (§10).
        control: "4px",
        card: "8px",
        none: "0",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(30, 38, 32, 0.06), 0 8px 24px -12px rgba(30, 38, 32, 0.18)",
        raised: "0 2px 4px rgba(30, 38, 32, 0.08), 0 16px 40px -20px rgba(30, 38, 32, 0.28)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      },
      spacing: {
        // Pas de 4 px, avec deux crans hauts pour les bandeaux éditoriaux.
        18: "4.5rem",
        22: "5.5rem",
        128: "32rem",
      },
      transitionDuration: {
        instant: "80ms",
        quick: "140ms",
        calm: "240ms",
      },
      backgroundImage: {
        // Motif de courbes de niveau — élément signature repris du prototype.
        contours:
          "repeating-radial-gradient(circle at 22% 34%, rgba(45,106,79,0.055) 0 1px, transparent 1px 22px), repeating-radial-gradient(circle at 78% 68%, rgba(138,90,52,0.045) 0 1px, transparent 1px 28px)",
        "contours-dark":
          "repeating-radial-gradient(circle at 22% 34%, rgba(116,167,142,0.10) 0 1px, transparent 1px 22px), repeating-radial-gradient(circle at 78% 68%, rgba(184,145,44,0.08) 0 1px, transparent 1px 28px)",
      },
      screens: {
        xs: "360px",
      },
    },
  },
  plugins: [],
} satisfies Config;
