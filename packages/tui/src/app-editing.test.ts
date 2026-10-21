import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  listChats,
  readUsageRecords,
  resolveAppPaths,
  type SimulatedReply,
  writeSettings,
} from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

function fixture(replies: SimulatedReply[] = [], spendCap = 0) {
  const home = mkdtempSync(join(tmpdir(), "lt-editing-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  writeSettings(paths, {
    model: DEFAULT_MODEL_ID,
    userName: "Traveler",
    limits: { runSpendUsd: spendCap },
  });
  const card = join(home, "alice.json");
  writeFileSync(
    card,
    JSON.stringify({
      spec: "chara_card_v3",
      data: { name: "Alice", description: "A keeper.", first_mes: "Welcome, {{user}}." },
    }),
  );
  const imported = importFile(paths, card);
  if (!imported.ok) throw new Error(imported.reason);
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: { replies },
  });
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
  const app = createApp({ terminal, paths, env: { OPENROUTER_API_KEY: "synthetic-key" }, session });
  cleanups.push(async () => {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  });
  app.enterChat();
  const input = (value: string) => app.tui.getFocusedComponent()?.handleInput?.(value);
  const pick = (filter = "") => {
    input(filter);
    input("\r");
  };
  return {
    app,
    session,
    paths,
    home,
    terminal,
    input,
    pick,
    terminalInput: (value: string) => onInput?.(value),
    screen: () => app.tui.children.flatMap((component) => component.render(500)).join("\n"),
    overlay: () => app.tui.getFocusedComponent()?.render(500).join("\n") ?? "",
    character: async () => {
      await app.submit("/characters");
      pick("Alice");
    },
    file: async () => {
      const saved = (await listChats(paths)).find(
        (entry) => entry.sessionId === app.chat?.sessionId,
      );
      if (!saved) throw new Error("Expected a saved chat");
      return saved.path;
    },
  };
}

it("undoes a turn on screen, restores the player's input and keeps paid usage and trace", async () => {
  const f = fixture(["First reply", "Second reply"]);
  await f.character();
  await f.app.submit("First message");
  await f.app.submit("Second message");
  const trace = f.app.chat?.lastTrace;
  const usage = readUsageRecords(f.paths.usageLedgerFile);
  await f.app.submit("/undo");
  expect(f.screen()).toContain("First reply");
  expect(f.screen()).not.toContain("Second reply");
  expect(f.app.chat?.history().map((item) => item.text)).not.toContain("Second message");
  expect(f.app.editor.getText()).toBe("Second message");
  expect(readUsageRecords(f.paths.usageLedgerFile)).toEqual(usage);
  expect(f.app.chat?.lastTrace).toBe(trace);
  expect(f.screen()).toContain("$0.024");
  await f.app.submit("/undo");
  expect(f.app.editor.getText()).toBe("First message");
  await f.app.submit("/undo");
  expect(f.screen()).toContain("There is nothing to undo.");
});

it.each([false, true])(
  "explains undo outside a character chat, innkeeper=%s",
  async (innkeeper) => {
    const f = fixture();
    if (innkeeper) await f.app.submit("/innkeeper");
    await f.app.submit("/undo");
    expect(f.screen()).toContain("/undo works in character chats.");
  },
);

it("refuses undo during streaming through submit and terminal Enter without changing input", async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = fixture([
    async () => {
      await gate;
      return "Reply";
    },
  ]);
  await f.character();
  f.app.start();
  const pending = f.app.submit("Message");
  try {
    await vi.waitFor(() => expect(f.session.isStreaming).toBe(true));
    const before = f.app.chat?.history();
    f.app.editor.setText("/undo");
    await f.app.submit("/undo");
    f.terminalInput("\r");
    expect(f.app.chat?.history()).toEqual(before);
    expect(f.app.editor.getText()).toBe("/undo");
    expect(f.screen().match(/Wait for the reply, or press Esc to stop it\./g)).toHaveLength(2);
  } finally {
    release();
    await pending;
  }
});
