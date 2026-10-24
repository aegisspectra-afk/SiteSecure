/** Shared Vercel app selector. Default is SITE SECURE web so the existing project stays unchanged. */

export const VERCEL_OUTPUT_DIR = "vercel-output";

export const VERCEL_APPS = {
  web: { npmScript: "web:build", distDir: "apps/web/dist", cwd: "apps/web", typecheck: false },
  workforce: {
    npmScript: "workforce:build",
    distDir: "apps/WorkForce/dist",
    cwd: "apps/WorkForce",
    typecheck: true,
  },
  ssp: { npmScript: "ssp:build", distDir: "apps/ssp/dist", cwd: "apps/ssp", typecheck: true },
};

export function resolveVercelApp(raw) {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  const name = key || "web";
  const app = VERCEL_APPS[name];
  if (!app) {
    throw new Error(
      `SITESECURE_VERCEL_APP must be web, workforce, or ssp (received ${JSON.stringify(raw)})`,
    );
  }
  return { name, ...app };
}
