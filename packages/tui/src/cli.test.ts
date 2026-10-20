import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  importFile,
  listLibrary,
  readSettings,
  resolveAppPaths,
  writeSettings,
} from "@littletavern/engine";
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

it("dry-runs a character request as text or JSON without a key, and rejects unknown ids", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-cli-dry-run-"));
  vi.stubEnv("LITTLETAVERN_HOME", home);
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const file = join(home, "mira.json");
  writeFileSync(
    file,
    JSON.stringify({
      spec: "chara_card_v3",
      data: {
        name: "Mira",
        first_mes: "Welcome.",
        character_book: { entries: [{ keys: ["lighthouse"], content: "Haunted." }] },
      },
    }),
  );
  const output: string[] = [];
  const out = (text: string) => {
    output.push(text);
  };
  try {
    await runCli(["import", file], out);
    const id = listLibrary(resolveAppPaths())[0]?.id ?? "";
    output.length = 0;
    expect(await runCli(["dry-run", id, "--message", "the lighthouse"], out)).toBe(0);
    expect(output[0]).toContain("Mira ·");
    expect(output).toContain("Lore fired (1)");
    expect(output).toContain("── Request ──");
    expect(output).toContain("the lighthouse");
    output.length = 0;
    expect(await runCli(["dry-run", id], out)).toBe(0);
    expect(output).toContain(
      "(No message given: this is the opening of a new chat, greeting only.)",
    );
    output.length = 0;
    expect(await runCli(["dry-run", id, "--json"], out)).toBe(0);
    const parsed = JSON.parse(output.join("\n"));
    expect(Object.keys(parsed)).toEqual(["prompt", "trace"]);
    output.length = 0;
    expect(await runCli(["dry-run", "zzzz"], out)).toBe(1);
    expect(output).toEqual(["Character not found: zzzz"]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it.each(["missing", "invalid"])(
  "reports a %s active persona once on stderr while keeping dry-run stdout as JSON",
  async (state) => {
    const home = mkdtempSync(join(tmpdir(), "lt-cli-persona-"));
    vi.stubEnv("LITTLETAVERN_HOME", home);
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const paths = resolveAppPaths();
    const card = join(home, "mira.json");
    const stdout: string[] = [];
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      writeFileSync(
        card,
        JSON.stringify({
          spec: "chara_card_v3",
          data: {
            name: "Mira",
            description: "Talking to {{user}}.",
            first_mes: "Welcome, {{user}}.",
          },
        }),
      );
      const imported = importFile(paths, card);
      if (!imported.ok) throw new Error(imported.reason);
      writeSettings(paths, { persona: "active.md", userName: "Parker" });
      if (state === "invalid") {
        mkdirSync(paths.importPersonasDir, { recursive: true });
        writeFileSync(join(paths.importPersonasDir, "active.md"), "## Description\nNo name.\n");
      }
      expect(
        await runCli(["dry-run", imported.item.id, "--json"], (text) => stdout.push(text)),
      ).toBe(0);
      expect(stdout).toHaveLength(1);
      const result = JSON.parse(stdout[0] ?? "");
      expect(Object.keys(result)).toEqual(["prompt", "trace"]);
      expect(result.prompt.system).toContain("Talking to Parker.");
      expect(result.prompt.history[0].text).toBe("Welcome, Parker.");
      expect(result.trace.parts.map((part: { source: string }) => part.source)).not.toContain(
        "persona",
      );
      expect(stderr).toHaveBeenCalledTimes(1);
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining("active.md"));
    } finally {
      stderr.mockRestore();
      rmSync(home, { recursive: true, force: true });
    }
  },
);

it("creates from Markdown, prints warnings and preserves the owner's source, including failures", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-cli-create-"));
  vi.stubEnv("LITTLETAVERN_HOME", home);
  const file = join(home, "draft.md");
  const output: string[] = [];
  const out = (text: string) => {
    output.push(text);
  };
  try {
    writeFileSync(file, "## Name\nCLI Creator\n## First message\nWelcome!\n");
    expect(await runCli(["create", file], out)).toBe(0);
    expect(output.join("\n")).toContain("CLI Creator");
    expect(output.join("\n")).toContain("Created with LittleTavern");
    expect(output.join("\n")).toContain("Warning: Missing section: Description");
    expect(listLibrary(resolveAppPaths())).toHaveLength(1);
    expect(readFileSync(file, "utf8")).toContain("CLI Creator");
    writeFileSync(file, "## Description\nStill here.\n");
    expect(await runCli(["create", file], out)).toBe(1);
    expect(output.join("\n")).toContain("A character needs a name.");
    expect(readFileSync(file, "utf8")).toContain("Still here.");
    expect(await runCli(["create"], out)).toBe(1);
    expect(await runCli(["create", file, "extra.md"], out)).toBe(1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it.each(["list", "show", "import", "dry-run", "create"])(
  "%s never adds first-start examples in a fresh selected home",
  async (command) => {
    const home = mkdtempSync(join(tmpdir(), "lt-cli-no-examples-"));
    vi.stubEnv("LITTLETAVERN_HOME", home);
    try {
      await runCli([command], () => {});
      expect(readSettings(resolveAppPaths()).examplesAdded).toBeUndefined();
      expect(listLibrary(resolveAppPaths())).toEqual([]);
      expect(existsSync(resolveAppPaths().importRoot)).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  },
);

it("refuses oversized explicit CLI imports with the shared limit", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-cli-large-"));
  vi.stubEnv("LITTLETAVERN_HOME", home);
  try {
    const file = join(home, "large.json");
    writeFileSync(file, "{}");
    truncateSync(file, 20 * 1024 * 1024 + 1);
    const output: string[] = [];
    expect(await runCli(["import", file], (line) => output.push(line))).toBe(1);
    expect(output.join("\n")).toContain("larger than 20 MB");
    expect(listLibrary(resolveAppPaths())).toEqual([]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
