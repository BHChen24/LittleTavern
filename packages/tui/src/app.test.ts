import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import { ChatSession, DEFAULT_MODEL_ID, DEFAULT_SYSTEM_PROMPT } from "@littletavern/engine";
import { expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

function stubTerminal(): Terminal {
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

it("renders the title, accepts editor input and renders a simulated reply", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-app-"));
  const key = "synthetic-key";
  const app = createApp({
    terminal: stubTerminal(),
    env: { LITTLETAVERN_HOME: home },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => key,
      simulated: { replies: ["Hello there."] },
    }),
  });
  try {
    expect(app.tui.render(80).join("\n")).toContain("LittleTavern 0.1.0");
    app.enterChat();
    const prompt = app.tui.getFocusedComponent();
    prompt?.handleInput?.(key);
    prompt?.handleInput?.("\r");
    prompt?.handleInput?.("\x1b[B");
    prompt?.handleInput?.("\r");
    app.editor.handleInput("hi");
    app.editor.handleInput("\r");
    await vi.waitFor(() => expect(app.tui.render(80).join("\n")).toContain("Hello there."));
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("starts on the home screen and Enter opens the chat with the editor focused", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-home-"));
  const app = createApp({
    terminal: stubTerminal(),
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: "synthetic" },
  });
  try {
    expect(app.tui.children).toHaveLength(1);
    expect(app.tui.render(100).join("\n")).toContain("Press Enter to start");
    app.tui.getFocusedComponent()?.handleInput?.("\r");
    expect(app.tui.getFocusedComponent()).toBe(app.editor);
    expect(app.tui.render(100).join("\n")).not.toContain("Press Enter to start");
    app.enterChat();
    expect(app.tui.children).toHaveLength(4);
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("quits from the home screen on Ctrl+C", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-home-quit-"));
  const terminal = stubTerminal();
  let input: ((data: string) => void) | undefined;
  terminal.start = (onInput) => {
    input = onInput;
  };
  const app = createApp({ terminal, env: { LITTLETAVERN_HOME: home } });
  try {
    app.start();
    input?.("\x03");
    await app.done;
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});
