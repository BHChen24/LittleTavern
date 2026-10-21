import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  DEFAULT_MODEL_ID,
  importFile,
  resolveAppPaths,
  type SimulatedReply,
} from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const script = vi.hoisted(() => ({ replies: [] as SimulatedReply[], requests: [] as unknown[] }));
vi.mock("@littletavern/engine", async (importOriginal) => {
  const original = await importOriginal<typeof import("@littletavern/engine")>();
  return {
    ...original,
    ChatSession: class extends original.ChatSession {
      constructor(options: ConstructorParameters<typeof original.ChatSession>[0]) {
        super({
          ...options,
          simulated: {
            replies: script.replies,
            onRequest: (options) => script.requests.push(options),
          },
        });
      }
    },
  };
});

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

function fixture(replies: SimulatedReply[], settings: Record<string, unknown> = {}) {
  const home = mkdtempSync(join(tmpdir(), "lt-app-innkeeper-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  mkdirSync(paths.configDir, { recursive: true });
  writeFileSync(
    paths.settingsFile,
    JSON.stringify({ model: DEFAULT_MODEL_ID, userName: "Traveler", ...settings }),
  );
  const card = join(home, "card.json");
  writeFileSync(
    card,
    JSON.stringify({
      spec: "chara_card_v3",
      data: { name: "Alice", description: "Keeper", first_mes: "Welcome, {{user}}." },
    }),
  );
  const imported = importFile(paths, card);
  if (!imported.ok) throw new Error(imported.reason);
  script.replies = replies;
  script.requests = [];
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
  const app = createApp({ paths, terminal, env: { OPENROUTER_API_KEY: "synthetic-key" } });
  cleanups.push(async () => {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  });
  app.enterChat();
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
    paths,
    home,
    imported,
    input,
    screen,
    overlay,
    character,
    terminalInput: (value: string) => onInput?.(value),
  };
}

it("shows tool calls between reply segments and restores the innkeeper conversation", async () => {
  const f = fixture([
    { text: "Let me look.", toolCalls: [{ name: "get_help", args: {} }] },
    (history) => {
      const help = history.at(-1)?.text ?? "";
      expect(help).toContain("/innkeeper  Ask the innkeeper for help or to change settings");
      for (const path of [
        f.paths.importCharactersDir,
        f.paths.importLorebooksDir,
        f.paths.importPersonasDir,
        f.paths.settingsFile,
        join(f.paths.configDir, "backups"),
      ])
        expect(help).toContain(path);
      return "Use the import folder.";
    },
  ]);
  await f.app.submit("/innkeeper");
  await f.app.submit("How do I import?");
  const text = f.screen();
  expect(text.indexOf("Let me look.")).toBeLessThan(
    text.indexOf("· Innkeeper read the house rules"),
  );
  expect(text.indexOf("· Innkeeper read the house rules")).toBeLessThan(
    text.indexOf("Use the import folder."),
  );
  await f.character();
  await f.app.submit("/innkeeper");
  expect(f.screen()).toContain("How do I import?");
  expect(f.screen()).toContain("· Innkeeper read the house rules");
  expect(f.screen()).toContain("Use the import folder.");
  await f.app.submit("/new");
  expect(f.screen()).not.toContain("How do I import?");
  expect(f.app.session.innkeeperHistory()).toEqual([]);
});
