import { defineConfig, type Plugin } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { requireProductionApiUrl } from "./src/lib/public-api-url";

const srcDir = path.resolve(__dirname, "src");
const sessionModule = path.resolve(srcDir, "lib/session.tsx");
const reactPkg = path.resolve(__dirname, "../../node_modules/react");
const reactDomPkg = path.resolve(__dirname, "../../node_modules/react-dom");

/**
 * OneDrive / non-ASCII workspace paths can make Vite serve the same file as both
 * `/src/...` and `/@fs/C:/...`, which duplicates React context modules (SessionProvider).
 */
function singleInstanceLocalModules(): Plugin {
  return {
    name: "single-instance-local-modules",
    enforce: "pre",
    resolveId(id) {
      const normalized = id.replace(/\\/g, "/");
      if (
        normalized === sessionModule.replace(/\\/g, "/") ||
        normalized.endsWith("/lib/session.tsx") ||
        normalized.endsWith("/lib/session") ||
        /(^|\/)lib\/session(\.tsx)?$/.test(normalized)
      ) {
        return sessionModule;
      }
      return null;
    },
  };
}

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
    plugins: [singleInstanceLocalModules(), tanstackRouter({ quoteStyle: "double" }), react(), tailwindcss()],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": srcDir,
        react: reactPkg,
        "react-dom": reactDomPkg,
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: (env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, ""),
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      host: true,
      proxy: {
        "/api": {
          target: (env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, ""),
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
    },
  };
});
