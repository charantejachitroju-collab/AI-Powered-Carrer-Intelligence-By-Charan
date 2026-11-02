/** @type {import('tailwindcss').Config} */
export default {
  content: ["./dashboard-app.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        lavender: "#f5f3ff",
        violet: "#6d5bd0",
        navy: "#111827",
      },
      boxShadow: {
        soft: "0 12px 35px rgba(37, 40, 77, 0.06)",
      },
    },
  },
  plugins: [],
};
