import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Isolated runner for C:\\ssv1 junction: skip setup.ts realpath that contains `&`.
 * Tests that need jest-dom should import `@testing-library/jest-dom/vitest` themselves.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { preserveSymlinks: true },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: [],
    css: false,
  },
});
