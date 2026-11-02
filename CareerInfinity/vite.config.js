import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: {
        dashboard: "dashboard-app.html",
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5000",
      "/match-roles": "http://127.0.0.1:5000",
      "^/dashboard/": "http://127.0.0.1:5000",
      "/career": "http://127.0.0.1:5000",
      "/skills": "http://127.0.0.1:5000",
      "/resume": "http://127.0.0.1:5000",
      "/jobs": "http://127.0.0.1:5000",
      "/interview": "http://127.0.0.1:5000",
      "/recommendations": "http://127.0.0.1:5000",
      "/drives": "http://127.0.0.1:5000",
      "/documents": "http://127.0.0.1:5000",
      "/certificates": "http://127.0.0.1:5000",
      "/settings": "http://127.0.0.1:5000",
      "/feedback": "http://127.0.0.1:5000",
    },
  },
});
