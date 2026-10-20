import { expect, it } from "vitest";
import { chat, makeCharacter, makeEntry, makeLorebook } from "./fixtures.ts";
import { activateLore, ignoredFeatures, placementOf } from "./lore.ts";
import type { AssemblyInput } from "./types.ts";

it("evaluates embedded entries before standalone entries and explains every exclusion", () => {
  const input: AssemblyInput = {
    character: makeCharacter({
      lorebook: makeLorebook("embedded", [
        makeEntry({ enabled: false, constant: true }),
        makeEntry({ constant: true }),
        makeEntry({ keys: [""] }),
        makeEntry({ keys: ["harbor"] }),
      ]),
    }),
    lorebooks: [makeLorebook("standalone", [makeEntry({ keys: ["lighthouse"] })])],
    history: chat("harbor", "old", "nothing", "The old LIGHTHOUSE"),
  };
  const decisions = activateLore(input).map((item) => item.decision);
  expect(decisions.map((item) => [item.lorebook, item.index, item.included, item.reason])).toEqual([
    ["embedded", 0, false, { kind: "disabled" }],
    ["embedded", 1, true, { kind: "constant" }],
    ["embedded", 2, false, { kind: "no-keywords" }],
    ["embedded", 3, false, { kind: "no-match", depth: 2 }],
    ["standalone", 0, true, { kind: "keyword", key: "lighthouse", message: 4 }],
  ]);
});
it("finds the newest message first, then the first key in source order", () => {
  const result = activateLore({
    character: makeCharacter({
      name: "灯塔",
      lorebook: makeLorebook("book", [makeEntry({ keys: ["harbor", "{{ CHAR }}", "灯"] })]),
    }),
    history: chat("harbor", "到了灯塔"),
  });
  expect(result).toHaveLength(1);
  expect(result[0]?.decision.reason).toEqual({ kind: "keyword", key: "灯塔", message: 2 });
});
it("substitutes macros in scan messages, supports Japanese and honors configured depth", () => {
  const input: AssemblyInput = {
    character: makeCharacter({
      name: "灯塔",
      lorebook: makeLorebook("book", [
        makeEntry({ keys: ["灯塔"] }),
        makeEntry({ keys: ["こんにちは"] }),
      ]),
    }),
    history: chat("{{char}} こんにちは", "nothing", "nothing"),
    settings: { scanDepth: 3 },
  };
  expect(activateLore(input).every((item) => item.decision.included)).toBe(true);
  expect(
    activateLore({ ...input, settings: { scanDepth: 0 } }).every((item) => !item.decision.included),
  ).toBe(true);
});
it("with empty history activates only enabled constant entries", () => {
  const result = activateLore({
    character: makeCharacter({
      lorebook: makeLorebook("book", [
        makeEntry({ constant: true }),
        makeEntry({ keys: ["key"] }),
        makeEntry(),
      ]),
    }),
    history: [],
  });
  expect(result.map((item) => item.decision.reason.kind)).toEqual([
    "constant",
    "no-match",
    "no-keywords",
  ]);
});
it.each([
  [{ position: 0 }, "before"],
  [{ position: 1 }, "after"],
  [{ extensions: { position: 0 }, position: "after_char" }, "before"],
  [{ extensions: { position: 1 }, position: "before_char" }, "after"],
  [{ position: "before_char" }, "before"],
  [{ position: "after_char" }, "after"],
  [{ position: 4 }, "after"],
  [{ extensions: { position: 4 }, position: "before_char" }, "after"],
  [{}, "after"],
] as const)("places source %j as %s", (source, placement) => {
  expect(placementOf(makeEntry({ source }))).toBe(placement);
});
it("notes ignored features only from the raw source", () => {
  const source = {
    secondary_keys: ["secondary"],
    keys: ["/lighthouse/i"],
    probability: 50,
    extensions: { position: 4, scan_depth: 3, case_sensitive: true, match_whole_words: true },
  };
  expect(ignoredFeatures(makeEntry({ source }))).toEqual([
    "secondary keys",
    "regex keys",
    "probability",
    "placement 4",
    "per-entry scan depth",
    "case sensitivity",
    "whole-word matching",
  ]);
  expect(ignoredFeatures(makeEntry({ secondaryKeys: ["normalized only"] }))).toEqual([]);
  expect(
    ignoredFeatures(makeEntry({ source: { keysecondary: ["world"], key: ["/world/i"] } })),
  ).toEqual(["secondary keys", "regex keys"]);
  expect(
    ignoredFeatures(makeEntry({ source: { probability: 50, useProbability: false } })),
  ).toEqual([]);
  expect(ignoredFeatures(makeEntry({ source: { extensions: { probability: 50 } } }))).toEqual([
    "probability",
  ]);
});
it("matches regex-looking keys as plain substrings without applying ignored matching features", () => {
  const entries = [
    makeEntry({ keys: ["/hello/i"], source: { keys: ["/hello/i"] } }),
    makeEntry({ keys: ["hello"], source: { caseSensitive: true, matchWholeWords: true } }),
  ];
  const input: AssemblyInput = {
    character: makeCharacter(),
    lorebooks: [makeLorebook("book", entries)],
    history: chat("HELLOworld"),
  };
  expect(activateLore(input).map((item) => item.decision.included)).toEqual([false, true]);
  expect(
    activateLore({ ...input, history: chat("literal /HELLO/i text") })[0]?.decision.included,
  ).toBe(true);
});
