module.exports = {
  content: [
    "./_layouts/**/*.html",
    "./_includes/**/*.html",
    "./_posts/**/*.md",
    "./*.md",
    "./*.html"
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        "background": "var(--wl-background-color)",
        "on-background": "var(--wl-foreground-color)",
        "surface": "var(--wl-surface-color)",
        "on-surface": "var(--wl-on-surface-color)",
        "on-surface-variant": "var(--wl-on-surface-variant-color)",
        "on-primary": "var(--wl-on-primary-color)",
        "surface-container-lowest": "var(--wl-surface-lowest-color)",
        "surface-container-low": "var(--wl-surface-low-color)",
        "surface-container": "var(--wl-surface-container-color)",
        "surface-container-high": "var(--wl-surface-high-color)",
        "outline-variant": "var(--wl-outline-variant-color)",
        "primary": "oklch(0.58 0.21 29)"
      },
      fontFamily: {
        "headline": ["Fraunces", "serif"],
        "body": ["Urbanist", "sans-serif"],
        "label": ["Urbanist", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      }
    }
  },
  plugins: []
};
