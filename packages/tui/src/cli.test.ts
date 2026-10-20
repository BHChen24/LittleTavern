import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importFile, listLibrary, resolveAppPaths } from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { runCli } from "./cli.ts";
import { formatItemDetails, formatLibraryList } from "./library-format.ts";

it("prints version without starting the terminal", async () => {
  const output: string[] = [];
  expect(await runCli(["--version"], (text) => output.push(text))).toBe(0);
  expect(output).toEqual(["LittleTavern 0.1.0"]);
});
it("prints documented commands and environment variables", async () => {
  const output: string[] = [];
  await runCli(["--help"], (text) => output.push(text));
  expect(output[0]).toContain("OPENROUTER_API_KEY");
  expect(output[0]).toContain("LITTLETAVERN_HOME");
});

afterEach(() => vi.unstubAllEnvs());
it("imports multiple files with partial failure, lists and shows the shared formatter output", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-cli-library-"));
  vi.stubEnv("LITTLETAVERN_HOME", home);
  const file = join(home, "card.json");
  writeFileSync(
    file,
    JSON.stringify({ spec: "chara_card_v3", data: { name: "CLI synthetic", description: "text" } }),
  );
  const output: string[] = [];
  const out = (text: string) => {
    output.push(text);
  };
  try {
    expect(await runCli(["import", file, join(home, "missing.json")], out)).toBe(1);
    expect(output.some((line) => line.startsWith("✓"))).toBe(true);
    expect(output.some((line) => line.startsWith("✗"))).toBe(true);
    const paths = resolveAppPaths();
    const items = listLibrary(paths);
    expect(items).toHaveLength(1);
    const first = items[0];
    if (!first) throw new Error("Expected imported item");
    output.length = 0;
    expect(await runCli(["list"], out)).toBe(0);
    expect(output).toEqual(formatLibraryList(items));
    output.length = 0;
    expect(await runCli(["show", first.id.slice(0, 6)], out)).toBe(0);
    expect(output).toEqual(formatItemDetails(first));
    expect(await runCli(["show", "missing"], out)).toBe(1);
    expect(await runCli(["import", file], out)).toBe(0);
    expect(output.some((line) => line.startsWith("•"))).toBe(true);
    const second = join(home, "book.json");
    writeFileSync(second, '{"entries":[]}');
    importFile(paths, second);
    expect(await runCli(["show", ""], out)).toBe(1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
