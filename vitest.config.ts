import { defineConfig } from "vitest/config";

// Only the Action's own unit tests — never the runner examples under examples/ (those run under
// their own runners: jest/playwright/cypress, not vitest).
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
  },
});
