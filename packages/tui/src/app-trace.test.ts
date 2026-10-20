import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  resolveAppPaths,
} from "@littletavern/engine";
import { expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const terminal: Terminal = {
  columns: 100,
  rows: 30,
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

it("explains /trace outside character chats and shows the last request's trace", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-app-trace-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const card = join(home, "mira.json");
  writeFileSync(
    card,
    JSON.stringify({
      spec: "chara_card_v3",
      data: {
        name: "Mira",
        first_mes: "Welcome.",
        character_book: { entries: [{ keys: ["lighthouse"], content: "Haunted." }] },
      },
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
      simulated: { replies: ["It is."] },
    }),
  });
  app.enterChat();
  const screen = () => app.tui.children.flatMap((component) => component.render(100)).join("\n");
  try {
    await app.submit("/model");
    app.tui.getFocusedComponent()?.handleInput?.("\r");
    await app.submit("/trace");
    expect(screen()).toContain("The trace is available in character chats");
    await app.submit("/characters");
    app.tui.getFocusedComponent()?.handleInput?.(`${report.item.id}`);
    app.tui.getFocusedComponent()?.handleInput?.("\r");
    await app.submit("/trace");
    expect(screen()).toContain("No request yet");
    await app.submit("Is the lighthouse haunted?");
    await vi.waitFor(() => expect(screen()).toContain("It is."));
    await app.submit("/trace");
    // Overlays are composited by the terminal renderer, so read the overlay component itself.
    const overlay = app.tui.getFocusedComponent();
    const traceText = overlay?.render(100).join("\n") ?? "";
    expect(traceText).toContain("Lore fired (1)");
    expect(traceText).toContain("keyword `lighthouse` in message 2");
    overlay?.handleInput?.("\x1b");
    expect(app.tui.getFocusedComponent()).toBe(app.editor);
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});
