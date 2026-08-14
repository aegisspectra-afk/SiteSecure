import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { requireProductionApiUrl } from "./src/lib/public-api-url";

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, "../..");
  const rootEnv = loadEnv(mode, rootDir, "");
  const localEnv = loadEnv(mode, __dirname, "");
  const env = { ...localEnv, ...rootEnv, ...process.env };
  const hosted = process.env.VERCEL === "1";
  if (hosted && /localhost|127\.0\.0\.1/i.test(env.VITE_API_URL ?? "")) {
    env.VITE_API_URL = "";
    process.env.VITE_API_URL = "";
  }
  if (mode === "production") {
    requireProductionApiUrl(env.VITE_API_URL, hosted);
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for production web builds");
    }
  }
  return {
    envDir: hosted ? path.resolve(__dirname, "vercel-env") : rootEnv.VITE_SUPABASE_URL || rootEnv.VITE_API_URL ? rootDir : __dirname,
    define: hosted
      ? { "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL || "") }
      : undefined,
    plugins: [tanstackRouter({ quoteStyle: "double" }), react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
      host: true,
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
    },
  };
});
