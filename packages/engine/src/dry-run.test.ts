import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AppPaths,
  createCharacterFromDraft,
  importFile,
  resolveAppPaths,
} from "@littletavern/data";
import { afterEach, beforeEach, expect, it } from "vitest";
import { CharacterChat, type CharacterItem, sessionsDir } from "./character-chat.ts";
import { ChatSession, type SimulatedReply } from "./chat-session.ts";
import { dryRun } from "./dry-run.ts";
import { DEFAULT_MODEL_ID } from "./models.ts";
import { DEFAULT_SYSTEM_PROMPT } from "./system-prompt.ts";

let home: string;
let paths: AppPaths;
let item: CharacterItem;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-dry-run-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const file = join(home, "mira.json");
  writeFileSync(
    file,
    JSON.stringify({
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "Mira",
        description: "Mira keeps the lighthouse.",
        first_mes: "Welcome, {{user}}.",
        character_book: {
          entries: [
            { keys: ["lighthouse"], content: "The lighthouse is haunted." },
            { keys: ["harbor"], content: "The harbor is frozen." },
          ],
        },
      },
    }),
  );
  const report = importFile(paths, file);
  if (!report.ok || report.item.kind !== "character") throw new Error("import failed");
  item = report.item;
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function simulated(replies: SimulatedReply[]): ChatSession {
  return new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: { replies },
  });
}

it("assembles a new chat from the greeting and the message, writing no files", async () => {
  const result = await dryRun({
    paths,
    characterId: item.id.slice(0, 5),
    message: "The lighthouse?",
  });
  if (!result.ok) throw new Error(result.error);
  expect(result.prompt.history).toEqual([
    { role: "character", text: "Welcome, Traveler." },
    { role: "user", text: "The lighthouse?" },
  ]);
  expect(result.trace.lore).toHaveLength(2);
  expect(result.trace.lore.filter((entry) => entry.included)).toHaveLength(1);
  expect(existsSync(sessionsDir(paths))).toBe(false);
});

it("assembles the greeting only when no message is given", async () => {
  const result = await dryRun({ paths, characterId: item.id });
  if (!result.ok) throw new Error(result.error);
  expect(result.prompt.history).toEqual([{ role: "character", text: "Welcome, Traveler." }]);
});

it("continues a saved chat from its current branch after a regeneration", async () => {
  const chat = CharacterChat.start({ paths, session: simulated(["First.", "Second."]), item });
  await chat.send("hello");
  await chat.regenerate();
  const result = await dryRun({
    paths,
    characterId: item.id,
    session: chat.sessionId.slice(0, 8),
    message: "next",
  });
  if (!result.ok) throw new Error(result.error);
  const texts = result.prompt.history.map((message) => message.text);
  expect(texts).toEqual(["Welcome, Traveler.", "hello", "Second.", "next"]);
});

it("rejects a saved chat that belongs to another or a missing character", async () => {
  const otherFile = join(home, "other.json");
  writeFileSync(
    otherFile,
    JSON.stringify({ spec: "chara_card_v3", data: { name: "Other", first_mes: "Hi." } }),
  );
  const other = importFile(paths, otherFile);
  if (!other.ok || other.item.kind !== "character") throw new Error("import failed");
  const chat = CharacterChat.start({ paths, session: simulated(["Hello."]), item: other.item });
  await chat.send("hi");
  expect(await dryRun({ paths, characterId: item.id, session: chat.sessionId })).toEqual({
    ok: false,
    error: `Saved chat ${chat.sessionId} belongs to Other, not Mira.`,
  });
  rmSync(join(paths.dataDir, "library", "characters", other.item.id), { recursive: true });
  expect(await dryRun({ paths, characterId: item.id, session: chat.sessionId })).toEqual({
    ok: false,
    error: "The character for this chat (Other) is no longer in the library.",
  });
});

it("reports unknown characters and sessions", async () => {
  expect(await dryRun({ paths, characterId: "zzzz" })).toEqual({
    ok: false,
    error: "Character not found: zzzz",
  });
  expect(await dryRun({ paths, characterId: item.id, session: "nope" })).toEqual({
    ok: false,
    error: "Saved chat not found: nope",
  });
});

it("produces the same trace as a real request with the same history (SC-003)", async () => {
  const chat = CharacterChat.start({ paths, session: simulated(["Reply."]), item });
  await chat.send("Tell me about the lighthouse.");
  const result = await dryRun({
    paths,
    characterId: item.id,
    message: "Tell me about the lighthouse.",
  });
  if (!result.ok) throw new Error(result.error);
  expect(chat.lastTrace).toMatchObject(result.trace);
});

it("dry-runs and chats with a created character whose lore is always on or keyword-triggered (T-h)", async () => {
  const draft = join(home, "created.md");
  writeFileSync(
    draft,
    `## Name
Creator Mira
## First message
Welcome {{user}}.
## Lorebook
### World
Always on: yes
The coast is quiet.
### Tea
Keys: tea
Always on: no
The tea is smoky.
`,
  );
  const created = createCharacterFromDraft(paths, draft, "0.1.0");
  if (!("ok" in created) || created.item.kind !== "character") throw new Error("Creation failed");
  expect(created.item.character.lorebook?.entries).toMatchObject([
    { name: "World", constant: true, enabled: true, insertionOrder: 0 },
    { name: "Tea", keys: ["tea"], constant: false, enabled: true, insertionOrder: 1 },
  ]);
  const result = await dryRun({ paths, characterId: created.item.id, message: "May I have tea?" });
  if (!result.ok) throw new Error(result.error);
  expect(result.trace.lore).toMatchObject([
    { entry: "World", included: true, reason: { kind: "constant" } },
    { entry: "Tea", included: true, reason: { kind: "keyword", key: "tea", message: 2 } },
  ]);
  expect(result.prompt.system).toContain("The coast is quiet.");
  expect(result.prompt.system).toContain("The tea is smoky.");
  const chat = CharacterChat.start({
    paths,
    session: simulated(["Here is your tea."]),
    item: created.item,
  });
  expect(chat.history()[0]?.text).toBe("Welcome Traveler.");
  await chat.send("May I have tea?");
  expect(chat.history().at(-1)?.text).toBe("Here is your tea.");
  expect(chat.lastTrace).toMatchObject(result.trace);
});
