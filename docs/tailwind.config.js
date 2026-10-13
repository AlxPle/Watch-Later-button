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
        "primary": "var(--wl-primary, oklch(0.58 0.22 27))"
      },
      fontFamily: {
        "headline": ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        "body": ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        "label": ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"]
      }
    }
  },
  plugins: []
};
