import { defineConfig, type Plugin } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { requireLocalSupabaseInDev } from "./src/lib/dev-supabase-guard";
import { requireProductionApiUrl } from "./src/lib/public-api-url";

const srcDir = path.resolve(__dirname, "src");
const sessionModule = path.resolve(srcDir, "lib/session.tsx");
const reactPkg = path.resolve(__dirname, "../../node_modules/react");
const reactDomPkg = path.resolve(__dirname, "../../node_modules/react-dom");

/**
 * OneDrive / non-ASCII workspace paths can make Vite serve the same file as both
 * `/src/...` and `/@fs/C:/...`, which duplicates React context modules (SessionProvider).
 */
/** Preload Hebrew marketing font from built asset hashes (homepage LCP). */
function marketingFontPreload(): Plugin {
  return {
    name: "marketing-font-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle ?? {};
        const heebo = Object.keys(bundle).find((name) => name.includes("heebo-hebrew") && name.endsWith(".woff2"));
        if (!heebo) return html;
        const href = heebo.startsWith("assets/") ? `/${heebo}` : `/assets/${heebo}`;
        const tag = `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin />`;
        return html.replace("</head>", `    ${tag}\n  </head>`);
      },
    },
  };
}

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
  // apps/web/.env.local must win over root defaults (e.g. API port).
  const env = { ...rootEnv, ...localEnv, ...process.env };
  const hosted = process.env.VERCEL === "1";
  if (hosted && /localhost|127\.0\.0\.1/i.test(env.VITE_API_URL ?? "")) {
    env.VITE_API_URL = "";
    process.env.VITE_API_URL = "";
  }
  if (mode === "development" && !hosted) {
    requireLocalSupabaseInDev(env.VITE_SUPABASE_URL, env.VITE_ALLOW_REMOTE_SUPABASE);
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
    plugins: [
      singleInstanceLocalModules(),
      marketingFontPreload(),
      tanstackRouter({ quoteStyle: "double", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    build: {
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (/node_modules[\\/]react-dom[\\/]/.test(id)) return "vendor-react";
            if (/node_modules[\\/]react[\\/]/.test(id)) return "vendor-react";
            if (id.includes("scheduler")) return "vendor-react";
            if (id.includes("pdfjs-dist")) return "vendor-pdf";
            if (id.includes("lottie-web")) return "vendor-lottie";
            if (id.includes("@supabase")) return "vendor-supabase";
            return undefined;
          },
        },
      },
    },
    resolve: {
      // Keep junction/subst paths (C:\ssv1) so Windows `&` in the real OneDrive path
      // cannot split Vite file URLs and serve raw TSX to the browser.
      preserveSymlinks: true,
      dedupe: ["react", "react-dom"],
      alias: {
        "@": srcDir,
        react: reactPkg,
        "react-dom": reactDomPkg,
      },
    },
    optimizeDeps: {
      // Workspace TS packages grow new exports; prebundling freezes a stale client
      // (e.g. missing billingPublic → SiteSecureLanding crash).
      exclude: ["@site-secure/api-client", "@site-secure/authz"],
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
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.{idea,git,cache,output,temp}/**",
        "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
        "**/._*",
        "**/.AppleDouble/**",
      ],
      env: {
        VITE_API_URL: env.VITE_API_URL || "http://127.0.0.1:8001",
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || "test-anon-key-local-only",
      },
    },
  };
});
