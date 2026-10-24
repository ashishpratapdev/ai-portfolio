/** Colours are CSS variables (rgb channels) so the public site can be dark while the admin stays light. */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: c("paper"), surface: c("surface"), ink: c("ink"), muted: c("muted"), line: c("line"),
        teal: { DEFAULT: c("accent"), dark: c("accent-strong") }, onaccent: c("on-accent"), mark: c("mark"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
