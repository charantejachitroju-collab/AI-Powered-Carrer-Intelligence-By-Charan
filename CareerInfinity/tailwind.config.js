/** @type {import('tailwindcss').Config} */
export default {
  content: ["./dashboard-app.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        lavender: "var(--soft)",
        violet: {
          50: "var(--soft)",
          100: "var(--soft)",
          200: "var(--line)",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "var(--brand)",
          700: "var(--brand)",
          800: "#4c3d9a",
          900: "#382b75",
        },
        navy: "var(--ink)",
      },
      boxShadow: {
        soft: "var(--shadow)",
      },
    },
  },
  plugins: [],
};
