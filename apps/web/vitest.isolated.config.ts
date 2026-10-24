import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Isolated runner for C:\\ssv1 junction: skip setup.ts realpath that contains `&`. */
export default defineConfig({
  plugins: [react()],
  resolve: { preserveSymlinks: true },
  test: {
    environment: "node",
    globals: false,
    setupFiles: [],
  },
});
