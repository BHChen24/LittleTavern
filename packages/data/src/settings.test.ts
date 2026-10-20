import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { resolveAppPaths } from "./paths.ts";
import { readSettings, writeSettings } from "./settings.ts";

it("round-trips the model preference and falls back for missing or malformed settings", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-settings-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  try {
    expect(readSettings(paths)).toEqual({});
    writeSettings(paths, { model: "openai/gpt-4o-mini" });
    expect(readSettings(paths)).toEqual({ model: "openai/gpt-4o-mini" });
    for (const value of ["invalid", "null", "[]", '{"model":3}']) {
      writeFileSync(paths.settingsFile, value);
      expect(readSettings(paths)).toEqual({});
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
