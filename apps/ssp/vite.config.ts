import { defineConfig } from "vite";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, "../..");
  const rootEnv = loadEnv(mode, rootDir, "");
  const localEnv = loadEnv(mode, __dirname, "");
  const env = { ...rootEnv, ...localEnv, ...process.env };
  const apiTarget = (env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

  return {
    envDir: rootEnv.VITE_SUPABASE_URL || rootEnv.VITE_API_URL ? rootDir : __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      preserveSymlinks: true,
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4174,
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
