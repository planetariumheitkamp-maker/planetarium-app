/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // DOMEMASTER palette (design.md §2)
        void: "#06030F",
        cosmos: "#0B0718",
        nebula: "#150E2B",
        dusk: "#1E1440",
        brand: "#442D7D",
        "violet-hi": "#6B4FBB",
        gold: "#D1B888",
        "gold-hi": "#EBD9AE",
        ink: "#F2EEFB",
        "ink-dim": "#A79DC4",
        "ink-faint": "#5C5378",
        success: "#4ADE80",
        danger: "#F87171",
        line: "#2A2050",
        // shadcn tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        sans: ["Outfit", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "nebula-radial": "radial-gradient(circle at 50% 30%, #442D7D 0%, #0B0718 70%)",
        "gold-sheen": "linear-gradient(120deg, #D1B888, #EBD9AE, #B08D4F)",
        "dome-horizon": "linear-gradient(to top, #1E1440 0%, #0B0718 60%)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "glow-violet": "0 0 40px rgba(107,79,187,0.35)",
        "glow-gold": "0 0 24px rgba(209,184,136,0.25)",
        "glow-gold-lg": "0 0 44px rgba(209,184,136,0.45)",
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      transitionTimingFunction: {
        orbital: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "scroll-cue": {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "25%": { opacity: "1" },
          "100%": { transform: "translateY(28px)", opacity: "0" },
        },
        breathe: {
          from: { opacity: "0.55", transform: "scale(1)" },
          to: { opacity: "1", transform: "scale(1.06)" },
        },
        "orbit-dot": {
          from: { transform: "rotate(0deg) translateX(14px) rotate(0deg)" },
          to: { transform: "rotate(360deg) translateX(14px) rotate(-360deg)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 24px rgba(209,184,136,0.25)" },
          "50%": { boxShadow: "0 0 48px rgba(209,184,136,0.55)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        marquee: "marquee 30s linear infinite",
        "scroll-cue": "scroll-cue 2s ease-in-out infinite",
        breathe: "breathe 12s ease-in-out infinite alternate",
        "orbit-dot": "orbit-dot 8s linear infinite",
        "spin-slow": "spin-slow 40s linear infinite",
        "pulse-gold": "pulse-gold 2.4s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
