import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importFile, resolveAppPaths } from "@littletavern/engine";
import { afterEach, expect, it } from "vitest";
import { COMMANDS, helpText } from "./commands.ts";

const home = mkdtempSync(join(tmpdir(), "lt-commands-"));
const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
afterEach(() => rmSync(home, { recursive: true, force: true }));
it("generates help for exactly the contracted commands and key bindings", () => {
  const commands = COMMANDS({ paths, getChat: () => null });
  expect(commands.map((command) => command.name)).toEqual([
    "characters",
    "chat",
    "sessions",
    "regenerate",
    "trace",
    "attach",
    "detach",
    "lorebooks",
    "innkeeper",
    "import",
    "library",
    "show",
    "persona",
    "model",
    "apikey",
    "help",
    "quit",
  ]);
  for (const command of commands) {
    expect(helpText()).toContain(`/${command.name}`);
    expect(helpText()).toContain(command.description);
  }
  expect(helpText()).not.toContain("/new-character");
  expect(helpText()).not.toContain("/plain");
  expect(helpText()).toContain("/innkeeper  Talk to the innkeeper");
  expect(helpText()).not.toContain("/key");
  expect(helpText()).not.toContain("/forget-key");
  for (const key of ["Ctrl+C", "Ctrl+R", "Esc", "Enter"]) expect(helpText()).toContain(key);
});
it("reads fresh library items, filters by name or id and offers only attached books for detach", async () => {
  mkdirSync(home, { recursive: true });
  const commands = COMMANDS({
    paths,
    getChat: () => ({
      activeLorebooks: () => [
        { name: "Attached", id: "attached-id", attached: true, entries: 0 },
        { name: "Embedded", attached: false, entries: 0 },
      ],
    }),
  });
  const complete = (name: string, prefix = "") =>
    commands.find((c) => c.name === name)?.getArgumentCompletions?.(prefix);
  expect(await complete("chat")).toEqual([]);
  const card = join(home, "card.json");
  const book = join(home, "book.json");
  writeFileSync(card, JSON.stringify({ spec: "chara_card_v3", data: { name: "Mira" } }));
  writeFileSync(book, JSON.stringify({ name: "Harbor", entries: [] }));
  const character = importFile(paths, card);
  const lorebook = importFile(paths, book);
  if (!character.ok || !lorebook.ok) throw new Error("Fixture import failed");
  expect(await complete("chat", "IRA")).toEqual([
    expect.objectContaining({ value: character.item.id, label: "Mira" }),
  ]);
  expect(await complete("chat", character.item.id.slice(0, 6))).toHaveLength(1);
  expect(await complete("attach")).toEqual([expect.objectContaining({ value: lorebook.item.id })]);
  expect(await complete("show")).toHaveLength(2);
  expect(await complete("detach")).toEqual([expect.objectContaining({ value: "attached-id" })]);
  expect(
    await COMMANDS({ paths, getChat: () => null })
      .find((c) => c.name === "detach")
      ?.getArgumentCompletions?.(""),
  ).toEqual([]);
});
it("completes import directories and supported files against the import root", async () => {
  mkdirSync(join(paths.importRoot, "characters"), { recursive: true });
  writeFileSync(join(paths.importRoot, "card.PNG"), "synthetic");
  writeFileSync(join(paths.importRoot, "world.json"), "{}");
  writeFileSync(join(paths.importRoot, "ignore.txt"), "text");
  writeFileSync(join(paths.importRoot, "characters", "mira.json"), "{}");
  const complete = COMMANDS({ paths, getChat: () => null }).find(
    (c) => c.name === "import",
  )?.getArgumentCompletions;
  expect((await complete?.(""))?.map((item) => item.value)).toEqual([
    `${join(paths.importRoot, "characters")}/`,
    join(paths.importRoot, "card.PNG"),
    join(paths.importRoot, "world.json"),
  ]);
  expect(await complete?.("characters/IRA")).toEqual([
    expect.objectContaining({ value: join(paths.importRoot, "characters", "mira.json") }),
  ]);
  expect(await complete?.(`${paths.importRoot}/world`)).toHaveLength(1);
  expect(await complete?.("missing/")).toEqual([]);
});
