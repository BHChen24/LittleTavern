import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/*.live.test.ts", "**/dist/**", "**/node_modules/**"],
    passWithNoTests: true,
  },
});
