import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: { include: ["packages/*/src/**/*.live.test.ts"] },
});
