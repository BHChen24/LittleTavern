import { expect, it } from "vitest";
import { assemblePrompt } from "./assemble.ts";
import { chat, makeCharacter, makeEntry, makeLorebook } from "./fixtures.ts";
import { activateLore } from "./lore.ts";
import { estimateTokens } from "./tokens.ts";
import type { AssemblyInput } from "./types.ts";

function input(): AssemblyInput {
  return {
    character: makeCharacter({
      name: "Mira",
      systemPrompt: "Main {{user}}",
      description: "Description for {{user}}",
      personality: "Personality",
      scenario: "Scenario",
      exampleMessages: "Examples {{char}}",
      postHistoryInstructions: "After history {{user}}",
      lorebook: makeLorebook("book", [
        makeEntry({
          name: "before",
          constant: true,
          content: "Before {{user}}",
          source: { position: 0 },
        }),
        makeEntry({ name: "after", keys: ["{{user}}"], content: "Lore for {{user}}" }),
      ]),
    }),
    userName: "Parker",
    history: chat("Hello Traveller", "Hi {{user}}"),
  };
}

it("places expanded persona text between before lore and description, with estimated tokens", () => {
  const value = {
    ...input(),
    persona: { name: "Traveller", description: "{{user}} visits {{char}}." },
  };
  const original = structuredClone(value);
  const { prompt, trace } = assemblePrompt(value);
  expect(prompt.system.split("\n\n")).toEqual([
    "Main Traveller",
    "Before Traveller",
    "Traveller visits Mira.",
    "Description for Traveller",
    "Personality",
    "Scenario",
    "Lore for Traveller",
    "Examples Mira",
  ]);
  expect(trace.parts.map((part) => part.source)).toEqual([
    "main",
    "lore-before",
    "persona",
    "description",
    "personality",
    "scenario",
    "lore-after",
    "examples",
    "history",
    "after-history",
  ]);
  expect(trace.parts.find((part) => part.source === "persona")).toEqual({
    source: "persona",
    tokens: estimateTokens("Traveller visits Mira."),
  });
  expect(prompt.history).toEqual(chat("Hello Traveller", "Hi Traveller"));
  expect(prompt.afterHistory).toBe("After history Traveller");
  expect(value).toEqual(original);
});
it("uses the persona name in lore keys, scanned macros and entry content", () => {
  for (const history of [chat("Traveller"), chat("{{user}}")]) {
    const lore = activateLore({
      ...input(),
      history,
      persona: { name: "Traveller", description: "" },
    });
    expect(lore[1]?.decision.reason).toEqual({ kind: "keyword", key: "traveller", message: 1 });
    expect(lore[1]?.content).toBe("Lore for Traveller");
  }
});
it.each(["", " \n\t"])("uses a name-only persona without a trace part for %j", (description) => {
  const { prompt, trace } = assemblePrompt({
    ...input(),
    persona: { name: "Traveller", description },
  });
  expect(prompt.system).toContain("Description for Traveller");
  expect(trace.parts.some((part) => part.source === "persona")).toBe(false);
});
it("deep-equals the output captured before persona assembly was implemented", () => {
  expect(assemblePrompt(input())).toEqual(previousOutput);
});

// Generated with the synthetic input above before the persona assembly change.
const previousOutput = {
  prompt: {
    system:
      "Main Parker\n\nBefore Parker\n\nDescription for Parker\n\nPersonality\n\nScenario\n\nLore for Parker\n\nExamples Mira",
    history: [
      {
        role: "user",
        text: "Hello Traveller",
      },
      {
        role: "character",
        text: "Hi Parker",
      },
    ],
    afterHistory: "After history Parker",
  },
  trace: {
    tokensAreEstimates: true,
    parts: [
      {
        source: "main",
        tokens: 3,
      },
      {
        source: "lore-before",
        tokens: 4,
        detail: "1 entries",
      },
      {
        source: "description",
        tokens: 6,
      },
      {
        source: "personality",
        tokens: 3,
      },
      {
        source: "scenario",
        tokens: 2,
      },
      {
        source: "lore-after",
        tokens: 4,
        detail: "1 entries",
      },
      {
        source: "examples",
        tokens: 4,
      },
      {
        source: "history",
        tokens: 7,
        detail: "2 messages, 0 left out",
      },
      {
        source: "after-history",
        tokens: 5,
      },
    ],
    lore: [
      {
        lorebook: "book",
        index: 0,
        entry: "before",
        included: true,
        reason: {
          kind: "constant",
        },
        placement: "before",
        tokens: 4,
        ignoredFeatures: [],
      },
      {
        lorebook: "book",
        index: 1,
        entry: "after",
        included: true,
        reason: {
          kind: "keyword",
          key: "parker",
          message: 2,
        },
        placement: "after",
        tokens: 4,
        ignoredFeatures: [],
      },
    ],
    history: {
      included: 2,
      leftOut: 0,
    },
    notes: [],
    totalTokens: 39,
  },
};
