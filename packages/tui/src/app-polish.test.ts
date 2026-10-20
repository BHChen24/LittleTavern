import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { type Terminal, visibleWidth } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  resolveAppPaths,
  resolveAppPaths as resolveFixturePaths,
  type SimulatedReply,
  writeSettings as writeFixtureSettings,
  writeSettings,
} from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const tty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0)) await clean();
  vi.unstubAllEnvs();
  if (tty) Object.defineProperty(process.stdout, "isTTY", tty);
  else Reflect.deleteProperty(process.stdout, "isTTY");
});
function fixture(reply: SimulatedReply = "Hello", key = true) {
  const home = mkdtempSync(join(tmpdir(), "lt-polish-"));
  writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), { userName: "Traveler" });
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  writeSettings(paths, { model: DEFAULT_MODEL_ID });
  let input: (data: string) => void = () => {};
  const terminal: Terminal = {
    columns: 80,
    rows: 24,
    kittyProtocolActive: false,
    start(onInput) {
      input = onInput;
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
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic",
    simulated: { replies: [reply] },
  });
  const env: Record<string, string | undefined> = {
    OPENROUTER_API_KEY: key ? "synthetic" : undefined,
  };
  const app = createApp({ terminal, paths, env, session });
  cleanups.push(async () => {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  });
  const lines = (width = 100) => app.tui.children.flatMap((component) => component.render(width));
  return { app, home, paths, env, terminal, lines, input: (data: string) => input(data) };
}

it("keeps the waiting indicator until text arrives and removes it on error", async () => {
  const gate = Promise.withResolvers<string>();
  const { app, lines } = fixture(async () => await gate.promise);
  app.enterChat();
  await app.submit("/innkeeper");
  let sawText = false;
  app.session.onDelta(() => {
    sawText = true;
    expect(lines().join("\n")).not.toContain("is writing…");
  });
  const sending = app.submit("hi");
  try {
    expect(lines().join("\n")).toContain("Innkeeper is writing…");
    gate.resolve("Hello there.");
    await sending;
    expect(sawText).toBe(true);
    expect(lines().join("\n")).toContain("Hello there.");
    expect(lines().join("\n")).not.toContain("is writing…");
  } finally {
    gate.resolve("done");
    await sending;
  }
  const failed = fixture({ text: "", errorMessage: "Provider unavailable" });
  failed.app.enterChat();
  await failed.app.submit("/innkeeper");
  await failed.app.submit("hi");
  expect(failed.lines().join("\n")).not.toContain("is writing…");
  expect(failed.lines().join("\n")).toContain("Error:");
});

it("removes the indicator immediately on Esc before the delayed reply resolves", async () => {
  const gate = Promise.withResolvers<string>();
  const { app, lines, input } = fixture(async () => await gate.promise);
  app.start();
  app.enterChat();
  await app.submit("/innkeeper");
  const sending = app.submit("hi");
  try {
    expect(lines().join("\n")).toContain("is writing…");
    input("\x1b");
    expect(lines().join("\n")).not.toContain("is writing…");
  } finally {
    gate.resolve("done");
    await sending;
  }
});

it("shows all placeholders, follows persona changes, and hides invalid active personas", async () => {
  const { app, home, paths, lines } = fixture();
  app.enterChat();
  await app.submit("/innkeeper");
  expect(lines().join("\n")).toContain("Talk to the innkeeper… (/ for commands)");
  const file = join(home, "card.json");
  writeFileSync(
    file,
    JSON.stringify({ spec: "chara_card_v3", data: { name: "Mira", first_mes: "Welcome." } }),
  );
  const result = importFile(paths, file);
  if (!result.ok) throw new Error(result.reason);
  await app.submit("/characters");
  app.tui.getFocusedComponent()?.handleInput?.(`${result.item.id}`);
  app.tui.getFocusedComponent()?.handleInput?.("\r");
  expect(lines().join("\n")).toContain("Talk to Mira… (/ for commands)");
  mkdirSync(paths.importPersonasDir, { recursive: true });
  writeFileSync(join(paths.importPersonasDir, "traveller.md"), "## Name\nTraveller\n");
  await app.submit("/persona");
  app.tui.getFocusedComponent()?.handleInput?.("Traveller");
  app.tui.getFocusedComponent()?.handleInput?.("\r");
  expect(lines().join("\n")).toContain("Persona: Traveller");
  writeSettings(paths, { persona: "missing.md" });
  await app.submit("/innkeeper");
  expect(app.chat).toBeNull();
  expect(lines().join("\n")).toContain("Talk to the innkeeper… (/ for commands)");
  expect(lines().join("\n")).not.toContain("Welcome.");
  expect(lines().join("\n")).not.toContain("Persona:");
  const noKey = fixture("Hello", false);
  noKey.app.enterChat();
  expect(noKey.lines().join("\n")).toContain("Add your key with /apikey to start talking");
  expect(noKey.lines().join("\n")).not.toContain(DEFAULT_MODEL_ID);
});

it("renders home, messages and status within 30 columns at eight rows under NO_COLOR", async () => {
  vi.stubEnv("NO_COLOR", "1");
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  const { app, terminal, lines } = fixture();
  terminal.columns = 30;
  terminal.rows = 8;
  expect(lines(30).every((line) => visibleWidth(line) <= 30)).toBe(true);
  app.start();
  app.enterChat();
  await app.submit("/innkeeper");
  await app.submit('"Hello" *waves*');
  await app.submit("/unknown");
  const rendered = lines(30);
  expect(rendered.every((line) => visibleWidth(line) <= 30)).toBe(true);
  const plain = rendered.map(stripVTControlCharacters).join("\n");
  for (const content of ["You:", "Innkeeper:", "│", "Error:", DEFAULT_MODEL_ID])
    expect(plain).toContain(content);
  expect(rendered.join("\n")).toContain("\x1b[1m");
  expect(rendered.join("\n")).toContain("\x1b[3m");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Assert that ANSI colour controls are absent.
  expect(rendered.join("\n")).not.toMatch(/\x1b\[(?:3[0-9]|4[0-9]|9[0-7]|10[0-7])m/);
  expect(() => app.tui.renderNow(true)).not.toThrow();
});

it("composes the current draft through a fake VISUAL and restores the terminal and input", async () => {
  const { app, home, env, terminal, input } = fixture();
  const script = join(home, "compose.cjs");
  writeFileSync(
    script,
    'const fs = require("node:fs"), path = require("node:path"); const file = process.argv[2]; fs.writeFileSync(path.join(__dirname, "opened-path.txt"), file); fs.appendFileSync(file, "\\nEdited second line.");',
  );
  env.VISUAL = `${process.execPath} ${script}`;
  const start = vi.spyOn(terminal, "start");
  const stop = vi.spyOn(terminal, "stop");
  app.start();
  app.enterChat();
  app.editor.setText("Keep this first line.");
  input("\x0f");
  expect(app.editor.getText()).toBe("Keep this first line.\nEdited second line.");
  expect(stop).toHaveBeenCalledOnce();
  expect(start).toHaveBeenCalledTimes(2);
  const draft = readFileSync(join(home, "opened-path.txt"), "utf8");
  expect(existsSync(draft)).toBe(false);
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
});

it("keeps the draft and reports an editor failure", () => {
  const { app, home, env, input, lines } = fixture();
  const script = join(home, "failed-editor.cjs");
  writeFileSync(script, "process.exit(7);");
  env.VISUAL = `${process.execPath} ${script}`;
  app.start();
  app.enterChat();
  app.editor.setText("Keep this draft.");
  input("\x0f");
  expect(app.editor.getText()).toBe("Keep this draft.");
  expect(lines().join("\n")).toContain("Error: Could not run editor");
});

it("fits help inside a 60x24 terminal, scrolls and restores editor focus on Esc", async () => {
  const { app, input, terminal } = fixture();
  terminal.columns = 60;
  terminal.rows = 24;
  const write = vi.spyOn(terminal, "write");
  app.start();
  app.enterChat();
  await app.submit("/help");
  const help = app.tui.getFocusedComponent();
  const lines = help?.render(60) ?? [];
  expect(lines.length).toBeLessThanOrEqual(24);
  expect(stripVTControlCharacters(lines[0] ?? "").startsWith("┌")).toBe(true);
  expect(stripVTControlCharacters(lines.at(-1) ?? "").endsWith("┘")).toBe(true);
  expect(lines.every((line) => visibleWidth(line) === 60)).toBe(true);
  const firstPage = lines.join("\n");
  expect(firstPage).toContain("/characters");
  expect(firstPage).not.toContain("Ctrl+Shift+F");
  await vi.waitFor(() => {
    const output = stripVTControlCharacters(write.mock.calls.map(([text]) => text).join(""));
    expect(output).toContain("┌");
    expect(output).toContain("└");
  });
  input("\x1b[6~");
  expect(help?.render(60).join("\n")).not.toBe(firstPage);
  input("\x1b[F");
  expect(help?.render(60).join("\n")).toContain("Ctrl+Shift+F");
  input("\x1b[H");
  expect(help?.render(60).join("\n")).toBe(firstPage);
  input("\x1b");
  expect(app.tui.hasOverlay()).toBe(false);
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
});
