import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AppPaths,
  ensureImportFolders,
  importFile,
  resolveAppPaths,
  writeSettings,
} from "@littletavern/data";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  assembleForCharacter,
  CharacterChat,
  type CharacterItem,
  greetingFor,
  type LorebookItem,
  listChats,
  readChatHistory,
  sessionsDir,
} from "./character-chat.ts";
import { ChatSession, type SimulatedReply } from "./chat-session.ts";
import { dryRun } from "./dry-run.ts";
import { DEFAULT_MODEL_ID } from "./models.ts";
import { DEFAULT_SYSTEM_PROMPT } from "./system-prompt.ts";

let home: string;
let paths: AppPaths;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-character-chat-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function importJson(name: string, json: unknown) {
  const file = join(home, name);
  writeFileSync(file, JSON.stringify(json));
  const report = importFile(paths, file);
  if (!report.ok) throw new Error(report.reason);
  return report.item;
}

function importCharacter(firstMessage = "Welcome, {{user}}. I am {{char}}."): CharacterItem {
  const item = importJson("mira.json", {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Mira",
      description: "Mira keeps the lighthouse.",
      first_mes: firstMessage,
      character_book: {
        entries: [
          { keys: ["lighthouse"], content: "The lighthouse is haunted.", enabled: true },
          { keys: ["harbor"], content: "The harbor is frozen.", enabled: true },
        ],
      },
    },
  });
  if (item.kind !== "character") throw new Error("expected character");
  return item;
}

function importLorebook(): LorebookItem {
  const item = importJson("world.json", {
    name: "World",
    entries: { "0": { uid: 0, key: ["eldoria"], content: "Eldoria is a forest.", order: 1 } },
  });
  if (item.kind !== "lorebook") throw new Error("expected lorebook");
  return item;
}

type Seen = { role: string; text: string }[];
function simulated(replies: SimulatedReply[]): ChatSession {
  return new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: { replies },
  });
}
function recorder(seen: Seen[], reply: string): SimulatedReply {
  return (history) => {
    seen.push(history);
    return reply;
  };
}

it("sends the active persona through the faux provider and matches the dry-run trace", async () => {
  ensureImportFolders(paths);
  writeFileSync(
    join(paths.importPersonasDir, "traveller.md"),
    "## Name\nTraveller\n## Description\n{{user}} visits {{char}}.\n",
  );
  writeSettings(paths, { persona: "traveller.md", userName: "Parker" });
  const item = importJson("persona-character.json", {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Mira",
      description: "Mira keeps the lighthouse.",
      first_mes: "Welcome, {{user}}. I am {{char}}.",
      character_book: {
        entries: [
          {
            keys: [],
            constant: true,
            enabled: true,
            content: "Before {{user}}",
            position: "before_char",
          },
        ],
      },
    },
  });
  if (item.kind !== "character") throw new Error("expected character");
  const seen: Seen[] = [];
  const chat = CharacterChat.start({
    paths,
    session: simulated([recorder(seen, "Welcome.")]),
    item,
  });
  expect(chat.history()[0]?.text).toBe("Welcome, Traveller. I am Mira.");
  const assembled = assembleForCharacter({
    paths,
    item,
    history: [...chat.history(), { role: "user", text: "Hello" }],
    modelId: DEFAULT_MODEL_ID,
  });
  expect((await chat.send("Hello"))?.outcome).toBe("completed");
  const system = seen[0]?.[0]?.text ?? "";
  expect(system.indexOf("Before Traveller")).toBeLessThan(system.indexOf("Traveller visits Mira."));
  expect(system.indexOf("Traveller visits Mira.")).toBeLessThan(
    system.indexOf("Mira keeps the lighthouse."),
  );
  expect(system).toContain("Traveller visits Mira.");
  expect(system).not.toContain("Parker");
  expect(chat.lastTrace).toEqual(assembled.trace);
  expect(chat.lastTrace?.parts.map((part) => part.source)).toContain("persona");
  const preview = await dryRun({ paths, characterId: item.id, message: "Hello" });
  if (!preview.ok) throw new Error(preview.error);
  expect(preview.prompt.system).toContain("Traveller visits Mira.");
  expect(preview.prompt.history[0]?.text).toContain("Traveller");
  expect(preview.trace.parts.map((part) => part.source)).toContain("persona");
  expect(preview.trace).toEqual(chat.lastTrace);
  writeFileSync(join(paths.importPersonasDir, "traveller.md"), "## Name\nChanged\n");
  expect(greetingFor(paths, item)).toContain("Changed");
});

it.each(["missing", "invalid"])(
  "falls back for a %s active persona and notices only once in a chat",
  async (state) => {
    ensureImportFolders(paths);
    if (state === "invalid") writeFileSync(join(paths.importPersonasDir, "active.md"), "No name");
    writeSettings(paths, { persona: "active.md", userName: "Parker" });
    const item = importCharacter();
    expect(greetingFor(paths, item)).toContain("Parker");
    const chat = CharacterChat.start({ paths, session: simulated(["One", "Two"]), item });
    const notices: string[] = [];
    chat.onNotice = (notice) => notices.push(notice);
    await chat.send("First");
    await chat.send("Second");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("active.md");
    expect(chat.lastTrace?.parts.some((part) => part.source === "persona")).toBe(false);
    const preview = await dryRun({ paths, characterId: item.id });
    if (!preview.ok) throw new Error(preview.error);
    expect(preview.notices[0]).toContain("active.md");
    writeSettings(paths, { persona: null });
    expect(greetingFor(paths, item)).toContain("Parker");
    writeFileSync(paths.settingsFile, "{}");
    expect(greetingFor(paths, item)).toContain("Traveler");
  },
);

it("starts with the greeting, with macros replaced, as the first character message", () => {
  writeSettings(paths, { userName: "Parker" });
  const chat = CharacterChat.start({ paths, session: simulated([]), item: importCharacter() });
  expect(chat.history()).toEqual([{ role: "character", text: "Welcome, Parker. I am Mira." }]);
  expect(chat.sessionId).toMatch(/\S/);
});

it("starts with an empty history when the card has no greeting", () => {
  const chat = CharacterChat.start({ paths, session: simulated([]), item: importCharacter("") });
  expect(chat.history()).toEqual([]);
});

it("sends an assembled request with the card and the triggered lore, and keeps the trace", async () => {
  const seen: Seen[] = [];
  const chat = CharacterChat.start({
    paths,
    session: simulated([recorder(seen, "The light still turns.")]),
    item: importCharacter(),
  });
  const turn = await chat.send("Tell me about the lighthouse.");
  expect(turn?.outcome).toBe("completed");
  const system = seen[0]?.[0];
  expect(system?.role).toBe("system");
  expect(system?.text).toContain("Mira keeps the lighthouse.");
  expect(system?.text).toContain("The lighthouse is haunted.");
  expect(system?.text).not.toContain("The harbor is frozen.");
  expect(seen[0]?.slice(1).map((message) => message.role)).toEqual(["assistant", "user"]);
  expect(chat.lastTrace?.lore.find((entry) => entry.included)?.reason).toEqual({
    kind: "keyword",
    key: "lighthouse",
    message: 2,
  });
  expect(chat.history().map((message) => message.text)).toEqual([
    "Welcome, Traveler. I am Mira.",
    "Tell me about the lighthouse.",
    "The light still turns.",
  ]);
});

it("regenerates the last reply, keeps the old one on disk, and sends only the new one later", async () => {
  const seen: Seen[] = [];
  const chat = CharacterChat.start({
    paths,
    session: simulated(["First reply.", recorder(seen, "Second reply."), recorder(seen, "Next.")]),
    item: importCharacter(),
  });
  await chat.send("hello");
  await chat.regenerate();
  expect(seen[0]?.map((message) => message.text)).not.toContain("First reply.");
  await chat.send("go on");
  const texts = seen[1]?.map((message) => message.text) ?? [];
  expect(texts).toContain("Second reply.");
  expect(texts).not.toContain("First reply.");
  const [file] = readdirSync(sessionsDir(paths));
  const raw = readFileSync(join(sessionsDir(paths), file ?? ""), "utf8");
  expect(raw).toContain("First reply.");
  expect(raw).toContain("Second reply.");
});

it("regenerates a reply for a trailing user message and refuses to regenerate the greeting", async () => {
  const chat = CharacterChat.start({
    paths,
    session: simulated([{ text: "", errorMessage: "network down" }, "Recovered."]),
    item: importCharacter(),
  });
  expect(await chat.regenerate()).toBe("nothing-to-regenerate");
  const failed = await chat.send("hello");
  expect(failed?.outcome).toBe("error");
  expect(chat.history().at(-1)).toEqual({ role: "user", text: "hello" });
  const retried = await chat.regenerate();
  expect(retried).toMatchObject({ outcome: "completed", text: "Recovered." });
});

it("resumes the current branch after a restart and lists the chat", async () => {
  const item = importCharacter();
  const chat = CharacterChat.start({
    paths,
    session: simulated(["One.", "Two.", "Two, again."]),
    item,
  });
  await chat.send("first");
  await chat.send("second");
  await chat.regenerate();
  const before = chat.history();
  const [listed] = await listChats(paths);
  expect(listed).toMatchObject({ characterName: "Mira", sessionId: chat.sessionId });
  const resumed = CharacterChat.resume({
    paths,
    session: simulated([]),
    sessionPath: listed?.path ?? "",
  });
  expect(resumed.history()).toEqual(before);
  expect(readChatHistory(paths, listed?.path ?? "")).toEqual(before);
  expect(before.at(-1)?.text).toBe("Two, again.");
});

it("refuses to resume when the character is no longer in the library", async () => {
  const item = importCharacter();
  const chat = CharacterChat.start({ paths, session: simulated(["Hi."]), item });
  await chat.send("hello");
  const [listed] = await listChats(paths);
  rmSync(join(paths.dataDir, "library", "characters", item.id), { recursive: true });
  expect(() =>
    CharacterChat.resume({ paths, session: simulated([]), sessionPath: listed?.path ?? "" }),
  ).toThrow(/no longer in the library/);
});

it("attaches, uses, lists and detaches standalone lorebooks, persisting per character", async () => {
  const book = importLorebook();
  const seen: Seen[] = [];
  const item = importCharacter();
  const chat = CharacterChat.start({
    paths,
    session: simulated([recorder(seen, "The forest whispers.")]),
    item,
  });
  chat.attachLorebook(book.id.slice(0, 6));
  await chat.send("What is Eldoria?");
  expect(seen[0]?.[0]?.text).toContain("Eldoria is a forest.");
  const again = CharacterChat.start({ paths, session: simulated([]), item });
  expect(
    again.activeLorebooks().map((entry) => [entry.name, entry.entries, entry.attached]),
  ).toEqual([
    ["Mira", 2, false],
    ["World", 1, true],
  ]);
  expect(again.detachLorebook(book.id)).toBe(true);
  expect(again.activeLorebooks()).toHaveLength(1);
});

it("skips a missing attached lorebook with a single notice", async () => {
  const book = importLorebook();
  const notices: string[] = [];
  const chat = CharacterChat.start({
    paths,
    session: simulated(["One.", "Two."]),
    item: importCharacter(),
  });
  chat.onNotice = (text) => {
    notices.push(text);
  };
  chat.attachLorebook(book.id);
  rmSync(join(paths.dataDir, "library", "lorebooks", book.id), { recursive: true });
  expect(chat.attachedLorebookIds()).toEqual([book.id]);
  await chat.send("one");
  await chat.send("two");
  expect(notices).toHaveLength(1);
  expect(notices[0]).toContain("no longer in the library");
});

it("returns the stored attached lorebook ids, including missing ids", () => {
  const item = importCharacter();
  const chat = CharacterChat.start({ paths, session: simulated([]), item });
  expect(chat.attachedLorebookIds()).toEqual([]);
  writeSettings(paths, { lorebookAttachments: { [item.id]: ["missing-id", "another-id"] } });
  expect(chat.attachedLorebookIds()).toEqual(["missing-id", "another-id"]);
});

it("writes session files only inside the app's own data directory", async () => {
  const chat = CharacterChat.start({ paths, session: simulated(["Hi."]), item: importCharacter() });
  await chat.send("hello");
  expect(sessionsDir(paths).startsWith(home)).toBe(true);
  expect(existsSync(sessionsDir(paths))).toBe(true);
  expect(readdirSync(sessionsDir(paths))).toHaveLength(1);
});
