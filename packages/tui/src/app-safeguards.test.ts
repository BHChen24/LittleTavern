import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  listChats,
  readRequestSettings,
  readUsageRecords,
  resolveAppPaths,
  type SimulatedReply,
} from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const prices = vi.hoisted(() => ({ unknown: false }));
vi.mock("@littletavern/engine", async (importOriginal) => {
  const original = await importOriginal<typeof import("@littletavern/engine")>();
  return {
    ...original,
    findAllowedModel: (id: string | undefined) => {
      const model = original.findAllowedModel(id);
      return model && prices.unknown ? { ...model, price: null } : model;
    },
  };
});

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  prices.unknown = false;
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

function fixture(replies: SimulatedReply[], settings: Record<string, unknown> = {}, fresh = false) {
  const home = mkdtempSync(join(tmpdir(), "lt-safeguards-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  mkdirSync(paths.configDir, { recursive: true });
  writeFileSync(
    paths.settingsFile,
    JSON.stringify({
      model: DEFAULT_MODEL_ID,
      ...(!fresh ? { userName: "Traveler" } : {}),
      ...settings,
    }),
  );
  const card = join(home, "card.json");
  writeFileSync(
    card,
    JSON.stringify({
      spec: "chara_card_v3",
      data: { name: "Alice", description: "A keeper.", first_mes: "Welcome, {{user}}." },
    }),
  );
  const imported = importFile(paths, card);
  if (!imported.ok) throw new Error(imported.reason);
  const key = "synthetic-key";
  const requestSettings = readRequestSettings(paths);
  const request = {
    ...(requestSettings.replyTokens ? { maxTokens: requestSettings.replyTokens } : {}),
    ...(requestSettings.generation.temperature !== undefined
      ? { temperature: requestSettings.generation.temperature }
      : {}),
  };
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => key,
    request,
    simulated: { replies, price: { inputPerMTok: 1, outputPerMTok: 2 } },
  });
  // Faux overwrites scripted usage with zero costs; inject reported spend before the app listener.
  session.onFinish((turn) => {
    turn.usage.cost = { input: 0.006, output: 0.006, cacheRead: 0, cacheWrite: 0, total: 0.012 };
  });
  let onInput: ((data: string) => void) | undefined;
  const terminal: Terminal = {
    columns: 160,
    rows: 40,
    kittyProtocolActive: false,
    start(callback) {
      onInput = callback;
    },
    stop() {},
    write() {},
    moveBy() {},
    hideCursor() {},
    showCursor() {},
    clearLine() {},
    clearFromCursor() {},
    clearScreen() {},
    setTitle() {},
    async drainInput() {},
    setProgress() {},
    setProgramStatus() {},
  };
  const app = createApp({ terminal, paths, env: { OPENROUTER_API_KEY: key }, session });
  cleanups.push(async () => {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  });
  const input = (value: string) => app.tui.getFocusedComponent()?.handleInput?.(value);
  const screen = () => app.tui.children.flatMap((component) => component.render(500)).join("\n");
  const overlay = () => app.tui.getFocusedComponent()?.render(500).join("\n") ?? "";
  const character = async () => {
    await app.submit("/characters");
    input("Alice");
    input("\r");
  };
  return {
    app,
    session,
    paths,
    home,
    key,
    input,
    screen,
    overlay,
    character,
    terminalInput: (value: string) => onInput?.(value),
  };
}

it.each([
  [
    "429 provider details",
    "rate-limited",
    "The reply failed: rate limit reached. Press Ctrl+R or use /regenerate to retry. Retries so far: 0.",
  ],
  [
    "fetch failed",
    "network",
    "The reply failed: network error. Press Ctrl+R or use /regenerate to retry. Retries so far: 0.",
  ],
  [
    "Provider finish_reason: error",
    "other",
    "The reply failed. Press Ctrl+R or use /regenerate to retry. Retries so far: 0.",
  ],
  ["401 rejected", "key-rejected", "OpenRouter rejected the key. Type /apikey to replace it."],
  [
    "402 credit",
    "no-credit",
    "OpenRouter reports insufficient credit. Add credit on openrouter.ai, then retry.",
  ],
  [
    "404 model",
    "model-unavailable",
    "The selected model is unavailable. Choose another with /model.",
  ],
])(
  "shows the contracted notice and safe diagnostic log for %s",
  async (errorMessage, kind, expected) => {
    const f = fixture([{ text: "Partial reply", errorMessage: `${errorMessage} synthetic-key` }]);
    f.app.enterChat();
    await f.character();
    await f.app.submit("hello");
    expect(f.screen()).toContain(`${expected} Details: ${f.paths.logFile}`);
    expect(f.screen()).toContain("Partial reply (incomplete, not saved)");
    expect(f.app.chat?.history().at(-1)?.role).toBe("user");
    const log = readFileSync(f.paths.logFile, "utf8");
    const entry = log
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .find((value) => value.msg === "Provider request failed");
    expect(entry).toMatchObject({ model: DEFAULT_MODEL_ID, kind, level: 50 });
    expect(entry.error).toContain(errorMessage);
    expect(entry.time).toEqual(expect.any(Number));
    expect(log).not.toContain(f.key);
    expect(f.screen()).not.toContain(f.key);
    if (["key-rejected", "no-credit", "model-unavailable"].includes(kind))
      expect(f.screen()).not.toContain("Retries so far:");
    expect(readUsageRecords(f.paths.usageLedgerFile)).toHaveLength(1);
  },
);

it("keeps a typed draft, counts failed retries, resets on success and never sends partial replies", async () => {
  const f = fixture([
    { text: "Partial first", errorMessage: "failure one" },
    { text: "Broken", errorMessage: "failure two" },
    "Recovered",
    { text: "", errorMessage: "fresh failure" },
  ]);
  f.app.enterChat();
  await f.character();
  const remove = f.session.onDelta(() => f.app.editor.setText("next draft"));
  await f.app.submit("hello");
  remove();
  expect(f.app.editor.getText()).toBe("next draft");
  expect(f.screen()).toContain("(incomplete, not saved)");
  await f.app.submit("/regenerate");
  expect(f.screen()).toContain("Retries so far: 1.");
  await f.app.submit("/regenerate");
  expect(f.screen()).toContain("Recovered");
  expect(f.screen()).not.toContain("Broken");
  expect(f.screen()).not.toContain("Retries so far:");
  await f.app.submit("new message");
  expect(f.screen()).toContain("Retries so far: 0.");
});

it("keeps a replaced reply on disk after a failed regenerate and counts the following retry", async () => {
  const f = fixture([
    "Original reply",
    { text: "Failed replacement", errorMessage: "error" },
    { text: "", errorMessage: "again" },
  ]);
  f.app.enterChat();
  await f.character();
  await f.app.submit("hello");
  await f.app.submit("/regenerate");
  expect(f.screen()).toContain("Retries so far: 0.");
  const [saved] = await listChats(f.paths);
  expect(readFileSync(saved?.path ?? "", "utf8")).toContain("Original reply");
  expect(readFileSync(saved?.path ?? "", "utf8")).not.toContain("Failed replacement");
  await f.app.submit("/regenerate");
  expect(f.screen()).toContain("Retries so far: 1.");
});

it("uses the innkeeper retry hint without a count", async () => {
  const f = fixture([{ text: "", errorMessage: "fetch failed" }]);
  f.app.enterChat();
  await f.app.submit("/innkeeper");
  await f.app.submit("hello");
  expect(f.screen()).toContain(
    `The reply failed: network error. Send your message again to retry. Details: ${f.paths.logFile}`,
  );
  expect(f.screen()).not.toContain("Retries so far:");
});

it.each(["character", "innkeeper", "regenerate"])(
  "asks at the spend threshold for %s, keeps stopped input and continues once",
  async (mode) => {
    const f = fixture(["First paid reply", "Next paid reply", "Third paid reply"], {
      limits: { runSpendUsd: 0.01, replyTokens: 4096 },
    });
    f.app.enterChat();
    if (mode === "innkeeper") await f.app.submit("/innkeeper");
    else await f.character();
    await f.app.submit("hello");
    const value = mode === "regenerate" ? "/regenerate" : "keep my typed text";
    const stopped = f.app.submit(value);
    expect(f.overlay()).toContain("This run has spent $");
    expect(f.overlay()).toContain("Continue (allow another $0.01)");
    f.input("Stop");
    f.input("\r");
    await stopped;
    expect(f.app.editor.getText()).toBe(value);
    expect(readUsageRecords(f.paths.usageLedgerFile)).toHaveLength(1);
    expect(f.screen()).toContain("Not sent. Your message is still in the input.");
    const continued = f.app.submit(value);
    f.input("\r");
    await continued;
    expect(readUsageRecords(f.paths.usageLedgerFile)).toHaveLength(2);
    expect(f.screen()).toContain("Next paid reply");
  },
);

it("raises the spend allowance by exactly one configured cap", async () => {
  const f = fixture(["reply", "reply", "reply"], {
    limits: { runSpendUsd: 0.01 },
  });
  f.app.enterChat();
  await f.character();
  await f.app.submit("hello");
  const second = f.app.submit("next");
  f.input("\r");
  await second;
  const third = f.app.submit("last");
  expect(f.overlay()).toContain("of $0.02. Send anyway?");
  f.input("Stop");
  f.input("\r");
  await third;
  expect(readUsageRecords(f.paths.usageLedgerFile)).toHaveLength(2);
});

it("shows limits before chat, hides them after chat starts, and describes disabled limits", async () => {
  const f = fixture([], { limits: { replyTokens: 0, runSpendUsd: 0 } });
  expect(f.screen()).toContain("Limits: replies not capped, spending not capped.");
  f.app.enterChat();
  expect(f.screen()).toContain(f.paths.settingsFile);
  await f.character();
  expect(f.screen()).not.toContain("Limits:");
  await f.app.submit("/innkeeper");
  expect(f.screen()).not.toContain("Limits:");
});

it("keeps length-limited replies and shows the cut-off note once per run", async () => {
  const f = fixture(
    [
      { text: "First cutoff", stopReason: "length" },
      { text: "Second cutoff", stopReason: "length" },
    ],
    { limits: { replyTokens: 30, runSpendUsd: 0 } },
  );
  f.app.enterChat();
  await f.character();
  await f.app.submit("hello");
  await f.app.submit("again");
  expect(
    f.app.chat
      ?.history()
      .filter((item) => item.role === "character")
      .map((item) => item.text),
  ).toContain("First cutoff");
  expect(f.screen().match(/The reply reached the limit of 30 tokens/g)).toHaveLength(1);
  expect(f.screen()).toContain(`Change limits.replyTokens in ${f.paths.settingsFile}.`);
});

it("warns once before sending with unknown prices and still requests the reply cap", async () => {
  prices.unknown = true;
  const f = fixture(["first", "second"]);
  f.app.enterChat();
  await f.character();
  await f.app.submit("hello");
  await f.app.submit("again");
  expect(f.screen().match(/spending limit cannot be checked/g)).toHaveLength(1);
  expect(f.session.request.maxTokens).toBe(4096);
});

it("swaps the last pair on screen and clears it when switching chats", async () => {
  const f = fixture(["Original", "Regenerated"]);
  f.app.enterChat();
  await f.character();
  await f.app.submit("/prev");
  expect(f.screen()).toContain("There is no previous reply to bring back.");
  await f.app.submit("hello");
  await f.app.submit("/regenerate");
  await f.app.submit("/prev");
  expect(f.screen()).toContain("Original");
  expect(f.screen()).not.toContain("Regenerated");
  await f.app.submit("/prev");
  expect(f.screen()).toContain("Regenerated");
  expect(f.screen()).not.toContain("Original");
  await f.character();
  await f.app.submit("/prev");
  expect(f.screen()).toContain("There is no previous reply to bring back.");
  await f.app.submit("/innkeeper");
  await f.app.submit("/prev");
  expect(f.screen()).toContain("/prev works in character chats.");
});

it.each(["/prev", "/new"])(
  "handles real Enter for %s during streaming without losing the draft",
  async (command) => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = fixture([
      async () => {
        await gate;
        return "Finished";
      },
    ]);
    f.app.start();
    f.app.enterChat();
    await f.character();
    const pending = f.app.submit("hello");
    try {
      await vi.waitFor(() => expect(f.session.isStreaming).toBe(true));
      f.app.editor.setText(command);
      f.terminalInput("\r");
      expect(f.screen()).toContain("Wait for the reply, or press Esc to stop it.");
      expect(f.app.editor.getText()).toBe(command);
    } finally {
      release();
      await pending;
    }
  },
);
