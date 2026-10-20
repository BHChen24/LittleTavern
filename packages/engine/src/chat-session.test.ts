import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendUsageRecord, readUsageRecords } from "@littletavern/data";
import { expect, it } from "vitest";
import { ChatSession, type TurnResult } from "./chat-session.ts";
import { DEFAULT_MODEL_ID } from "./models.ts";
import { DEFAULT_SYSTEM_PROMPT } from "./system-prompt.ts";
import { sumUsage, toUsageRecord } from "./usage.ts";

it("streams text and supplies the earlier conversation on a second turn", async () => {
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: {
      replies: [
        "Hello there.",
        (history) => {
          expect(history.map((message) => message.text)).toEqual([
            DEFAULT_SYSTEM_PROMPT,
            "hi",
            "Hello there.",
            "remember?",
          ]);
          return "You said hi before.";
        },
      ],
    },
  });
  const deltas: string[] = [];
  const turns: TurnResult[] = [];
  session.onDelta((delta) => {
    deltas.push(delta);
  });
  session.onFinish((turn) => {
    turns.push(turn);
  });
  await session.send("hi");
  expect(deltas.join("")).toBe("Hello there.");
  await session.send("remember?");
  expect(turns).toHaveLength(2);
  expect(turns[1]).toMatchObject({
    outcome: "completed",
    text: "You said hi before.",
    model: DEFAULT_MODEL_ID,
  });
  expect(session.isStreaming).toBe(false);
});

it("clears earlier conversation before the next request", async () => {
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: {
      replies: [
        "Earlier reply.",
        (history) => {
          expect(history).toEqual([{ role: "user", text: "New conversation." }]);
          return "Fresh reply.";
        },
      ],
    },
  });
  await session.send("Earlier message.");
  session.clearConversation();
  expect((await session.send("New conversation."))?.text).toBe("Fresh reply.");
});

it("interrupts streaming while retaining partial text", async () => {
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: { replies: ["A long enough response to interrupt before its end. ".repeat(20)] },
  });
  session.onDelta(() => session.abort());
  const turn = await session.send("hi");
  expect(turn?.outcome).toBe("interrupted");
  expect(turn?.text.length).toBeGreaterThan(0);
  expect(turn?.text.length).toBeLessThan(1000);
});

it("does not send blank input or requests without a key", async () => {
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => undefined,
    simulated: { replies: ["unused"] },
  });
  expect(await session.send(" ")).toBeNull();
  expect(await session.send("hello")).toBeNull();
});

it("writes exactly three scrubbed ledger records for three simulated requests", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-chat-ledger-"));
  const file = join(home, "usage.jsonl");
  const price = { inputPerMTok: 1, outputPerMTok: 2 };
  const key = "synthetic-secret";
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => key,
    simulated: { price, replies: ["one", "two", { text: "", errorMessage: `401 ${key}` }] },
  });
  session.onFinish((turn) => {
    appendUsageRecord(
      file,
      toUsageRecord(turn, { sessionId: "test", modelPrice: price, secrets: [key] }),
    );
  });
  try {
    await session.send("first");
    await session.send("second");
    await session.send("third");
    const records = readUsageRecords(file);
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.outcome)).toEqual(["completed", "completed", "error"]);
    expect(JSON.stringify(records)).not.toContain(key);
    const totals = sumUsage(records);
    expect(totals.inputTokens).toBe(
      records.reduce((sum, record) => sum + (record.inputTokens ?? 0), 0),
    );
    expect(totals.outputTokens).toBe(
      records.reduce((sum, record) => sum + (record.outputTokens ?? 0), 0),
    );
    expect(totals.cost).toBe(records.reduce((sum, record) => sum + (record.cost?.total ?? 0), 0));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("generate() sends exactly the assembled context and leaves plain chat untouched", async () => {
  const seen: { role: string; text: string }[][] = [];
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: {
      replies: [
        (history) => {
          seen.push(history);
          return "In character.";
        },
        (history) => {
          seen.push(history);
          return "Plain again.";
        },
      ],
    },
  });
  const deltas: string[] = [];
  session.onDelta((delta) => {
    deltas.push(delta);
  });
  const turn = await session.generate({
    system: "You are Mira.",
    messages: [
      { role: "character", text: "Welcome to the lighthouse." },
      { role: "user", text: "Hello Mira." },
    ],
    afterHistory: "Stay brief.",
  });
  expect(turn).toMatchObject({ outcome: "completed", text: "In character." });
  expect(deltas.join("")).toBe("In character.");
  expect(seen[0]).toEqual([
    { role: "system", text: "You are Mira." },
    { role: "assistant", text: "Welcome to the lighthouse." },
    { role: "user", text: "Hello Mira." },
    { role: "system", text: "Stay brief." },
  ]);
  await session.send("plain hello");
  expect(seen[1]?.map((message) => message.text)).toEqual([DEFAULT_SYSTEM_PROMPT, "plain hello"]);
});

it("generate() refuses a context that does not end with a user message", async () => {
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: { replies: ["unused"] },
  });
  const result = await session.generate({
    system: "s",
    messages: [{ role: "character", text: "greeting" }],
    afterHistory: null,
  });
  expect(result).toBeNull();
});
