import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { assertWorkforceProductionEnv } from "./src/lib/production-env";

function publicClientEnv(env: Record<string, string>, mode: string) {
  const allowLoopback = mode === "development" || mode === "test";
  const supabaseUrl = allowLoopback
    ? env.VITE_SUPABASE_URL || env.SUPABASE_URL || ""
    : env.VITE_SUPABASE_URL || "";
  const supabaseAnon = allowLoopback
    ? env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ""
    : env.VITE_SUPABASE_ANON_KEY || "";
  const apiUrl = (
    allowLoopback
      ? env.VITE_API_URL || env.API_PUBLIC_URL || "http://localhost:8000"
      : env.VITE_API_URL || ""
  ).replace(/\/$/, "");
  const configuredHome = (env.VITE_PLATFORM_HOME_URL || "").trim();
  const platformHome = allowLoopback
    ? configuredHome || "http://localhost:5173/platform"
    : configuredHome;
  if (mode === "production") {
    const required = assertWorkforceProductionEnv({
      VITE_API_URL: apiUrl,
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: supabaseAnon,
      VITE_PLATFORM_HOME_URL: platformHome,
    });
    process.env.VITE_SUPABASE_URL = required.supabaseUrl;
    process.env.VITE_SUPABASE_ANON_KEY = required.supabaseAnon;
    process.env.VITE_API_URL = required.apiUrl;
    process.env.VITE_PLATFORM_HOME_URL = required.platformHome;
    return required;
  }
  if (supabaseUrl) process.env.VITE_SUPABASE_URL = supabaseUrl;
  if (supabaseAnon) process.env.VITE_SUPABASE_ANON_KEY = supabaseAnon;
  if (!process.env.VITE_API_URL) process.env.VITE_API_URL = apiUrl;
  process.env.VITE_PLATFORM_HOME_URL = platformHome;
  return { supabaseUrl, supabaseAnon, apiUrl, platformHome };
}

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, "../..");
  const rootEnv = loadEnv(mode, rootDir, "");
  const localEnv = loadEnv(mode, __dirname, "");
  const env = { ...rootEnv, ...localEnv, ...process.env };
  const publicEnv = publicClientEnv(env, mode);
  const apiTarget = publicEnv.apiUrl;

  return {
    envDir: localEnv.VITE_SUPABASE_URL || localEnv.VITE_API_URL ? __dirname : rootDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      preserveSymlinks: true,
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5175,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4175,
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "node",
      environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    },
  };
});
