import type { SlashCommand } from "@earendil-works/pi-tui";

/** The single command definition used by completion, dispatch and help. */
export function COMMANDS(): SlashCommand[] {
  return [
    { name: "characters", description: "Choose a character and start a chat" },
    { name: "new", description: "Start a new chat with the current character" },
    { name: "sessions", description: "Resume a saved chat" },
    { name: "regenerate", description: "Regenerate the last reply (Ctrl+R)" },
    { name: "prev", description: "Bring back the reply that the last regenerate replaced" },
    { name: "trace", description: "Show why the last request looked the way it did" },
    { name: "lorebooks", description: "Choose or import lorebooks for the current character" },
    { name: "innkeeper", description: "Talk to the innkeeper" },
    {
      name: "import",
      description: "Import a card or lorebook from the import folders",
    },
    { name: "library", description: "List the library" },
    {
      name: "show",
      description: "Inspect a library item",
    },
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
    "\nCtrl+C  Quit\nCtrl+R  Regenerate the last reply\nCtrl+O  Compose the current input in $EDITOR\nEsc     Interrupt generation; close overlays or suggestions\nEnter   Send a message\nPgUp/PgDn  Scroll transcript\nCtrl+Home/Ctrl+End  Scroll to first/latest message\nCtrl+Shift+F  Search transcript"
  );
}
