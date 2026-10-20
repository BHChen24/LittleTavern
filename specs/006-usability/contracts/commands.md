# Contracts: Usability Pass

This replaces the in-app command list from 001, 002, 004 and 005. The single source is
`COMMANDS` in `packages/tui/src/commands.ts`.

## Commands (suggested and listed by `/help`)

| Command | Argument suggestions | Description |
|---|---|---|
| `/characters` | — | Choose a character and start a chat |
| `/chat <id>` | characters | Start a chat with a character |
| `/sessions` | — | Resume a saved chat |
| `/regenerate` | — | Regenerate the last reply (Ctrl+R) |
| `/trace` | — | Show why the last request looked the way it did |
| `/attach <id>` | lorebooks | Attach a lorebook to the current character |
| `/detach <id>` | attached lorebooks | Detach a lorebook |
| `/lorebooks` | — | List the active lorebooks |
| `/plain` | — | Leave the character chat |
| `/import [path]` | file paths | Import a card or lorebook; without a path, browse the import folders |
| `/library` | — | List the library |
| `/show <id>` | library items | Inspect an item |
| `/new-character` | — | Write a new character in your editor (added by 007) |
| `/persona` | — | Choose who you are in the story (added by 008) |
| `/model` | — | Choose a model |
| `/apikey` | — | Add, replace or forget your OpenRouter API key |
| `/help` | — | Show commands and key bindings |
| `/quit` | — | Quit |

**Removed**: `/key` and `/forget-key` now answer "replaced by /apikey".

## Screens

- **Home**: name and version, description, "Press Enter to start", "Type / for commands", key
  status, and the import folders when the library is empty. Enter opens the chat. Ctrl+C quits.
- **Chat**: header, transcript, input, then the status bar as the last line.

## Import folders

| Environment | Root | Sub-folders |
|---|---|---|
| default | `~/.littletavern` | `characters/`, `lorebooks/` |
| `LITTLETAVERN_HOME` set | `<LITTLETAVERN_HOME>/import` | `characters/`, `lorebooks/` |
