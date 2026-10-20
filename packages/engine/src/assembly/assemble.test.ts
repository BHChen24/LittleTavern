import { expect, it } from "vitest";
import { assemblePrompt } from "./assemble.ts";
import { chat, makeCharacter } from "./fixtures.ts";
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
  expect(prompt.system).toBe("Write Luna's next reply in a fictional chat between Luna and User.");
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
