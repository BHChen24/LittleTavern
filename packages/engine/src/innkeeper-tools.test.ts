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
import {
  importFile,
  readRequestSettings,
  resolveAppPaths,
  saveKey,
  writeSettings,
} from "@littletavern/data";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterChat, type CharacterItem, listChats } from "./character-chat.ts";
import { ChatSession } from "./chat-session.ts";
import { createInnkeeperTools, type InnkeeperToolContext } from "./innkeeper-tools.ts";
import { DEFAULT_MODEL_ID } from "./models.ts";

const homes: string[] = [];

function addCharacter(
  home: string,
  paths: InnkeeperToolContext["paths"],
  name: string,
): CharacterItem {
  const file = join(home, `${name}.json`);
  writeFileSync(
    file,
    JSON.stringify({
      spec: "chara_card_v3",
      data: { name, description: "Keeper", first_mes: "Welcome." },
    }),
  );
  const result = importFile(paths, file);
  if (!result.ok || result.item.kind !== "character") throw new Error("Import failed");
  return result.item;
}

it("reports unknown, ambiguous and unsaved characters without asking", async () => {
  const f = fixture();
  addCharacter(f.home, f.paths, "Alice");
  addCharacter(f.home, f.paths, "Alicia");
  expect(await f.call("open_chat", { character: "Bob", mode: "new" })).toMatchObject({
    isError: true,
    content: [{ text: expect.stringContaining('No character matches "Bob".') }],
  });
  expect(await f.call("open_chat", { character: "Ali", mode: "new" })).toMatchObject({
    isError: true,
    content: [{ text: expect.stringContaining('Several characters match "Ali":') }],
  });
  expect(await f.call("open_chat", { character: "Alice", mode: "resume" })).toMatchObject({
    isError: true,
    content: [{ text: "There is no saved chat with Alice." }],
  });
  expect(f.context.confirm).not.toHaveBeenCalled();
  expect(f.context.openChat).not.toHaveBeenCalled();
});

it("confirms opening by id, case-insensitive name and unique substring; declines do nothing", async () => {
  const f = fixture();
  const alice = addCharacter(f.home, f.paths, "Alice");
  expect(await f.call("open_chat", { character: "alice", mode: "new" })).toMatchObject({
    content: [{ text: "The guest declined." }],
  });
  expect(f.context.openChat).not.toHaveBeenCalled();
  f.context.confirm = vi.fn(async () => true);
  for (const name of [alice.id, "aLiCe", "lic"]) {
    expect(await f.call("open_chat", { character: name, mode: "new" })).toMatchObject({
      details: { endTurn: true },
    });
    expect(f.context.confirm).toHaveBeenLastCalledWith(
      { lines: [], title: "Start a new chat with Alice?" },
      undefined,
    );
    expect(f.context.openChat).toHaveBeenLastCalledWith(alice);
  }
});

it("resumes the newest saved chat belonging to the selected character", async () => {
  const f = fixture();
  const alice = addCharacter(f.home, f.paths, "Alice");
  const bob = addCharacter(f.home, f.paths, "Bob");
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: "",
    getApiKey: () => "synthetic-key",
    simulated: { replies: ["First Alice", "Second Alice", "Bob reply"] },
  });
  await CharacterChat.start({ paths: f.paths, session, item: alice }).send("First");
  await CharacterChat.start({ paths: f.paths, session, item: alice }).send("Second");
  await CharacterChat.start({ paths: f.paths, session, item: bob }).send("Bob");
  const newest = (await listChats(f.paths)).find((chat) => chat.characterName === "Alice");
  f.context.confirm = vi.fn(async () => true);
  expect(await f.call("open_chat", { character: "Alice", mode: "resume" })).toMatchObject({
    details: { endTurn: true },
  });
  expect(f.context.openChat).toHaveBeenCalledExactlyOnceWith(alice, newest?.path);
  expect(f.context.confirm).toHaveBeenCalledWith(
    { lines: [], title: expect.stringContaining("Continue your latest chat with Alice (last ") },
    undefined,
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

function fixture() {
  const home = mkdtempSync(join(tmpdir(), "lt-tools-"));
  homes.push(home);
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  writeSettings(paths, { userName: "Traveler", model: "openai/gpt-4o-mini" });
  const active = readRequestSettings(paths);
  const context: InnkeeperToolContext = {
    paths,
    help: () => "Commands and folders.",
    requestSettings: () => active,
    confirm: vi.fn(async () => false),
    openChat: vi.fn(),
    applied: vi.fn(),
  };
  const call = async (name: string, args: Record<string, unknown> = {}, signal?: AbortSignal) => {
    const tool = createInnkeeperTools(context).find((item) => item.name === name);
    if (!tool) throw new Error(`Missing tool ${name}`);
    return tool.execute("test-call", args, signal);
  };
  return { home, paths, active, context, call };
}

it("reports active limits and generation, current lore and persona, and never credentials", async () => {
  const f = fixture();
  const secret = "synthetic-key";
  saveKey(f.paths, secret);
  vi.stubEnv("OPENROUTER_API_KEY", secret);
  mkdirSync(f.paths.importPersonasDir, { recursive: true });
  writeFileSync(
    join(f.paths.importPersonasDir, "mira.md"),
    "## Name\nMira\n## Description\nA traveler.\n",
  );
  writeFileSync(
    f.paths.settingsFile,
    JSON.stringify({
      model: "openai/gpt-4o-mini",
      userName: "Traveler",
      persona: "mira.md",
      loreBudget: 42,
      limits: { replyTokens: 99 },
      generation: { temperature: 2 },
      unknownSecret: secret,
    }),
  );
  f.active.generation.temperature = 0.3;
  const result = await f.call("read_settings");
  const text = result.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  expect(JSON.parse(text)).toMatchObject({
    limits: { replyTokens: 4096, runSpendUsd: 1, toolRounds: 5 },
    generation: { temperature: 0.3 },
    loreBudget: 42,
    scanDepth: 2,
    replyReserve: 4000,
    persona: "Mira",
    userName: "Traveler",
  });
  for (const tool of ["read_settings", "list_characters", "list_personas", "get_help"])
    expect(JSON.stringify(await f.call(tool))).not.toContain(secret);
  expect(JSON.stringify(result)).not.toContain(f.paths.credentialsFile);
  expect(JSON.stringify(await f.call("list_personas"))).toContain('"active\\":true');
});

it("lists only characters and returns built-in help", async () => {
  const f = fixture();
  const file = join(f.home, "card.json");
  writeFileSync(
    file,
    JSON.stringify({ spec: "chara_card_v3", data: { name: "Alice", description: "Keeper" } }),
  );
  expect(importFile(f.paths, file).ok).toBe(true);
  expect(JSON.stringify(await f.call("list_characters"))).toContain("Alice");
  expect(await f.call("get_help")).toMatchObject({
    content: [{ type: "text", text: f.context.help() }],
  });
  expect(readFileSync(f.paths.settingsFile, "utf8")).not.toContain("Alice");
});

it("validates every proposed change before asking, and refuses non-removable settings", async () => {
  const f = fixture();
  for (const [setting, value, message] of [
    ["generation.topP", 2, "generation.topP must be number 0–1. Nothing was changed."],
    ["limits.replyTokens", null, "limits.replyTokens cannot be removed. Nothing was changed."],
    ["userName", 1, "userName must be a supported setting. Nothing was changed."],
  ] as const) {
    expect(await f.call("change_settings", { changes: [{ setting, value }] })).toMatchObject({
      isError: true,
      content: [{ type: "text", text: message }],
    });
  }
  expect(f.context.confirm).not.toHaveBeenCalled();
  expect(existsSync(join(f.paths.configDir, "backups"))).toBe(false);
});

it("leaves declined changes untouched and passes accepted changes and backup path to the app", async () => {
  const f = fixture();
  writeFileSync(
    f.paths.settingsFile,
    JSON.stringify({
      limits: { replyTokens: 4096, runSpendUsd: 3 },
      generation: { topP: 0.8 },
      scanDepth: 3,
      future: true,
    }),
  );
  const original = readFileSync(f.paths.settingsFile, "utf8");
  const changes = [
    { setting: "limits.replyTokens", value: 1000 },
    { setting: "generation.topP", value: null },
    { setting: "scanDepth", value: null },
  ];
  expect(await f.call("change_settings", { changes })).toMatchObject({
    content: [{ text: "The guest declined." }],
  });
  expect(readFileSync(f.paths.settingsFile, "utf8")).toBe(original);
  expect(f.context.applied).not.toHaveBeenCalled();
  expect(f.context.confirm).toHaveBeenCalledWith(
    {
      title: "Apply these settings changes?",
      lines: [
        "limits.replyTokens: 4096 → 1000",
        "generation.topP: 0.8 → default",
        "scanDepth: 3 → default",
      ],
    },
    undefined,
  );
  f.context.confirm = vi.fn(async () => true);
  const result = await f.call("change_settings", { changes });
  const backups = readdirSync(join(f.paths.configDir, "backups"));
  expect(backups).toHaveLength(1);
  const backupPath = join(f.paths.configDir, "backups", backups[0] as string);
  expect(readFileSync(backupPath, "utf8")).toBe(original);
  expect(f.context.applied).toHaveBeenCalledExactlyOnceWith(changes, backupPath);
  expect(JSON.stringify(result)).toContain(backupPath);
  expect(JSON.parse(readFileSync(f.paths.settingsFile, "utf8"))).toEqual({
    limits: { replyTokens: 1000, runSpendUsd: 3 },
    generation: {},
    future: true,
  });
});

it("reports malformed settings and write failures without applying changes", async () => {
  const f = fixture();
  f.context.confirm = vi.fn(async () => true);
  writeFileSync(f.paths.settingsFile, "{broken");
  expect(
    await f.call("change_settings", { changes: [{ setting: "mouse", value: false }] }),
  ).toMatchObject({
    isError: true,
    content: [
      { text: "settings.json is not valid JSON. Fix or remove it first. Nothing was changed." },
    ],
  });
  expect(readFileSync(f.paths.settingsFile, "utf8")).toBe("{broken");
  writeFileSync(f.paths.settingsFile, "{}");
  // A file at the backups directory path makes the backup fail on every platform.
  writeFileSync(join(f.paths.configDir, "backups"), "blocked");
  expect(
    await f.call("change_settings", { changes: [{ setting: "mouse", value: false }] }),
  ).toMatchObject({ isError: true });
  expect(readFileSync(f.paths.settingsFile, "utf8")).toBe("{}");
  expect(f.context.applied).not.toHaveBeenCalled();
});
