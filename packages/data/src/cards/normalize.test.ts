import { expect, it } from "vitest";
import { makeV2Card, makeV3Card, makeWorldInfo } from "./fixtures.ts";
import { preservedUnusedFields, toCharacter, toLorebook } from "./normalize.ts";

it.each([makeV2Card, makeV3Card])(
  "maps all shared character fields without changing text",
  (makeCard) => {
    const data = makeCard({
      name: " 三 ",
      description: "  {{char}}\n你好。  ",
      personality: "calm",
      scenario: "room",
      first_mes: "hello",
      alternate_greetings: ["one"],
      mes_example: "example",
      system_prompt: "system",
      post_history_instructions: "post",
      creator_notes: "notes",
      tags: ["tag"],
      creator: "author",
      character_version: "1.2",
      character_book: { entries: [{ keys: ["key"], content: "entry" }] },
    }).data;
    const original = structuredClone(data);
    const result = toCharacter(data);
    expect(result.warnings).toEqual([]);
    expect(result.value).toMatchObject({
      name: " 三 ",
      description: "  {{char}}\n你好。  ",
      personality: "calm",
      scenario: "room",
      firstMessage: "hello",
      alternateGreetings: ["one"],
      exampleMessages: "example",
      systemPrompt: "system",
      postHistoryInstructions: "post",
      creatorNotes: "notes",
      tags: ["tag"],
      creator: "author",
      characterVersion: "1.2",
    });
    expect(result.value.lorebook?.entries).toHaveLength(1);
    expect(data).toEqual(original);
  },
);
it("uses safe defaults and names every wrong-type field in its warnings", () => {
  const result = toCharacter({
    name: "card",
    description: 2,
    tags: "tag",
    alternate_greetings: [3],
    character_book: false,
  });
  expect(result.value).toMatchObject({
    description: "",
    tags: [],
    alternateGreetings: [],
    lorebook: null,
  });
  for (const field of ["description", "tags", "alternate_greetings", "character_book"]) {
    expect(
      result.warnings.some(
        (warning) => warning.includes(`field "${field}"`) && warning.endsWith("ignored"),
      ),
    ).toBe(true);
  }
});
it("accepts absent, null and empty embedded lorebooks", () => {
  expect(toCharacter({ name: "card" }).value.lorebook).toBeNull();
  expect(toCharacter({ name: "card", character_book: null }).warnings).toEqual([]);
  expect(
    toCharacter({ name: "card", character_book: { entries: [] } }).value.lorebook?.entries,
  ).toEqual([]);
});
it("normalizes both lorebook shapes and keeps source entries verbatim", () => {
  const source = {
    key: ["one"],
    keysecondary: ["two"],
    content: "content",
    disable: true,
    constant: true,
    order: 7,
    comment: "entry",
    probability: 19,
    extensions: { future: true },
  };
  const world = toLorebook(makeWorldInfo({ "10": source, "2": { content: "first" } }), "fallback");
  expect(world.value.entries.map((entry) => entry.content)).toEqual(["first", "content"]);
  expect(world.value.entries[1]).toMatchObject({
    keys: ["one"],
    secondaryKeys: ["two"],
    enabled: false,
    constant: true,
    insertionOrder: 7,
    name: "entry",
    source,
  });
  const cardEntry = {
    keys: ["one"],
    secondary_keys: ["two"],
    content: "content",
    enabled: false,
    constant: true,
    insertion_order: 7,
    name: "entry",
    position: "before_char",
  };
  expect(toLorebook({ entries: [cardEntry] }, "fallback").value.entries[0]).toMatchObject({
    enabled: false,
    insertionOrder: 7,
    source: cardEntry,
  });
});
it("defaults entry fields and warns on wrong types", () => {
  const result = toLorebook(
    { entries: [{ keys: 1, enabled: "no", constant: null, insertion_order: "7" }] },
    "fallback",
  );
  expect(result.value.entries[0]).toMatchObject({
    keys: [],
    secondaryKeys: [],
    enabled: true,
    constant: false,
    insertionOrder: 0,
  });
  expect(result.warnings).toHaveLength(4);
});
it("uses a file-name fallback when a lorebook name is absent or blank", () => {
  expect(toLorebook({ entries: [] }, "fallback").value.name).toBe("fallback");
  expect(toLorebook({ name: "  ", entries: [] }, "fallback").value.name).toBe("fallback");
});
it("lists unmapped data and extension keys without executing them", () => {
  const raw = makeV3Card({
    future: { field: true },
    extensions: { regex_scripts: "never execute", tavern_helper: {} },
  });
  expect(preservedUnusedFields(raw)).toEqual([
    "future",
    "extensions.regex_scripts",
    "extensions.tavern_helper",
  ]);
  expect(preservedUnusedFields({ entries: [], future: true })).toEqual(["future"]);
});
