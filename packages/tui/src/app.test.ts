import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  listLibrary,
  resolveAppPaths,
} from "@littletavern/engine";
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
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: key },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => key,
      simulated: { replies: ["Hello there."] },
    }),
  });
  try {
    expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
      "LittleTavern 0.1.0",
    );
    app.enterChat();
    app.editor.handleInput("hi");
    app.editor.handleInput("\r");
    await vi.waitFor(() =>
      expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
        "Hello there.",
      ),
    );
    expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
      "You:",
    );
    expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
      "Assistant:",
    );
    expect(app.tui.children.flatMap((component) => component.render(80)).at(-1)).toContain(
      "Key: environment",
    );
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
    expect(app.tui.children.flatMap((component) => component.render(100)).join("\n")).toContain(
      "Press Enter to start",
    );
    app.tui.getFocusedComponent()?.handleInput?.("\r");
    expect(app.tui.getFocusedComponent()).toBe(app.editor);
    expect(app.tui.children.flatMap((component) => component.render(100)).join("\n")).not.toContain(
      "Press Enter to start",
    );
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

it("preserves input and sends nothing when Ctrl+R is pressed without a key", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-no-key-regenerate-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const terminal = stubTerminal();
  let input: ((data: string) => void) | undefined;
  terminal.start = (onInput) => {
    input = onInput;
  };
  const app = createApp({ terminal, paths, env: { LITTLETAVERN_HOME: home } });
  try {
    app.start();
    input?.("\r");
    app.editor.setText("keep this draft");
    input?.("\x12");
    expect(app.editor.getText()).toBe("keep this draft");
    expect(app.tui.children.flatMap((component) => component.render(100)).join("\n")).toContain(
      "No API key yet. Type /apikey",
    );
    expect(existsSync(paths.usageLedgerFile)).toBe(false);
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("survives an import root that is a file and still imports an explicit path", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-broken-import-root-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  writeFileSync(paths.importRoot, "existing file");
  const card = join(home, "mira.json");
  writeFileSync(card, JSON.stringify({ spec: "chara_card_v3", data: { name: "Mira" } }));
  const app = createApp({ terminal: stubTerminal(), paths, env: { LITTLETAVERN_HOME: home } });
  app.enterChat();
  try {
    expect(app.tui.children.flatMap((component) => component.render(120)).join("\n")).toContain(
      "Could not create import folders",
    );
    await app.submit("/import");
    const browser = app.tui.getFocusedComponent();
    expect(browser?.render(120).join("\n")).toContain("Could not read");
    browser?.handleInput?.("\x1b");
    expect(app.tui.hasOverlay()).toBe(false);
    await app.submit(`/import ${card}`);
    expect(listLibrary(paths).map((item) => item.name)).toEqual(["Mira"]);
    expect(app.tui.children.flatMap((component) => component.render(120)).join("\n")).toContain(
      "Imported",
    );
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("prefixes failed commands and provider errors while keeping ordinary notices distinct", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-error-style-"));
  const app = createApp({
    terminal: stubTerminal(),
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: "synthetic" },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => "synthetic",
      simulated: { replies: [{ text: "", errorMessage: "Provider unavailable" }] },
    }),
  });
  app.enterChat();
  const screen = () => app.tui.children.flatMap((component) => component.render(100)).join("\n");
  try {
    await app.submit("/invalid-command");
    expect(screen()).toContain("Error: Unknown command");
    await app.submit("/plain");
    expect(screen()).toContain("· Plain chat.");
    await app.submit("hello");
    expect(screen()).toMatch(/Error: .*Provider/);
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});
