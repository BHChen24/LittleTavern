import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importFile, resolveAppPaths } from "../index.ts";
import { assemblePrompt } from "./assemble.ts";
import { chat } from "./fixtures.ts";
import { placementOf } from "./lore.ts";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const directory = process.env.LITTLETAVERN_TEST_CARDS ?? resolve(repoRoot, "../test-cards");
const samples = [
  ["dsh-tavern/lighthouse-card.json", 2],
  ["dsh-tavern/airline-mvu-card.json", 2],
  ["dsh-tavern/ordinary-tavern.json", 1],
  ["dsh-tavern/avra-complete.json", 6],
  ["dsh-tavern/avra-before.json", 0],
  ["dsh-tavern/avra-after-dialogue.json", 0],
  ["sillytavern/default_Seraphina.png", 4],
] as const;

describe.skipIf(!existsSync(directory))("local sample assembly", () => {
  it.each(samples)("accounts for every entry in %s", (file, count) => {
    const home = mkdtempSync(join(tmpdir(), "lt-assembly-sample-"));
    try {
      const report = importFile(
        resolveAppPaths({ LITTLETAVERN_HOME: home }),
        join(directory, file),
      );
      if (!report.ok) throw new Error(report.reason);
      if (report.item.kind !== "character") throw new Error("Expected character card");
      const character = report.item.character;
      const entries = character.lorebook?.entries ?? [];
      const { prompt, trace } = assemblePrompt({ character, history: chat("你好", "……") });
      expect(entries).toHaveLength(count);
      expect(trace.lore).toHaveLength(entries.length);
      expect(trace.lore.map((item) => item.index)).toEqual(entries.map((_, index) => index));
      expect(prompt.system.trim().length).toBeGreaterThan(0);
      expect(trace.lore.every((item) => typeof item.reason.kind === "string")).toBe(true);
      if (file.endsWith("default_Seraphina.png")) {
        // These greetings need not activate lore; verify placement for every imported entry.
        expect(entries.map(placementOf)).toEqual(["before", "before", "before", "before"]);
        expect(
          trace.lore.filter((item) => item.included).every((item) => item.placement === "before"),
        ).toBe(true);
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
