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
  readUsageRecords,
  resolveAppPaths,
  type SimulatedReply,
  type TurnResult,
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

it("shows the round-limit notice and counts the turn's usage in status and ledger", async () => {
  const f = fixture([{ toolCalls: [{ name: "get_help", args: {} }] }, "Must not be requested."], {
    limits: { toolRounds: 1 },
  });
  script.spend = 0.012;
  let turn: TurnResult | undefined;
  f.app.session.onFinish((finished) => {
    turn = finished;
  });
  await f.app.submit("/innkeeper");
  await f.app.submit("Keep looking things up");
  expect(script.requests).toHaveLength(1);
  expect(f.screen()).toContain("The innkeeper stopped after 1 rounds of tool calls.");
  expect(f.screen()).toContain(`raise limits.toolRounds in ${f.paths.settingsFile}`);
  const [record] = readUsageRecords(f.paths.usageLedgerFile);
  expect(record).toMatchObject({
    inputTokens: turn?.usage.input,
    outputTokens: turn?.usage.output,
    cost: { total: 0.012 },
  });
  expect(f.screen()).toContain(`Tokens: ${turn?.usage.input} in / ${turn?.usage.output} out`);
  expect(f.screen()).toContain("$0.0120");
});

it("records all requests before an innkeeper provider failure and shows its retry hint", async () => {
  const f = fixture([
    { text: "Looking.", toolCalls: [{ name: "get_help", args: {} }] },
    { text: "", errorMessage: "fetch failed" },
  ]);
  let turn: TurnResult | undefined;
  f.app.session.onFinish((finished) => {
    turn = finished;
  });
  await f.app.submit("/innkeeper");
  await f.app.submit("Help me");
  expect(script.requests).toHaveLength(2);
  expect(f.screen()).toContain("Send your message again to retry.");
  expect(f.screen()).not.toContain("Retries so far:");
  const [record] = readUsageRecords(f.paths.usageLedgerFile);
  expect(record).toMatchObject({
    outcome: "error",
    inputTokens: turn?.usage.input,
    outputTokens: turn?.usage.output,
  });
  expect(record?.outputTokens).toBeGreaterThan(0);
});

it.each(["Yes", "No", "Esc"])("handles %s when opening a new character chat", async (choice) => {
  const f = fixture([
    { toolCalls: [{ name: "open_chat", args: { character: "Alice", mode: "new" } }] },
    "Declined opening.",
  ]);
  await f.app.submit("/innkeeper");
  const sending = f.app.submit("Talk to Alice");
  await vi.waitFor(() => expect(f.overlay()).toContain("Start a new chat with Alice?"));
  expect(f.app.chat).toBeNull();
  f.input(choice === "Esc" ? "\x1b" : choice);
  if (choice !== "Esc") f.input("\r");
  await sending;
  if (choice === "Yes") {
    expect(f.app.chat?.character.name).toBe("Alice");
    expect(f.screen()).toContain("Welcome, Traveler.");
    const [record] = readUsageRecords(f.paths.usageLedgerFile);
    expect(record?.sessionId).not.toBe(f.app.chat?.sessionId);
    expect(script.requests).toHaveLength(1);
    await f.app.submit("/innkeeper");
    expect(f.screen()).toContain("Talk to Alice");
    expect(f.screen()).toContain("· Innkeeper offered to open a chat");
  } else {
    expect(f.app.chat).toBeNull();
    expect(f.screen()).toContain("Declined opening.");
  }
});

it("resumes an existing chat after recording innkeeper usage", async () => {
  const f = fixture([
    "Earlier Alice reply.",
    { toolCalls: [{ name: "open_chat", args: { character: "Alice", mode: "resume" } }] },
  ]);
  await f.character();
  await f.app.submit("Earlier message.");
  const savedId = f.app.chat?.sessionId;
  await f.app.submit("/innkeeper");
  const sending = f.app.submit("Continue Alice");
  await vi.waitFor(() => expect(f.overlay()).toContain("Continue your latest chat with Alice"));
  f.input("\r");
  await sending;
  expect(f.app.chat?.sessionId).toBe(savedId);
  expect(f.screen()).toContain("Earlier Alice reply.");
  const records = readUsageRecords(f.paths.usageLedgerFile);
  expect(records.at(-1)?.sessionId).not.toBe(savedId);
});

it.each([
  ["Bob", "new", "No character matches"],
  ["Ali", "new", "Several characters match"],
  ["Alice", "resume", "There is no saved chat"],
] as const)("reports %s/%s without asking to open a chat", async (character, mode, expected) => {
  const f = fixture([
    { toolCalls: [{ name: "open_chat", args: { character, mode } }] },
    (history) => {
      expect(history.at(-1)?.text).toContain(expected);
      return "Please choose another chat.";
    },
  ]);
  const second = join(f.home, "alicia.json");
  writeFileSync(
    second,
    JSON.stringify({
      spec: "chara_card_v3",
      data: { name: "Alicia", description: "Another keeper" },
    }),
  );
  expect(importFile(f.paths, second).ok).toBe(true);
  await f.app.submit("/innkeeper");
  await f.app.submit("Open a chat");
  expect(f.app.chat).toBeNull();
  expect(f.screen()).toContain("Please choose another chat.");
  expect(f.overlay()).not.toContain("Start a new chat with");
});

it("rejects malformed tool arguments without confirmation or writes", async () => {
  const f = fixture([
    {
      toolCalls: [
        {
          name: "change_settings",
          args: { changes: [{ setting: "limits.replyTokens", value: "invalid" }] },
        },
      ],
    },
    (history) => {
      expect(history.at(-1)?.role).toBe("toolResult");
      return "The value was invalid.";
    },
  ]);
  await f.app.submit("/innkeeper");
  const before = readFileSync(f.paths.settingsFile, "utf8");
  await f.app.submit("Bad setting");
  expect(f.screen()).toContain("The value was invalid.");
  expect(readFileSync(f.paths.settingsFile, "utf8")).toBe(before);
  expect(existsSync(join(f.paths.configDir, "backups"))).toBe(false);
});
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
