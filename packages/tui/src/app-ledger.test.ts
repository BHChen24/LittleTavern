import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  readUsageRecords,
  resolveAppPaths,
  sumUsage,
} from "@littletavern/engine";
import { expect, it } from "vitest";
import { createApp } from "./app.ts";

function terminal(): Terminal {
  return {
    columns: 80,
    rows: 24,
    kittyProtocolActive: false,
    start() {},
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
}

it("records a rejected key, preserves the transcript, and points to /apikey without opening a prompt", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-app-error-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const key = "synthetic-key-1234";
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => key,
    simulated: { replies: [{ text: "", errorMessage: `401 ${key}` }] },
  });
  const app = createApp({ terminal: terminal(), paths, env: { OPENROUTER_API_KEY: key }, session });
  app.enterChat();
  app.tui.getFocusedComponent()?.handleInput?.("\x1b");
  try {
    await app.submit("hello");
    const rendered = app.tui.children.flatMap((component) => component.render(80)).join("\n");
    expect(rendered).toContain("hello");
    expect(rendered).toContain("OpenRouter rejected the key");
    expect(rendered).toContain("Type /apikey to replace it.");
    expect(app.tui.getFocusedComponent()).toBe(app.editor);
    expect(rendered).not.toContain(key);
    expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(1);
    expect(readFileSync(paths.usageLedgerFile, "utf8")).not.toContain(key);
    expect(readFileSync(paths.logFile, "utf8")).not.toContain(key);
    await app.submit("blocked");
    expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(1);
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("waits for the interrupted ledger record before quitting and shows ledger totals", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-app-quit-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: {
      price: { inputPerMTok: 1, outputPerMTok: 2 },
      replies: ["Long response. ".repeat(100)],
    },
  });
  const app = createApp({
    terminal: terminal(),
    paths,
    env: { OPENROUTER_API_KEY: "synthetic-key" },
    session,
  });
  app.enterChat();
  app.tui.getFocusedComponent()?.handleInput?.("\x1b");
  let quitting: Promise<void> | undefined;
  session.onDelta(() => {
    quitting ??= app.quit();
  });
  try {
    await app.submit("hello");
    await quitting;
    const records = readUsageRecords(paths.usageLedgerFile);
    expect(records).toHaveLength(1);
    expect(records[0]?.outcome).toBe("interrupted");
    const totals = sumUsage(records);
    const rendered = app.tui.children.flatMap((component) => component.render(80)).join("\n");
    expect(rendered).toContain(`Tokens: ${totals.inputTokens} in / ${totals.outputTokens} out`);
    expect(rendered).toContain(`$${totals.cost.toFixed(4)}`);
    expect(rendered).toContain("[interrupted]");
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});
