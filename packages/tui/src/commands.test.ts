import { expect, it } from "vitest";
import { COMMANDS, helpText } from "./commands.ts";

it("generates help for exactly the contracted commands and key bindings", () => {
  const commands = COMMANDS();
  expect(commands.map((command) => command.name)).toEqual([
    "characters",
    "new",
    "sessions",
    "regenerate",
    "prev",
    "undo",
    "edit",
    "trace",
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
  expect(helpText()).toContain("/innkeeper  Ask the innkeeper for help or to change settings");
  expect(helpText()).not.toContain("/key");
  expect(helpText()).not.toContain("/forget-key");
  for (const key of ["Ctrl+C", "Ctrl+R", "Esc", "Enter", "Up/Down"])
    expect(helpText()).toContain(key);
});
it("offers no id arguments or completions for the picker commands", () => {
  for (const name of ["characters", "show", "lorebooks", "new"]) {
    const command = COMMANDS().find((item) => item.name === name);
    expect(command).toBeDefined();
    expect(command?.argumentHint).toBeUndefined();
    expect(command?.getArgumentCompletions).toBeUndefined();
  }
});
it("offers import without a path hint or file completion", () => {
  const command = COMMANDS().find((item) => item.name === "import");
  expect(command?.argumentHint).toBeUndefined();
  expect(command?.getArgumentCompletions).toBeUndefined();
  expect(command?.description).toBe("Import a card or lorebook from the import folders");
});

it("offers show without an id hint or completion", () => {
  const command = COMMANDS().find((item) => item.name === "show");
  expect(command?.argumentHint).toBeUndefined();
  expect(command?.getArgumentCompletions).toBeUndefined();
  expect(command?.description).toBe("Inspect a library item");
});
