import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    exclude: ["**/*.live.test.ts", "**/dist/**", "**/node_modules/**"],
    passWithNoTests: true,
  },
});
