import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  readUsageRecords,
  resolveAppPaths,
} from "@littletavern/engine";
import { expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const terminal: Terminal = {
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

it("starts a character chat, regenerates the reply and records usage under the chat's session", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-app-character-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const card = join(home, "mira.json");
  writeFileSync(
    card,
    JSON.stringify({
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: { name: "Mira", description: "Keeper.", first_mes: "Welcome to the lighthouse." },
    }),
  );
  const report = importFile(paths, card);
  if (!report.ok) throw new Error(report.reason);
  const app = createApp({
    terminal,
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: "synthetic-key" },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => "synthetic-key",
      simulated: { replies: ["First reply.", "Second reply."] },
    }),
  });
  app.enterChat();
  const screen = () => app.tui.children.flatMap((component) => component.render(80)).join("\n");
  try {
    await app.submit(`/chat ${report.item.id.slice(0, 6)}`);
    expect(screen()).toContain("Welcome to the lighthouse.");
    expect(screen()).toContain("Mira |");
    expect(screen()).toContain("Mira:");
    await app.submit("hello");
    await vi.waitFor(() => expect(screen()).toContain("First reply."));
    await app.submit("/regenerate");
    await vi.waitFor(() => expect(screen()).toContain("Second reply."));
    expect(screen()).not.toContain("First reply.");
    expect(screen()).toContain("You:");
    await app.submit("/lorebooks");
    expect(screen()).toContain("· No lorebooks.");
    const lines = app.tui.children.flatMap((component) => component.render(80));
    expect(lines[0]).toContain("Character: Mira |");
    expect(lines.filter((line) => /^─{4}/.test(line))).toHaveLength(2);
    const records = readUsageRecords(paths.usageLedgerFile);
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.sessionId === app.chat?.sessionId)).toBe(true);
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});
