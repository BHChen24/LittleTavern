import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import {
  appendUsageRecord,
  importFile,
  readRequestSettings,
  readUsageRecords,
  resolveAppPaths,
} from "@littletavern/data";
import { expect, it, vi } from "vitest";
import { ChatSession, type TurnResult } from "./chat-session.ts";
import type { InnkeeperToolContext } from "./innkeeper-tools.ts";
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

it.each([
  { maxTokens: 4096 },
  {
    maxTokens: 8000,
    temperature: 1.1,
    samplingParams: { top_p: 0.9, top_k: 40, min_p: 0.05, repetition_penalty: 1.05 },
  },
  {},
])("passes configured request options to the faux provider: %j", async (request) => {
  let received: unknown;
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: "",
    getApiKey: () => "synthetic-key",
    request,
    simulated: {
      replies: [{ text: "At the limit.", stopReason: "length" }],
      onRequest: (options) => {
        received = options;
      },
    },
  });
  const turn = await session.send("hello");
  expect(received).toMatchObject(request);
  for (const key of ["maxTokens", "temperature", "samplingParams"] as const) {
    expect((received as Record<string, unknown>)[key]).toEqual(request[key]);
  }
  expect(session.request).toEqual(request);
  expect(turn).toMatchObject({ outcome: "completed", cutOff: true, text: "At the limit." });
});

function toolContext(home: string): InnkeeperToolContext {
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  return {
    paths,
    help: () => "House rules: use /import.",
    requestSettings: () => readRequestSettings(paths),
    confirm: async () => false,
    openChat: () => {},
    applied: () => {},
  };
}

it("sums every reported token and cost field across the tool loop", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-usage-sum-"));
  const subscribe = Agent.prototype.subscribe;
  const spy = vi.spyOn(Agent.prototype, "subscribe").mockImplementation(function (
    this: Agent,
    listener,
  ) {
    return subscribe.call(this, (event) => {
      if (event.type === "message_end" && event.message.role === "assistant") {
        // Faux reports zero prices; supply deterministic provider usage at the adapter boundary.
        event.message.usage = {
          input: 1,
          output: 2,
          cacheRead: 3,
          cacheWrite: 4,
          reasoning: 5,
          totalTokens: 10,
          cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
        };
      }
      listener(event);
    });
  });
  try {
    const session = new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: "",
      getApiKey: () => "synthetic-key",
      innkeeper: toolContext(home),
      simulated: { replies: [{ toolCalls: [{ name: "get_help", args: {} }] }, "Answer."] },
    });
    expect((await session.send("Help"))?.usage).toEqual({
      input: 2,
      output: 4,
      cacheRead: 6,
      cacheWrite: 8,
      reasoning: 10,
      totalTokens: 20,
      cost: { input: 0.2, output: 0.4, cacheRead: 0.6, cacheWrite: 0.8, total: 2 },
    });
  } finally {
    spy.mockRestore();
    rmSync(home, { recursive: true, force: true });
  }
});

it("ends an accepted open_chat without making a further provider request", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-open-end-"));
  try {
    const innkeeper = toolContext(home);
    const file = join(home, "alice.json");
    writeFileSync(
      file,
      JSON.stringify({ spec: "chara_card_v3", data: { name: "Alice", description: "Keeper" } }),
    );
    expect(importFile(innkeeper.paths, file).ok).toBe(true);
    innkeeper.confirm = async () => true;
    innkeeper.openChat = vi.fn();
    const request = vi.fn();
    const session = new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: "",
      getApiKey: () => "synthetic-key",
      innkeeper,
      simulated: {
        onRequest: request,
        replies: [
          { toolCalls: [{ name: "open_chat", args: { character: "Alice", mode: "new" } }] },
          "Must not be requested",
        ],
      },
    });
    await session.send("Talk to Alice");
    expect(innkeeper.openChat).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("runs an innkeeper tool, preserves ordered history and sums usage over every request", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-innkeeper-session-"));
  try {
    const innkeeper = toolContext(home);
    const seen: string[][] = [];
    const session = new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: "Guide",
      getApiKey: () => "synthetic-key",
      innkeeper,
      simulated: {
        replies: [
          { text: "Looking it up.", toolCalls: [{ name: "get_help", args: {} }] },
          (history) => {
            seen.push(history.map((message) => message.text));
            expect(history.at(-1)).toEqual({ role: "toolResult", text: innkeeper.help() });
            return "Use /import.";
          },
          "Character reply.",
          (history) => {
            expect(history.some((message) => message.text === "Character input")).toBe(false);
            return "Welcome back.";
          },
        ],
      },
    });
    const calls = vi.fn();
    const unsubscribe = session.onToolCall(calls);
    const turn = await session.send("How do I import?");
    expect(calls).toHaveBeenCalledExactlyOnceWith({
      name: "get_help",
      label: "read the house rules",
    });
    expect(turn?.usage.output).toBeGreaterThan(Math.ceil("Use /import.".length / 4));
    expect(turn?.usage.totalTokens).toBe((turn?.usage.input ?? 0) + (turn?.usage.output ?? 0));
    expect(turn?.text).toBe("Use /import.");
    expect(seen).toHaveLength(1);
    expect(session.innkeeperHistory()).toEqual([
      { kind: "user", text: "How do I import?" },
      { kind: "innkeeper", text: "Looking it up." },
      { kind: "tool", text: "read the house rules" },
      { kind: "innkeeper", text: "Use /import." },
    ]);
    await session.generate({
      system: "Character",
      messages: [{ role: "user", text: "Character input" }],
      afterHistory: null,
    });
    await session.send("Back again");
    unsubscribe();
    session.clearConversation();
    expect(session.innkeeperHistory()).toEqual([]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("caps each innkeeper message and applies changed request options to its next request", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-innkeeper-round-"));
  try {
    const requests: unknown[] = [];
    const session = new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: "",
      getApiKey: () => "synthetic-key",
      innkeeper: toolContext(home),
      toolRounds: 1,
      simulated: {
        onRequest: (options) => requests.push(options),
        replies: [{ toolCalls: [{ name: "get_help", args: {} }] }, "Next answer."],
      },
    });
    expect(await session.send("Help")).toMatchObject({ toolLimitReached: true });
    expect(requests).toHaveLength(1);
    session.toolRounds = 5;
    session.setRequest({ maxTokens: 1000, temperature: 0.7 });
    expect(await session.send("Again")).toMatchObject({ text: "Next answer." });
    expect(requests[1]).toMatchObject({ maxTokens: 1000, temperature: 0.7 });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("applies a changed round limit to the next message without extending the current run", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-round-live-"));
  try {
    const innkeeper = toolContext(home);
    const session = new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: "",
      getApiKey: () => "synthetic-key",
      innkeeper,
      toolRounds: 1,
      simulated: {
        replies: [
          {
            toolCalls: [
              {
                name: "change_settings",
                args: { changes: [{ setting: "limits.toolRounds", value: 9 }] },
              },
            ],
          },
          { toolCalls: [{ name: "get_help", args: {} }] },
          "Next message answer.",
        ],
      },
    });
    innkeeper.confirm = async () => true;
    innkeeper.applied = () => {
      session.toolRounds = 9;
    };
    expect(await session.send("Raise rounds")).toMatchObject({ toolLimitReached: true });
    expect(session.toolRounds).toBe(9);
    expect(await session.send("Help again")).toMatchObject({ text: "Next message answer." });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
