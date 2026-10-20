import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { CHARACTER_TEMPLATE } from "./cards/template.ts";
import { createCharacterFromDraft } from "./create-character.ts";
import { importFile, listLibrary } from "./library.ts";
import { type AppPaths, resolveAppPaths } from "./paths.ts";

let home: string;
let paths: AppPaths;
let draft: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-create-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  mkdirSync(join(paths.importRoot, "drafts"), { recursive: true });
  draft = join(paths.importRoot, "drafts", "new.md");
});
afterEach(() => rmSync(home, { recursive: true, force: true }));
it("writes a normal V3 card, imports it losslessly, removes the successful draft and reimports identically", () => {
  writeFileSync(draft, "## Name\nMira / Sea\n## First message\nHello {{user}}.\n");
  const result = createCharacterFromDraft(paths, draft, "0.1.0");
  expect(result).toMatchObject({
    ok: true,
    status: "imported",
    warnings: expect.arrayContaining([expect.stringContaining("Description")]),
  });
  expect(existsSync(draft)).toBe(false);
  expect(listLibrary(paths)).toHaveLength(1);
  const card = join(paths.importCharactersDir, "mira-sea.json");
  const report = importFile(paths, card);
  expect(report).toMatchObject({ ok: true, status: "already-imported" });
  if (!report.ok) throw new Error(report.reason);
  expect(report.item.raw).toEqual(JSON.parse(readFileSync(card, "utf8")));
  expect(
    readFileSync(join(paths.dataDir, "library", "characters", report.item.id, "original.json")),
  ).toEqual(readFileSync(card));
  expect(report.item).toMatchObject({
    name: "Mira / Sea",
    character: { firstMessage: "Hello {{user}}." },
  });
});
it("keeps an owner-supplied source and chooses a unique filename without overwriting", () => {
  writeFileSync(draft, "## Name\nMira\n");
  const text = readFileSync(draft, "utf8");
  expect(createCharacterFromDraft(paths, draft, "0.1.0", { keepSource: true })).toHaveProperty(
    "ok",
    true,
  );
  const first = readFileSync(join(paths.importCharactersDir, "mira.json"));
  expect(createCharacterFromDraft(paths, draft, "0.1.0", { keepSource: true })).toHaveProperty(
    "ok",
    true,
  );
  expect(readFileSync(draft, "utf8")).toBe(text);
  expect(readFileSync(join(paths.importCharactersDir, "mira.json"))).toEqual(first);
  expect(readdirSync(paths.importCharactersDir).sort()).toEqual(["mira-2.json", "mira.json"]);
});
it("keeps invalid and unchanged drafts and reports an unreadable source", () => {
  writeFileSync(draft, "## Description\nKeep me.\n");
  expect(createCharacterFromDraft(paths, draft, "0.1.0")).toEqual({
    error: "A character needs a name.",
    draftPath: draft,
  });
  expect(readFileSync(draft, "utf8")).toContain("Keep me.");
  writeFileSync(draft, CHARACTER_TEMPLATE);
  expect(createCharacterFromDraft(paths, draft, "0.1.0")).toEqual({ cancelled: true });
  expect(existsSync(draft)).toBe(true);
  expect(createCharacterFromDraft(paths, join(home, "missing.md"), "0.1.0")).toMatchObject({
    error: expect.stringContaining("ENOENT"),
    draftPath: join(home, "missing.md"),
  });
  expect(listLibrary(paths)).toEqual([]);
});
it("keeps the draft on card-write and import failures", () => {
  writeFileSync(draft, "## Name\nMira\n");
  mkdirSync(paths.importRoot, { recursive: true });
  writeFileSync(paths.importCharactersDir, "blocked");
  expect(createCharacterFromDraft(paths, draft, "0.1.0")).toHaveProperty("error");
  expect(existsSync(draft)).toBe(true);
  rmSync(paths.importCharactersDir);
  writeFileSync(paths.dataDir, "blocked");
  expect(createCharacterFromDraft(paths, draft, "0.1.0")).toMatchObject({
    error: "could not write the library item",
    draftPath: draft,
  });
  expect(existsSync(draft)).toBe(true);
});
