import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { makeV3Card, makeWorldInfo } from "./cards/fixtures.ts";
import { addExamplesOnce } from "./examples.ts";
import { importFile, listLibrary } from "./library.ts";
import { type AppPaths, ensureImportFolders, resolveAppPaths } from "./paths.ts";
import { readSettings, writeSettings } from "./settings.ts";

let home: string;
let paths: AppPaths;
let examples: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-examples-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: join(home, "app") });
  examples = join(home, "examples");
  mkdirSync(join(examples, "characters"), { recursive: true });
  mkdirSync(join(examples, "lorebooks"), { recursive: true });
  writeFileSync(
    join(examples, "characters/alice.json"),
    JSON.stringify(makeV3Card({ name: "Alice" })),
  );
  writeFileSync(join(examples, "lorebooks/wonderland.json"), JSON.stringify(makeWorldInfo()));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

it("creates folders in the selected home, imports and attaches once, and never restores deletions", () => {
  expect(existsSync(paths.importRoot)).toBe(false);
  expect(addExamplesOnce(paths, examples)).toEqual({});
  const items = listLibrary(paths);
  expect(items).toHaveLength(2);
  const alice = items.find((item) => item.kind === "character");
  const book = items.find((item) => item.kind === "lorebook");
  expect(readSettings(paths)).toMatchObject({
    examplesAdded: true,
    lorebookAttachments: { [alice?.id ?? ""]: [book?.id] },
  });
  const copy = join(paths.importCharactersDir, "alice.json");
  expect(readFileSync(copy)).toEqual(readFileSync(join(examples, "characters/alice.json")));
  const settings = readFileSync(paths.settingsFile, "utf8");
  rmSync(copy);
  rmSync(join(paths.dataDir, "library"), { recursive: true });
  for (let i = 0; i < 3; i++) {
    expect(addExamplesOnce(paths, examples)).toEqual({});
    expect(existsSync(copy)).toBe(false);
    expect(listLibrary(paths)).toEqual([]);
    expect(readFileSync(paths.settingsFile, "utf8")).toBe(settings);
  }
});

it("preserves and does not import same-named user files, even malformed or wrong-kind content", () => {
  ensureImportFolders(paths);
  const copy = join(paths.importCharactersDir, "alice.json");
  writeFileSync(copy, "{invalid user file");
  writeFileSync(
    join(paths.importLorebooksDir, "wonderland.json"),
    JSON.stringify(makeV3Card({ name: "User card" })),
  );
  expect(addExamplesOnce(paths, examples)).toEqual({});
  expect(readFileSync(copy, "utf8")).toBe("{invalid user file");
  expect(
    listLibrary(paths)
      .map((item) => item.name)
      .sort(),
  ).toEqual(["Alice", "Synthetic world"]);
});

it("deduplicates an already imported Alice and preserves settings on an upgrade", () => {
  const imported = importFile(paths, join(examples, "characters/alice.json"));
  if (!imported.ok) throw new Error(imported.reason);
  writeSettings(paths, { userName: "Parker", mouse: false });
  expect(addExamplesOnce(paths, examples)).toEqual({});
  expect(listLibrary(paths)).toHaveLength(2);
  const attached = readSettings(paths).lorebookAttachments?.[imported.item.id];
  expect(attached).toHaveLength(1);
  expect(readSettings(paths)).toMatchObject({
    userName: "Parker",
    mouse: false,
    examplesAdded: true,
  });
});

it("lets app startup report a failed folder creation and still saves the marker", () => {
  mkdirSync(join(home, "app"));
  writeFileSync(paths.importRoot, "not a directory");
  expect(addExamplesOnce(paths, examples)).toEqual({});
  expect(readSettings(paths).examplesAdded).toBe(true);
  expect(listLibrary(paths)).toEqual([]);
});

it("returns a settings-write notice and retries idempotently after settings are repaired", () => {
  mkdirSync(paths.settingsFile, { recursive: true });
  expect(addExamplesOnce(paths, examples).notice).toContain("could not save settings");
  expect(readSettings(paths).examplesAdded).toBeUndefined();
  expect(listLibrary(paths)).toHaveLength(2);
  rmSync(paths.settingsFile, { recursive: true });
  expect(addExamplesOnce(paths, examples)).toEqual({});
  expect(listLibrary(paths)).toHaveLength(2);
  const attachments = Object.values(readSettings(paths).lorebookAttachments ?? {});
  expect(attachments).toHaveLength(1);
  expect(attachments[0]).toHaveLength(1);
});

it("records an import failure once and returns its reason without throwing", () => {
  writeFileSync(join(examples, "characters/alice.json"), "{invalid");
  expect(addExamplesOnce(paths, examples).notice).toContain("Could not add the example character:");
  expect(readSettings(paths).examplesAdded).toBe(true);
  expect(addExamplesOnce(paths, examples)).toEqual({});
});

it.each(["null", "character", "lorebook"])(
  "does nothing without a marker when %s is missing",
  (missing) => {
    if (missing !== "null")
      rmSync(
        join(
          examples,
          missing === "character" ? "characters/alice.json" : "lorebooks/wonderland.json",
        ),
      );
    expect(addExamplesOnce(paths, missing === "null" ? null : examples)).toEqual({});
    expect(existsSync(paths.importRoot)).toBe(false);
    expect(readSettings(paths).examplesAdded).toBeUndefined();
  },
);
