import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listLibrary, readSettings, resolveAppPaths } from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { startApp } from "./app.ts";
import { runCli } from "./cli.ts";
import { examplesDir } from "./examples-dir.ts";

vi.mock("./examples-dir.ts", () => ({ examplesDir: vi.fn() }));
vi.mock("./app.ts", () => ({ startApp: vi.fn(async () => {}) }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it.each([false, true])(
  "starts interactively after example setup, settings blocked: %s",
  async (blocked) => {
    const home = mkdtempSync(join(tmpdir(), "lt-cli-startup-"));
    vi.stubEnv("LITTLETAVERN_HOME", home);
    const paths = resolveAppPaths();
    const examples = join(home, "examples");
    mkdirSync(join(examples, "characters"), { recursive: true });
    mkdirSync(join(examples, "lorebooks"), { recursive: true });
    writeFileSync(
      join(examples, "characters/alice.json"),
      JSON.stringify({ spec: "chara_card_v3", data: { name: "Alice" } }),
    );
    writeFileSync(
      join(examples, "lorebooks/wonderland.json"),
      JSON.stringify({ name: "Wonderland", entries: {} }),
    );
    vi.mocked(examplesDir).mockReturnValue(examples);
    try {
      if (blocked) mkdirSync(paths.settingsFile, { recursive: true });
      expect(await runCli([])).toBe(0);
      expect(
        listLibrary(paths)
          .map((item) => item.name)
          .sort(),
      ).toEqual(["Alice", "Wonderland"]);
      expect(startApp).toHaveBeenCalledOnce();
      expect(startApp).toHaveBeenCalledWith({
        startupNotices: blocked ? [expect.stringContaining("could not save settings")] : [],
      });
      expect(readSettings(paths).examplesAdded).toBe(blocked ? undefined : true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  },
);
