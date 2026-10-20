import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { AutocompleteItem, SlashCommand } from "@earendil-works/pi-tui";
import { type AppPaths, type CharacterChat, listLibrary } from "@littletavern/engine";
import { stripControls } from "./sanitize.ts";

export interface CommandContext {
  paths: AppPaths;
  getChat: () => Pick<CharacterChat, "activeLorebooks"> | null;
}

function matching(items: AutocompleteItem[], prefix: string): AutocompleteItem[] {
  const lower = prefix.toLowerCase();
  return items.filter((item) => `${item.label} ${item.value}`.toLowerCase().includes(lower));
}

function importCompletions(root: string, prefix: string): AutocompleteItem[] {
  const expanded = prefix.startsWith("~/") ? join(homedir(), prefix.slice(2)) : prefix;
  const path = resolve(root, expanded);
  const directory = !prefix || prefix.endsWith("/") ? path : dirname(path);
  const filter = !prefix || prefix.endsWith("/") ? "" : basename(prefix);
  try {
    return readdirSync(directory)
      .flatMap((name) => {
        const file = join(directory, name);
        try {
          const info = statSync(file);
          if (!info.isDirectory() && (!info.isFile() || !/^(\.json|\.png)$/i.test(extname(name))))
            return [];
          return [
            {
              value: file + (info.isDirectory() ? "/" : ""),
              label: stripControls(name) + (info.isDirectory() ? "/" : ""),
            },
          ];
        } catch {
          return [];
        }
      })
      .sort(
        (a, b) =>
          Number(b.value.endsWith("/")) - Number(a.value.endsWith("/")) ||
          a.label.localeCompare(b.label),
      )
      .filter((item) => item.label.toLowerCase().includes(filter.toLowerCase()));
  } catch {
    return [];
  }
}

/** The single command definition used by completion, dispatch and help. */
export function COMMANDS(context?: CommandContext): SlashCommand[] {
  const library = (kind?: "character" | "lorebook") => (prefix: string) =>
    matching(
      context
        ? listLibrary(context.paths)
            .filter((item) => !kind || item.kind === kind)
            .map((item) => ({
              value: item.id,
              label: stripControls(item.name),
              description: kind ? item.id : `${item.kind} · ${item.format}`,
            }))
        : [],
      prefix,
    );
  return [
    { name: "characters", description: "Choose a character and start a chat" },
    {
      name: "chat",
      argumentHint: "<id>",
      description: "Start a chat with a character",
      getArgumentCompletions: library("character"),
    },
    { name: "sessions", description: "Resume a saved chat" },
    { name: "regenerate", description: "Regenerate the last reply (Ctrl+R)" },
    { name: "trace", description: "Show why the last request looked the way it did" },
    {
      name: "attach",
      argumentHint: "<id>",
      description: "Attach a lorebook to the current character",
      getArgumentCompletions: library("lorebook"),
    },
    {
      name: "detach",
      argumentHint: "<id>",
      description: "Detach a lorebook",
      getArgumentCompletions: (prefix) =>
        matching(
          context
            ?.getChat()
            ?.activeLorebooks()
            .filter((book) => book.attached && book.id)
            .map((book) => ({
              value: book.id as string,
              label: stripControls(book.name),
              description: book.id,
            })) ?? [],
          prefix,
        ),
    },
    { name: "lorebooks", description: "List the active lorebooks" },
    { name: "plain", description: "Leave the character chat" },
    {
      name: "import",
      argumentHint: "[path]",
      description: "Import a card or lorebook; without a path, browse the import folders",
      getArgumentCompletions: (prefix) =>
        context ? importCompletions(context.paths.importRoot, prefix) : [],
    },
    { name: "library", description: "List the library" },
    {
      name: "show",
      argumentHint: "<id>",
      description: "Inspect an item",
      getArgumentCompletions: library(),
    },
    { name: "new-character", description: "Write a new character in your editor" },
    { name: "persona", description: "Choose who you are in the story" },
    { name: "model", description: "Choose a model" },
    { name: "apikey", description: "Add, replace or forget your OpenRouter API key" },
    { name: "help", description: "Show commands and key bindings" },
    { name: "quit", description: "Quit" },
  ];
}

export function helpText(): string {
  return (
    COMMANDS()
      .map(
        (command) =>
          `/${command.name}${command.argumentHint ? ` ${command.argumentHint}` : ""}  ${command.description}`,
      )
      .join("\n") +
    "\nCtrl+C  Quit\nCtrl+R  Regenerate the last reply\nEsc     Interrupt generation; close overlays or suggestions\nEnter   Send a message\nPgUp/PgDn  Scroll transcript\nCtrl+Home/Ctrl+End  Scroll to first/latest message\nCtrl+Shift+F  Search transcript"
  );
}
