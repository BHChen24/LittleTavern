import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

const script = vi.hoisted(() => ({
  replies: [] as SimulatedReply[],
  requests: [] as unknown[],
  spend: 0,
}));
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
        this.onFinish((turn) => {
          if (script.spend)
            turn.usage.cost = {
              input: script.spend,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: script.spend,
            };
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
  script.spend = 0;
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

it.each(["Yes", "No", "Esc"])("handles %s in the settings confirmation", async (choice) => {
  const f = fixture(
    [
      {
        toolCalls: [
          {
            name: "change_settings",
            args: { changes: [{ setting: "limits.replyTokens", value: 1000 }] },
          },
        ],
      },
      (history) => {
        expect(history.at(-1)?.text).toContain(choice === "Yes" ? "Saved:" : "The guest declined.");
        return "Finished.";
      },
    ],
    { limits: { replyTokens: 4096 } },
  );
  f.app.start();
  await f.app.submit("/innkeeper");
  const original = readFileSync(f.paths.settingsFile, "utf8");
  const sending = f.app.submit("Cap replies");
  await vi.waitFor(() => expect(f.overlay()).toContain("Apply these settings changes?"));
  expect(f.screen()).toContain("limits.replyTokens: 4096 → 1000");
  if (choice === "Esc") f.terminalInput("\x1b");
  else {
    f.input(choice);
    f.input("\r");
  }
  await sending;
  expect(f.screen()).toContain("Finished.");
  if (choice === "Yes") {
    const [backup] = readdirSync(join(f.paths.configDir, "backups"));
    expect(readFileSync(join(f.paths.configDir, "backups", backup as string), "utf8")).toBe(
      original,
    );
    expect(f.screen()).toContain("Settings saved.");
    expect(f.screen()).toContain(backup);
    expect(script.requests[1]).toMatchObject({ maxTokens: 1000 });
  } else {
    expect(readFileSync(f.paths.settingsFile, "utf8")).toBe(original);
    expect(existsSync(join(f.paths.configDir, "backups"))).toBe(false);
    expect(script.requests[1]).toMatchObject({ maxTokens: 4096 });
  }
});

it("applies only confirmed settings to both chats, removes sampling parameters, and reports mouse restart", async () => {
  const f = fixture(
    [
      {
        toolCalls: [
          {
            name: "change_settings",
            args: {
              changes: [
                { setting: "limits.replyTokens", value: 1000 },
                { setting: "generation.topP", value: null },
                { setting: "mouse", value: false },
              ],
            },
          },
        ],
      },
      "Saved changes.",
      "Character reply.",
    ],
    { generation: { topP: 0.8, temperature: 0.3 } },
  );
  await f.app.submit("/innkeeper");
  const saved = JSON.parse(readFileSync(f.paths.settingsFile, "utf8"));
  saved.generation.temperature = 1.5;
  saved.future = true;
  writeFileSync(f.paths.settingsFile, JSON.stringify(saved));
  const sending = f.app.submit("Apply changes");
  await vi.waitFor(() => expect(f.overlay()).toContain("Apply these settings changes?"));
  f.input("\r");
  await sending;
  expect(f.screen()).toContain("The mouse setting applies after a restart.");
  expect(script.requests[1]).toMatchObject({ maxTokens: 1000, temperature: 0.3 });
  expect((script.requests[1] as { samplingParams?: unknown }).samplingParams).toBeUndefined();
  expect(JSON.parse(readFileSync(f.paths.settingsFile, "utf8"))).toMatchObject({
    generation: { temperature: 1.5 },
    future: true,
  });
  await f.character();
  await f.app.submit("Hello Alice");
  expect(script.requests[2]).toMatchObject({ maxTokens: 1000, temperature: 0.3 });
});

it("closes a pending confirmation on abort without writing", async () => {
  const f = fixture([
    {
      toolCalls: [
        { name: "change_settings", args: { changes: [{ setting: "mouse", value: false }] } },
      ],
    },
  ]);
  await f.app.submit("/innkeeper");
  const original = readFileSync(f.paths.settingsFile, "utf8");
  const sending = f.app.submit("Disable mouse");
  await vi.waitFor(() => expect(f.overlay()).toContain("Apply these settings changes?"));
  f.app.session.abort();
  await sending;
  expect(f.overlay()).not.toContain("Apply these settings changes?");
  expect(readFileSync(f.paths.settingsFile, "utf8")).toBe(original);
});

it("uses a confirmed spend cap as the new run allowance", async () => {
  const f = fixture(
    [
      {
        toolCalls: [
          {
            name: "change_settings",
            args: { changes: [{ setting: "limits.runSpendUsd", value: 0.005 }] },
          },
        ],
      },
      "Cap saved.",
      "Unused reply.",
    ],
    { limits: { runSpendUsd: 1 } },
  );
  script.spend = 0.012;
  await f.app.submit("/innkeeper");
  const changing = f.app.submit("Lower spend cap");
  await vi.waitFor(() => expect(f.overlay()).toContain("Apply these settings changes?"));
  f.input("\r");
  await changing;
  const sending = f.app.submit("Another message");
  await vi.waitFor(() => expect(f.overlay()).toContain("of $0.01. Send anyway?"));
  f.input("Stop");
  f.input("\r");
  await sending;
  expect(script.requests).toHaveLength(2);
  expect(f.app.editor.getText()).toBe("Another message");
});
