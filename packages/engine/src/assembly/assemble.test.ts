import { expect, it } from "vitest";
import { assemblePrompt } from "./assemble.ts";
import { chat, makeCharacter, makeEntry, makeLorebook } from "./fixtures.ts";
import { estimateTokens } from "./tokens.ts";
import type { AssemblyInput } from "./types.ts";

it("assembles card parts in order, preserves history roles and appends post-history instructions", () => {
  const input: AssemblyInput = {
    character: makeCharacter({
      name: "Luna",
      systemPrompt: "Main {{Char}}",
      description: "Description {{user}}",
      personality: "Personality",
      scenario: "Scenario",
      exampleMessages: "Example {{unknown}}",
      postHistoryInstructions: "After {{ USER }}",
    }),
    userName: "Owner",
    history: chat("Hi {{char}}", "Hello {{user}}"),
  };
  const original = structuredClone(input);
  const { prompt, trace } = assemblePrompt(input);
  expect(prompt.system.split("\n\n")).toEqual([
    "Main Luna",
    "Description Owner",
    "Personality",
    "Scenario",
    "Example {{unknown}}",
  ]);
  expect(prompt.history).toEqual(chat("Hi Luna", "Hello Owner"));
  expect(prompt.afterHistory).toBe("After Owner");
  expect(trace.parts.map((part) => part.source)).toEqual([
    "main",
    "description",
    "personality",
    "scenario",
    "examples",
    "history",
    "after-history",
  ]);
  expect(trace.history).toEqual({ included: 2, leftOut: 0 });
  expect(trace.totalTokens).toBe(
    estimateTokens(prompt.system) +
      estimateTokens("Hi Luna") +
      estimateTokens("Hello Owner") +
      estimateTokens("After Owner"),
  );
  expect(input).toEqual(original);
  expect(assemblePrompt(input)).toEqual({ prompt, trace });
});
it("uses the default main instruction and omits blank parts without empty headings", () => {
  const { prompt, trace } = assemblePrompt({
    character: makeCharacter({
      name: "Luna",
      systemPrompt: " \n",
      description: "\t",
      postHistoryInstructions: " ",
    }),
    history: [],
  });
  expect(prompt.system).toBe(
    "Write Luna's next reply in a fictional chat between Luna and Traveler.",
  );
  expect(prompt.afterHistory).toBeNull();
  expect(prompt.history).toEqual([]);
  expect(trace.parts.map((part) => part.source)).toEqual(["main"]);
  expect(trace.lore).toEqual([]);
});
it("fits history after accounting for system, post-history instructions and reply reserve", () => {
  const { prompt, trace } = assemblePrompt({
    character: makeCharacter({ systemPrompt: "main", postHistoryInstructions: "tail" }),
    history: chat("old old old", "12345678", "abcdefgh"),
    contextWindow: 8,
    settings: { replyReserve: 2 },
  });
  expect(prompt.history).toEqual([
    { role: "character", text: "12345678" },
    { role: "user", text: "abcdefgh" },
  ]);
  expect(trace.history).toEqual({ included: 2, leftOut: 1 });
  expect(trace.parts.find((part) => part.source === "history")).toEqual({
    source: "history",
    tokens: 4,
    detail: "2 messages, 1 left out",
  });
  expect(trace.notes).toEqual([]);
});
it("keeps the latest message and reports context overflow", () => {
  const { prompt, trace } = assemblePrompt({
    character: makeCharacter({ systemPrompt: "main" }),
    history: chat("old", "你好世界"),
    contextWindow: 2,
    settings: { replyReserve: 0 },
  });
  expect(prompt.history).toEqual([{ role: "character", text: "你好世界" }]);
  expect(trace.history).toEqual({ included: 1, leftOut: 1 });
  expect(trace.notes).toEqual(["request exceeds the context window"]);
});
it.each([undefined, 0])("uses the default context window for %s", (contextWindow) => {
  const history = chat("a".repeat(1000), "b".repeat(1000));
  const { prompt, trace } = assemblePrompt({ character: makeCharacter(), history, contextWindow });
  expect(prompt.history).toEqual(history);
  expect(trace.notes).toEqual([]);
});

it("assembles the story's lore example and traces every entry once", () => {
  const character = makeCharacter({
    name: "Luna",
    systemPrompt: "main",
    description: "description",
    personality: "personality",
    scenario: "scenario",
    exampleMessages: "examples",
    lorebook: makeLorebook("book", [
      makeEntry({
        name: "constant",
        constant: true,
        content: "Constant {{char}}",
        insertionOrder: 10,
        source: { position: 0 },
      }),
      makeEntry({
        name: "lighthouse",
        keys: ["lighthouse"],
        content: "Lighthouse {{user}}",
        insertionOrder: 5,
      }),
      makeEntry({ name: "harbor", keys: ["harbor"], content: "Harbor" }),
      makeEntry({ name: "disabled", keys: ["lighthouse"], enabled: false, content: "Disabled" }),
    ]),
  });
  const { prompt, trace } = assemblePrompt({
    character,
    history: chat("harbor", "old", "hello", "The old lighthouse"),
  });
  expect(prompt.system.split("\n\n")).toEqual([
    "main",
    "Constant Luna",
    "description",
    "personality",
    "scenario",
    "Lighthouse Traveler",
    "examples",
  ]);
  expect(trace.lore.map((item) => item.reason)).toEqual([
    { kind: "constant" },
    { kind: "keyword", key: "lighthouse", message: 4 },
    { kind: "no-match", depth: 2 },
    { kind: "disabled" },
  ]);
  expect(trace.lore.map((item) => item.index)).toEqual([0, 1, 2, 3]);
  expect(trace.parts.filter((part) => part.source.startsWith("lore-"))).toEqual([
    { source: "lore-before", tokens: estimateTokens("Constant Luna"), detail: "1 entries" },
    { source: "lore-after", tokens: estimateTokens("Lighthouse Traveler"), detail: "1 entries" },
  ]);
});
it("sorts each placement ascending with source-order ties and evaluates books independently", () => {
  const entries = [
    makeEntry({ keys: ["key"], content: "second", insertionOrder: 2 }),
    makeEntry({ keys: ["key"], content: "first", insertionOrder: 1 }),
  ];
  const { prompt, trace } = assemblePrompt({
    character: makeCharacter({ systemPrompt: "main", lorebook: makeLorebook("embedded", entries) }),
    lorebooks: [
      makeLorebook("standalone", [
        makeEntry({ keys: ["key"], content: "third", insertionOrder: 2 }),
      ]),
    ],
    history: chat("key"),
  });
  expect(prompt.system).toBe("main\n\nfirst\nsecond\nthird");
  expect(trace.lore.map((item) => item.lorebook)).toEqual(["embedded", "embedded", "standalone"]);
  expect(trace.lore.every((item) => item.included)).toBe(true);
});

it("uses the default 4000-token lore budget and accepts an explicit override", () => {
  const input: AssemblyInput = {
    character: makeCharacter({
      lorebook: makeLorebook("book", [
        makeEntry({ constant: true, content: "汉".repeat(4000), insertionOrder: 2 }),
        makeEntry({ constant: true, content: "字", insertionOrder: 1 }),
      ]),
    }),
    history: [],
  };
  const result = assemblePrompt(input);
  expect(result.trace.lore.map((item) => [item.included, item.reason.kind, item.tokens])).toEqual([
    [true, "constant", 4000],
    [false, "budget", 1],
  ]);
  expect(result.prompt.system).not.toContain("字");
  const overridden = assemblePrompt({ ...input, settings: { loreBudget: 4001 } });
  expect(overridden.trace.lore.every((item) => item.included)).toBe(true);
  expect(overridden.prompt.system).toContain("字");
});
it("budgets expanded lore text and does not replace macro-looking names twice", () => {
  const { prompt, trace } = assemblePrompt({
    character: makeCharacter({
      name: "{{user}}",
      lorebook: makeLorebook("book", [
        makeEntry({ constant: true, content: "{{char}}" }),
        makeEntry({ constant: true, content: "{{user}}" }),
      ]),
    }),
    userName: "汉字汉字",
    history: [],
    settings: { loreBudget: 2 },
  });
  expect(trace.lore.map((item) => [item.included, item.tokens, item.reason.kind])).toEqual([
    [true, 2, "constant"],
    [false, 4, "budget"],
  ]);
  expect(prompt.system.split("\n\n").at(-1)).toBe("{{user}}");
});

it("keeps trace invariants under different budgets and scan depths without mutating input", () => {
  const embedded = makeLorebook("embedded", [
    makeEntry({ name: "constant", constant: true, content: "世界", insertionOrder: 3 }),
    makeEntry({
      name: "keyword",
      keys: ["lighthouse", "light"],
      content: "灯塔",
      insertionOrder: 2,
    }),
    makeEntry({ name: "disabled", enabled: false, constant: true, content: "Disabled" }),
    makeEntry({ name: "no keys", keys: [""], content: "Empty key" }),
    makeEntry({ name: "no match", keys: ["harbor"], content: "Harbor" }),
  ]);
  const standalone = makeLorebook("standalone", [
    makeEntry({ name: "standalone", keys: ["lighthouse"], content: "Standalone" }),
  ]);
  for (const loreBudget of [0, 1, 3, 20]) {
    for (const scanDepth of [0, 1, 2]) {
      const input: AssemblyInput = {
        character: makeCharacter({ systemPrompt: "main", lorebook: embedded }),
        lorebooks: [standalone],
        history: chat("old", "older", "the lighthouse", "recent"),
        settings: { loreBudget, scanDepth, replyReserve: 0 },
        contextWindow: 10,
      };
      function freeze(value: unknown): void {
        if (value && typeof value === "object") {
          for (const child of Object.values(value)) freeze(child);
          Object.freeze(value);
        }
      }
      freeze(input);
      const result = assemblePrompt(input);
      expect(assemblePrompt(input)).toEqual(result);
      expect(result.trace.lore.map((item) => [item.lorebook, item.index])).toEqual([
        ["embedded", 0],
        ["embedded", 1],
        ["embedded", 2],
        ["embedded", 3],
        ["embedded", 4],
        ["standalone", 0],
      ]);
      expect(result.trace.history.included + result.trace.history.leftOut).toBe(
        input.history.length,
      );
      expect(result.trace.history.included).toBe(result.prompt.history.length);
      expect(
        result.trace.lore
          .filter((item) => item.included)
          .reduce((sum, item) => sum + (item.tokens ?? 0), 0),
      ).toBeLessThanOrEqual(loreBudget);
      expect(
        result.trace.lore.every(
          (item) => item.included === ["keyword", "constant"].includes(item.reason.kind),
        ),
      ).toBe(true);
      expect(result.trace.tokensAreEstimates).toBe(true);
    }
  }
});
it("returns only structured trace fields and notes ignored features without applying them", () => {
  const result = assemblePrompt({
    character: makeCharacter({
      lorebook: makeLorebook("book", [
        makeEntry({
          name: "entry",
          keys: ["key"],
          secondaryKeys: ["unmatched"],
          content: "Content",
          source: { secondary_keys: ["unmatched"], probability: 50 },
        }),
      ]),
    }),
    history: chat("key"),
  });
  expect(result.trace.lore[0]).toEqual({
    lorebook: "book",
    index: 0,
    entry: "entry",
    included: true,
    reason: { kind: "keyword", key: "key", message: 1 },
    placement: "after",
    tokens: 2,
    ignoredFeatures: ["secondary keys", "probability"],
  });
  expect(result.prompt.system).toContain("Content");
  expect(JSON.parse(JSON.stringify(result.trace))).toEqual(result.trace);
  expect(Object.keys(result.trace).sort()).toEqual([
    "history",
    "lore",
    "notes",
    "parts",
    "tokensAreEstimates",
    "totalTokens",
  ]);
  expect(
    result.trace.parts.every((part) => Number.isInteger(part.tokens) && part.tokens >= 0),
  ).toBe(true);
});
it.each([
  { keys: ["LIGHT"], history: ["lighthouse"], included: true, kind: "keyword" },
  { keys: ["灯塔"], history: ["到了灯塔"], included: true, kind: "keyword" },
  { keys: ["こんにちは"], history: ["こんにちは！"], included: true, kind: "keyword" },
  { keys: ["{{char}}"], history: ["{{char}}"], included: true, kind: "keyword" },
  { keys: ["key"], history: ["key", "old", "recent"], included: false, kind: "no-match" },
  { keys: [""], history: ["anything"], included: false, kind: "no-keywords" },
  { keys: ["key"], history: [], included: false, kind: "no-match" },
])(
  "keeps assembled lore and trace aligned for $kind: $keys",
  ({ keys, history, included, kind }) => {
    const result = assemblePrompt({
      character: makeCharacter({
        name: "Luna",
        lorebook: makeLorebook("book", [makeEntry({ keys, content: "Lore content" })]),
      }),
      history: chat(...history),
    });
    expect(result.prompt.system.includes("Lore content")).toBe(included);
    expect(result.trace.lore[0]).toMatchObject({ included, reason: { kind } });
  },
);
it("uses defaults for explicitly undefined optional settings", () => {
  const input: AssemblyInput = {
    character: makeCharacter({
      lorebook: makeLorebook("book", [makeEntry({ constant: true, content: "汉".repeat(4001) })]),
    }),
    history: chat("recent"),
  };
  expect(
    assemblePrompt({
      ...input,
      settings: { scanDepth: undefined, loreBudget: undefined, replyReserve: undefined },
    }),
  ).toEqual(assemblePrompt(input));
});

it("reserves the larger configured reply cap and preserves the reserve when the cap is off", () => {
  const input: AssemblyInput = {
    character: makeCharacter({ systemPrompt: "main" }),
    history: chat("a".repeat(12000), "b".repeat(12000), "latest"),
    contextWindow: 10000,
  };
  const baseline = assemblePrompt(input);
  expect(assemblePrompt({ ...input, settings: { replyTokens: 0 } })).toEqual(baseline);
  const capped = assemblePrompt({ ...input, settings: { replyTokens: 8000 } });
  expect(capped.trace.history.included).toBeLessThan(baseline.trace.history.included);
  expect(capped.prompt.history.at(-1)?.text).toBe("latest");
});
