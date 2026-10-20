import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importFile } from "../library.ts";
import { resolveAppPaths } from "../paths.ts";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const directory = process.env.LITTLETAVERN_TEST_CARDS ?? resolve(repoRoot, "../test-cards");
const samples = [
  ["dsh-tavern/lighthouse-card.json", "Character card V3 (JSON)", "灯塔小镇 · 雨夜来信", 2],
  ["dsh-tavern/airline-mvu-card.json", "Character card V3 (JSON)", "云际航空·MVU测试版", 2],
  ["dsh-tavern/ordinary-tavern.json", "Character card V3 (JSON)", "普通酒馆 · 铜铃客栈", 1],
  ["dsh-tavern/avra-complete.json", "Character card V3 (JSON)", "阿芙拉", 6],
  ["dsh-tavern/avra-before.json", "Character card V3 (JSON)", "阿芙拉", 0],
  ["dsh-tavern/avra-after-dialogue.json", "Character card V2 (JSON)", "阿芙拉", 0],
  [
    "dsh-tavern/lighthouse-worldbook.json",
    "Lorebook (SillyTavern world info)",
    "灯塔镇 · 地点与风俗",
    3,
  ],
  ["sillytavern/default_Seraphina.png", "Character card V3 (PNG)", "Seraphina", 4],
  ["sillytavern/Eldoria.json", "Lorebook (SillyTavern world info)", "Eldoria", 4],
] as const;

describe.skipIf(!existsSync(directory))("external local samples", () => {
  it.each(samples)("imports %s", (file, format, name, count) => {
    const home = mkdtempSync(join(tmpdir(), "lt-local-sample-"));
    try {
      const report = importFile(
        resolveAppPaths({ LITTLETAVERN_HOME: home }),
        join(directory, file),
      );
      if (!report.ok) throw new Error(`${report.detected}: ${report.reason}`);
      expect(report.item.format).toBe(format);
      expect(report.item.name).toBe(name);
      const entries =
        report.item.kind === "character"
          ? (report.item.character.lorebook?.entries ?? [])
          : report.item.lorebook.entries;
      expect(entries).toHaveLength(count);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
