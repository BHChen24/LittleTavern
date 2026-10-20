import { expect, it } from "vitest";
import { ChatSession, type TurnResult } from "./chat-session.ts";
import { DEFAULT_MODEL_ID } from "./models.ts";
import { DEFAULT_SYSTEM_PROMPT } from "./system-prompt.ts";

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
