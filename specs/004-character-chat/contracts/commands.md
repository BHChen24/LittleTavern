# Contracts: Character Chat

This builds on 001's `contracts/cli-and-files.md` and 002's `contracts/cli-and-library.md`.

## In-app commands

| Input | Effect |
|---|---|
| `/characters` | Opens the character picker overlay (filter by typing; Enter starts a new chat; Esc cancels) |
| `/chat <id>` | Starts a new chat with the character whose id or unique id prefix is given |
| `/regenerate` or Ctrl+R | Regenerates the last reply (spec User Story 2) |
| `/sessions` | Opens the saved-chat list (newest first: character, last activity, message count). Enter resumes the selected chat |
| `/attach <id>` | Attaches a standalone lorebook to the current character |
| `/detach <id>` | Detaches it |
| `/lorebooks` | Lists the active lorebooks: the embedded one first, then the attached ones, each with its entry count |
| `/plain` | Leaves the character chat and returns to 001's plain chat (the chat is already saved) |

Commands that need a character (`/regenerate`, `/attach`, `/detach`, `/lorebooks`) show
"Start a character chat first (/characters)." when there is none.

`/help` lists all of these.

## Status bar

When a character chat is active, the status bar starts with the character's name and then shows
001's fields: `<name> | <model> | key: <source> | <in>/<out> | $<cost>`.

## Settings file (`<configDir>/settings.json`)

```json
{
  "model": "google/gemini-2.5-flash",
  "userName": "Parker",
  "loreBudget": 4000,
  "scanDepth": 2,
  "replyReserve": 4000,
  "lorebookAttachments": { "8d2e5a17c0b3": ["51c7e2d90a18"] }
}
```

Every field is optional, and unknown fields are preserved.

## Session files

See data-model.md. Each session is a pi JSONL file under `<dataDir>/sessions/`.
