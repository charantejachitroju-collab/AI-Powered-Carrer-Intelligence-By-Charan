import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_API_BASE_URL || `http://127.0.0.1:${env.PORT || 5000}`;

  return {
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
        "/api": { target: backendTarget, changeOrigin: true },
        "/match-roles": { target: backendTarget, changeOrigin: true },
        "^/dashboard/": { target: backendTarget, changeOrigin: true },
        "/career": { target: backendTarget, changeOrigin: true },
        "/skills": { target: backendTarget, changeOrigin: true },
        "/roadmaps": { target: backendTarget, changeOrigin: true },
        "/progress": { target: backendTarget, changeOrigin: true },
        "/resume": { target: backendTarget, changeOrigin: true },
        "/jobs": { target: backendTarget, changeOrigin: true },
        "/interview": { target: backendTarget, changeOrigin: true },
        "/mock-interviews": { target: backendTarget, changeOrigin: true },
        "/recommendations": { target: backendTarget, changeOrigin: true },
        "/drives": { target: backendTarget, changeOrigin: true },
        "/documents": { target: backendTarget, changeOrigin: true },
        "/certificates": { target: backendTarget, changeOrigin: true },
        "/settings": { target: backendTarget, changeOrigin: true },
        "/feedback": { target: backendTarget, changeOrigin: true },
      },
    },
  };
});
