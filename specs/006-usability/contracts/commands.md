# Contracts: Usability Pass

This replaces the in-app command list from 001, 002, 004 and 005. The single source is
`COMMANDS` in `packages/tui/src/commands.ts`.

## Commands (suggested and listed by `/help`)

| Command | Argument suggestions | Description |
|---|---|---|
| `/characters` | — | Choose a character and start a chat |
| `/new` | — | Start a new chat with the current character (added by 011) |
| `/sessions` | — | Resume a saved chat |
| `/regenerate` | — | Regenerate the last reply (Ctrl+R) |
| `/prev` | — | Bring back the reply that the last regenerate replaced (added by 012) |
| `/trace` | — | Show why the last request looked the way it did |
| `/lorebooks` | — | Choose or import lorebooks for the current character (changed by 011) |
| `/innkeeper` | — | Talk to the innkeeper |
| `/import` | — | Import a card or lorebook from the import folders (changed by 010) |
| `/library` | — | List the library |
| `/show` | — | Inspect a library item with a picker (changed by 011) |
| `/persona` | — | Choose who you are in the story (added by 008) |
| `/model` | — | Choose a model |
| `/apikey` | — | Add, replace or forget your OpenRouter API key |
| `/help` | — | Show commands and key bindings |
| `/quit` | — | Quit |

`/chat`, `/attach`, `/detach`: removed by 011 (use `/characters` and `/lorebooks`).

`/new-character`: moved into `/characters` by 009.
`/plain`: renamed by 009 to `/innkeeper`.

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
