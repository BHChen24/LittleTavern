import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { makePng, makeV2Card, makeV3Card, makeZip } from "./cards/fixtures.ts";
import type { LibraryItem } from "./cards/types.ts";
import { getItem, importFile, listLibrary } from "./library.ts";
import { type AppPaths, resolveAppPaths } from "./paths.ts";

let home: string;
let paths: AppPaths;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-library-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
});
afterEach(() => rmSync(home, { recursive: true, force: true }));
function source(name: string, bytes: Buffer): string {
  const file = join(home, name);
  writeFileSync(file, bytes);
  return file;
}
function imported(file: string): LibraryItem {
  const report = importFile(paths, file);
  expect(report.ok).toBe(true);
  if (!report.ok) throw new Error(report.reason);
  return report.item;
}
function keyPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = `${prefix}/${key}`;
    return [path, ...keyPaths(child, path)];
  });
}

it.each([
  ["Character card V3 (JSON)", "v3", "json"],
  ["Character card V2 (JSON)", "v2", "json"],
  ["Character card V3 (PNG)", "v3", "both"],
  ["Character card V2 (PNG)", "v2", "png"],
] as const)(
  "imports %s with the correct name and embedded entry count",
  (format, version, container) => {
    const v2 = makeV2Card({
      name: "V2 角色",
      character_book: { entries: [{ keys: ["two"], content: "V2 entry" }] },
    });
    const v3 = makeV3Card({
      name: "V3 角色",
      character_book: {
        entries: [
          { keys: ["three"], content: "V3 entry" },
          { keys: ["extra"], content: "Second V3 entry" },
        ],
      },
    });
    const card = version === "v3" ? v3 : v2;
    const bytes =
      container === "json"
        ? Buffer.from(JSON.stringify(card))
        : makePng(
            container === "both"
              ? { ccv3: JSON.stringify(v3), chara: JSON.stringify(v2) }
              : { chara: JSON.stringify(v2) },
          );
    const item = imported(source("card", bytes));
    expect(item.format).toBe(format);
    expect(item.name).toBe(version === "v3" ? "V3 角色" : "V2 角色");
    if (item.kind !== "character") throw new Error("Expected character");
    expect(item.character.name).toBe(item.name);
    expect(item.character.lorebook?.entries).toHaveLength(version === "v3" ? 2 : 1);
  },
);

it.each([makeV2Card, makeV3Card])(
  "keeps original bytes and every source field including unknown nested values",
  (makeCard) => {
    const raw = {
      ...makeCard({
        extensions: { regex_scripts: [{ code: "do not execute" }] },
        future: { a: [" x ", { nested: true }] },
        character_book: { entries: [{ keys: ["key"], unknown: { probability: 5 } }] },
      }),
      topLevel: { future: true },
    };
    const bytes = Buffer.from(` ${JSON.stringify(raw, null, 2)}\n`);
    const item = imported(source("card.png", bytes));
    const dir = join(paths.dataDir, "library", "characters", item.id);
    expect(readFileSync(join(dir, item.originalFile)).equals(bytes)).toBe(true);
    const saved = JSON.parse(readFileSync(join(dir, "item.json"), "utf8"));
    expect(keyPaths(saved.raw)).toEqual(keyPaths(raw));
    expect(saved.raw).toEqual(raw);
    expect(item.kind === "character" && item.character.description).toBe(
      "Hello, {{user}}.\n你好。",
    );
  },
);
it("uses V3 when a PNG contains both chunks and keeps the whole original", () => {
  const v3 = makeV3Card({ name: "three" });
  const bytes = makePng({
    ccv3: JSON.stringify(v3),
    chara: JSON.stringify(makeV2Card({ name: "two" })),
  });
  const item = imported(source("card.json", bytes));
  expect(item).toMatchObject({
    format: "Character card V3 (PNG)",
    raw: v3,
    name: "three",
    originalFile: "original.png",
  });
  expect(
    readFileSync(join(paths.dataDir, "library", "characters", item.id, "original.png")).equals(
      bytes,
    ),
  ).toBe(true);
});
it("does not rewrite identical content but keeps different content with the same name", () => {
  const file = source("card.json", Buffer.from(JSON.stringify(makeV3Card())));
  const item = imported(file);
  const itemFile = join(paths.dataDir, "library", "characters", item.id, "item.json");
  const saved = readFileSync(itemFile);
  expect(importFile(paths, file)).toMatchObject({ ok: true, status: "already-imported", item });
  expect(readFileSync(itemFile).equals(saved)).toBe(true);
  const edited = imported(
    source("edited.json", Buffer.from(JSON.stringify(makeV3Card({ description: "edited" })))),
  );
  expect(edited.id).not.toBe(item.id);
  expect(edited.name).toBe(item.name);
});

it.each([
  [
    "v1.json",
    Buffer.from('{"name":"old","description":"old"}'),
    "V1 character card",
    "V1 character cards are not supported in this version",
  ],
  [
    "card.charx",
    makeZip("card.json"),
    "CharX archive",
    "CharX archives are not supported in this version",
  ],
  [
    "card.byaf",
    makeZip("manifest.json"),
    "BYAF archive",
    "BYAF archives are not supported in this version",
  ],
  [
    "card.yaml",
    Buffer.from("name: synthetic"),
    "YAML card",
    "YAML cards are not supported in this version",
  ],
  [
    "plain.png",
    makePng({}),
    "PNG image without a character card",
    "PNG image without a character card",
  ],
  ["broken.json", Buffer.from("{broken}"), "damaged JSON", "damaged JSON:"],
  [
    "broken.png",
    makePng({ ccv3: "not JSON" }),
    "damaged PNG card",
    "embedded card data could not be decoded",
  ],
  [
    "missing-name.json",
    Buffer.from(JSON.stringify(makeV3Card({ name: " " }))),
    "Character card V3 (JSON)",
    "a character must have a name",
  ],
  ["missing.json", null, "unreadable file", "file not found or not readable"],
])("rejects %s without changing the existing library", (name, bytes, detected, reason) => {
  imported(source("valid.json", Buffer.from(JSON.stringify(makeV3Card()))));
  const library = join(paths.dataDir, "library");
  const before = readdirSync(library, { recursive: true }).sort();
  const file = bytes === null ? join(home, name) : source(name, bytes);
  const report = importFile(paths, file);
  expect(report).toMatchObject({ ok: false, file, detected });
  expect(!report.ok && report.reason).toContain(reason);
  expect(readdirSync(library, { recursive: true }).sort()).toEqual(before);
});
it("imports world-info lorebooks, retains disabled entries, and uses file-name fallback", () => {
  const report = importFile(
    paths,
    source(
      "world.json",
      Buffer.from(
        JSON.stringify({
          entries: {
            "0": { key: ["rain"], content: "雨", disable: true },
            "1": { content: "sun" },
          },
        }),
      ),
    ),
  );
  expect(report).toMatchObject({
    ok: true,
    item: { kind: "lorebook", format: "Lorebook (SillyTavern world info)", name: "world" },
  });
  if (!report.ok || report.item.kind !== "lorebook") throw new Error("Expected lorebook");
  expect(report.item.lorebook.entries).toHaveLength(2);
  expect(report.item.lorebook.entries[0]?.enabled).toBe(false);
  expect(
    readFileSync(join(paths.dataDir, "library", "lorebooks", report.item.id, "original.json"))
      .length,
  ).toBeGreaterThan(0);
});
it("imports a standalone card-format lorebook", () => {
  const report = importFile(
    paths,
    source(
      "book.json",
      Buffer.from(
        JSON.stringify({
          name: "Card book",
          entries: [{ keys: ["key"], content: "content", enabled: false }],
        }),
      ),
    ),
  );
  expect(report).toMatchObject({
    ok: true,
    item: { kind: "lorebook", format: "Lorebook (card format)", name: "Card book" },
  });
  if (!report.ok || report.item.kind !== "lorebook") throw new Error("Expected lorebook");
  expect(report.item.lorebook.entries).toHaveLength(1);
  expect(report.item.lorebook.entries[0]?.enabled).toBe(false);
});

it("lists characters and lorebooks in import order, ignores temporary and malformed items", () => {
  const first = imported(source("one.json", Buffer.from(JSON.stringify(makeV3Card()))));
  const book = imported(source("book.json", Buffer.from(JSON.stringify({ entries: [] }))));
  const library = join(paths.dataDir, "library");
  for (const directory of [
    join(library, ".tmp-orphan"),
    join(library, "characters", ".tmp-orphan"),
  ]) {
    mkdirSync(directory);
    writeFileSync(join(directory, "item.json"), JSON.stringify(first));
  }
  const broken = join(library, "characters", "broken");
  mkdirSync(broken);
  writeFileSync(join(broken, "item.json"), "invalid JSON");
  expect(listLibrary(paths).map((item) => item.id)).toEqual([first.id, book.id]);
  expect(getItem(paths, first.id)).toMatchObject({ id: first.id });
  expect(getItem(paths, first.id.slice(0, 6))).toMatchObject({ id: first.id });
  expect(getItem(paths, "nonexistent")).toBeNull();
  expect(getItem(paths, "")).toBe("ambiguous");
  rmSync(join(library, "characters", first.id), { recursive: true });
  expect(listLibrary(paths).map((item) => item.id)).toEqual([book.id]);
});

it("reports a shared non-empty id prefix as ambiguous and still prefers an exact id", () => {
  const prototype = imported(source("card.json", Buffer.from(JSON.stringify(makeV3Card()))));
  for (const id of ["aaa111111111", "aaa222222222"]) {
    const folder = join(paths.dataDir, "library", "characters", id);
    mkdirSync(folder);
    writeFileSync(join(folder, "item.json"), JSON.stringify({ ...prototype, id }));
  }
  expect(getItem(paths, "aaa")).toBe("ambiguous");
  expect(getItem(paths, "aaa111111111")).toMatchObject({ id: "aaa111111111" });
});
it("keeps large text and hundreds of embedded entries without truncation", () => {
  const text = "{{char}}你好。 ".repeat(100000);
  const card = makeV3Card({
    description: text,
    character_book: {
      entries: Array.from({ length: 300 }, (_, index) => ({
        keys: [`key-${index}`],
        content: `entry ${index}`,
      })),
    },
  });
  const item = imported(source("large.json", Buffer.from(JSON.stringify(card))));
  if (item.kind !== "character") throw new Error("Expected character");
  expect(item.character.description).toBe(text);
  expect(item.character.lorebook?.entries).toHaveLength(300);
  expect(item.raw).toEqual(card);
});

it.each([[{}], [[]]])(
  "imports a named lorebook with description without treating it as V1: %j",
  (entries) => {
    const raw = {
      name: "Synthetic lorebook",
      description: "  Description {{user}}\n你好。  ",
      entries,
    };
    const item = imported(source("described-book.json", Buffer.from(JSON.stringify(raw))));
    if (item.kind !== "lorebook") throw new Error("Expected lorebook");
    expect(item.lorebook.name).toBe(raw.name);
    expect(item.lorebook.description).toBe(raw.description);
    expect(item.raw).toEqual(raw);
  },
);
