import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVercelApp, VERCEL_OUTPUT_DIR } from "./vercel-app.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = resolveVercelApp(process.env.SITESECURE_VERCEL_APP);
const appDir = path.join(root, app.cwd);
const tscBin = path.join(root, "node_modules/typescript/bin/tsc");
const viteBin = path.join(root, "node_modules/vite/bin/vite.js");

function run(bin, args, cwd) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (app.typecheck) {
  run(tscBin, ["-p", "tsconfig.json", "--noEmit"], appDir);
}
run(viteBin, ["build"], appDir);

const from = path.join(root, app.distDir);
if (!existsSync(from)) {
  throw new Error(`Vercel build expected output at ${app.distDir} after ${app.npmScript}`);
}

const to = path.join(root, VERCEL_OUTPUT_DIR);
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log(`vercel-output ← ${app.distDir} (${app.name})`);
