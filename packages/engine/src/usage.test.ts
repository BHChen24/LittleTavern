import { expect, it } from "vitest";
import type { TurnResult } from "./chat-session.ts";
import { sumUsage, toUsageRecord } from "./usage.ts";

const price = { inputPerMTok: 1, outputPerMTok: 2 };
const options = { sessionId: "test-session", modelPrice: price, secrets: ["synthetic-key"] };
const turn: TurnResult = {
  outcome: "completed",
  text: "hello",
  model: "openai/gpt-4o-mini",
  startedAt: "2026-10-19T00:00:00.000Z",
  durationMs: 12,
  usage: {
    input: 10,
    output: 5,
    cacheRead: 2,
    cacheWrite: 1,
    reasoning: 3,
    totalTokens: 18,
    cost: { input: 0.1, output: 0.2, cacheRead: 0.03, cacheWrite: 0.04, total: 0.37 },
  },
};

it("preserves completed usage and the provider's cost breakdown", () => {
  expect(toUsageRecord(turn, options)).toMatchObject({
    v: 1,
    timestamp: turn.startedAt,
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 2,
    cacheWriteTokens: 1,
    reasoningTokens: 3,
    durationMs: 12,
    cost: turn.usage.cost,
    outcome: "completed",
  });
});
it.each(["interrupted", "error"] as const)("uses null for unreported %s tokens", (outcome) => {
  const record = toUsageRecord(
    { ...turn, outcome, usage: { ...turn.usage, totalTokens: 0 } },
    options,
  );
  expect([
    record.inputTokens,
    record.outputTokens,
    record.cacheReadTokens,
    record.cacheWriteTokens,
    record.reasoningTokens,
  ]).toEqual([null, null, null, null, null]);
});
it("retains reported interrupted usage", () => {
  expect(toUsageRecord({ ...turn, outcome: "interrupted" }, options).inputTokens).toBe(10);
});
it("marks absent reasoning as unknown", () => {
  expect(
    toUsageRecord({ ...turn, usage: { ...turn.usage, reasoning: undefined } }, options)
      .reasoningTokens,
  ).toBeNull();
});
it.each([null, { inputPerMTok: 0, outputPerMTok: 0 }])(
  "marks unknown catalogue price as null: %j",
  (modelPrice) => {
    expect(toUsageRecord(turn, { ...options, modelPrice }).cost).toBeNull();
  },
);
it("scrubs the key from error records", () => {
  const record = toUsageRecord(
    { ...turn, outcome: "error", errorMessage: "401 synthetic-key" },
    options,
  );
  expect(JSON.stringify(record)).not.toContain("synthetic-key");
  expect(record.error).toBe("401 [REDACTED]");
});
it("sums known values and flags incomplete records", () => {
  const first = toUsageRecord(turn, options);
  const second = toUsageRecord(
    { ...turn, outcome: "error", usage: { ...turn.usage, totalTokens: 0 } },
    { ...options, modelPrice: null },
  );
  expect(sumUsage([first, first])).toEqual({
    requests: 2,
    inputTokens: 20,
    outputTokens: 10,
    cacheReadTokens: 4,
    cacheWriteTokens: 2,
    cost: 0.74,
    incomplete: false,
  });
  expect(sumUsage([first, second])).toEqual({
    requests: 2,
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 2,
    cacheWriteTokens: 1,
    cost: 0.37,
    incomplete: true,
  });
  expect(sumUsage([])).toEqual({
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cost: 0,
    incomplete: false,
  });
});
