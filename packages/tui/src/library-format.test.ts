import type { LibraryItem } from "@littletavern/engine";
import { expect, it } from "vitest";
import {
  EMPTY_LIBRARY_HINT,
  formatImportReport,
  formatItemDetails,
  formatLibraryList,
} from "./library-format.ts";

const item: LibraryItem = {
  v: 1,
  id: "123456789abc",
  sha256: "hash",
  name: "Synthetic 世界",
  kind: "lorebook",
  format: "Lorebook (card format)",
  importedAt: "2026-10-19T00:00:00.000Z",
  sourceFileName: "book.json",
  originalFile: "original.json",
  warnings: ["field ignored"],
  preservedUnused: ["extensions.synthetic"],
  raw: {},
  lorebook: {
    name: "Synthetic 世界",
    description: "description",
    entries: [
      {
        keys: ["rain", "sun"],
        secondaryKeys: [],
        content: "entry",
        enabled: false,
        constant: true,
        insertionOrder: 7,
        name: "entry",
        source: {},
      },
    ],
  },
};
it("formats success, duplicate, failure and warning report lines", () => {
  expect(formatImportReport({ ok: true, status: "imported", item })).toEqual([
    '✓ Imported "Synthetic 世界" — Lorebook (card format), 1 lorebook entries  [id 123456789abc]',
    "  Preserved, not used: extensions.synthetic",
    "  Warning: field ignored",
  ]);
  expect(formatImportReport({ ok: true, status: "already-imported", item })[0]).toBe(
    '• Already imported: "Synthetic 世界" [id 123456789abc]',
  );
  expect(
    formatImportReport({
      ok: false,
      file: "bad.png",
      detected: "plain PNG",
      reason: "PNG image without a character card",
    }),
  ).toEqual(["✗ bad.png — PNG image without a character card"]);
});
it("groups items and formats the empty-library hint", () => {
  expect(formatLibraryList([])).toEqual([EMPTY_LIBRARY_HINT]);
  expect(EMPTY_LIBRARY_HINT).toBe(
    'Library is empty. Put cards in the import folders and use /import, or run "littletavern import <file>".',
  );
  expect(formatLibraryList([item])).toEqual([
    "Characters (0)",
    "Lorebooks (1)",
    "  123456789abc  Synthetic 世界  Lorebook (card format)  1 entries  2026-10-19",
  ]);
});
it("shows entry flags, order, keys, source, unused fields and warnings", () => {
  const lines = formatItemDetails(item);
  expect(lines).toContain("[off] [const] order=7 keys=rain, sun — entry");
  expect(lines).toContain("Source: book.json");
  expect(lines).toContain("Preserved, not used: extensions.synthetic");
  expect(lines).toContain("Warnings:");
});

it("shows character fields and shortens only display text", () => {
  const character: LibraryItem = {
    ...item,
    kind: "character",
    format: "Character card V3 (JSON)",
    character: {
      name: "Synthetic",
      description: "字".repeat(201),
      personality: "calm",
      scenario: "room",
      firstMessage: "Hello",
      alternateGreetings: ["one", "two"],
      exampleMessages: "example",
      systemPrompt: "system",
      postHistoryInstructions: "post",
      creatorNotes: "notes",
      tags: ["tag"],
      creator: "author",
      characterVersion: "1.0",
      lorebook: {
        name: "book",
        description: "",
        entries: [{ ...item.lorebook.entries[0], content: "雨".repeat(61) }],
      },
    },
  };
  const details = formatItemDetails(character);
  expect(details).toContain(`Description: ${"字".repeat(200)}…`);
  expect(details).toContain("First message: Hello");
  expect(details).toContain("Alternate greetings: 2");
  expect(details).toContain("System prompt: system");
  expect(details.some((line) => line.endsWith(`${"雨".repeat(60)}…`))).toBe(true);
  expect(character.character.description).toHaveLength(201);
  expect(formatLibraryList([character, item])).toContain("Characters (1)");
  expect(formatLibraryList([character, item])).toContain("Lorebooks (1)");
});
