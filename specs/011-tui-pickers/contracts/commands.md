# Contract: In-app commands changed by 011

## Commands

| Command | Before | After |
|---|---|---|
| `/show` | `/show <id>`, with id completion | `/show`, no argument: a picker of every library item; choosing one prints its details |
| `/lorebooks` | Lists the active lorebooks | A picker: import, the card's lorebook, every library lorebook, and missing attachments; choosing toggles (see data-model.md) |
| `/new` | — | Starts a new chat with the current character, or clears the innkeeper conversation |
| `/chat <id>` | Start a chat | **Removed** (use `/characters`) |
| `/attach <id>` | Attach a lorebook | **Removed** (use `/lorebooks`) |
| `/detach <id>` | Detach a lorebook | **Removed** (use `/lorebooks`) |

The descriptions in `COMMANDS()`, which also feed completion and help, are:

- `show`: `Inspect a library item`
- `lorebooks`: `Choose or import lorebooks for the current character`
- `new`: `Start a new chat with the current character`

Shell subcommands (`littletavern import|list|show|create|dry-run`) are unchanged.

## Messages

| Situation | Text |
|---|---|
| `/show <anything>` | `/show opens a picker. In a shell, run: littletavern show <id>` |
| `/show` with an empty library | the existing `EMPTY_LIBRARY_HINT` |
| `/show` picker title | `Inspect an item (Enter shows details, Esc cancels)` |
| `/show` filter placeholder | `Filter items` |
| `/lorebooks` without a character chat | `Start a character chat first (/characters).` (unchanged) |
| `/lorebooks` picker title | `Lorebooks for <character> (Enter toggles, Esc cancels)` |
| `/lorebooks` filter placeholder | `Filter lorebooks` |
| Import entry label | `Import a lorebook…` |
| Attached | `Attached <name>.` |
| Detached | `Detached <name>.` |
| Missing attachment detached | `Detached a lorebook that is no longer in the library.` |
| Card lorebook chosen | `<name> is part of the character card and cannot be detached.` |
| Import result that is not a lorebook | the import report only; nothing attached |
| `/new` in a character chat | `Started a new chat with <name>. Earlier chats are in /sessions.` |
| `/new` in innkeeper mode | `Started a new conversation with the innkeeper.` |
| `/new` with no chat | `Choose a character with /characters, or use /innkeeper.` |
| `/new` while a reply streams | `Wait for the reply, or press Esc to stop it.` |
| `/new` when the character was deleted | `<name> is no longer in the library. Choose a character with /characters.` |

`<name>` values are passed through `stripControls`, as every other displayed name is.

## Overlay frame

Every overlay is drawn inside a one-character box border (`┌─┐ │ │ └─┘`) with one space of padding
on each side. The component's own title line stays as the first line inside the frame. Lines are
truncated, never wrapped across the border. The border characters are present with and without
`NO_COLOR`.
